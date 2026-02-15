// Define Message type locally since @/types/chat doesn't exist
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ContextWindow {
  systemPrompt: string;
  relevantHistory: Message[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userContext: Record<string, any>;
  estimatedTokens: number;
}

export class ContextManager {
  private readonly MAX_TOKENS = 4000; // Leave room for response
  private readonly PRIORITY_MESSAGES = 3; // Always keep last N messages

  // Build optimal context window for current query
  async buildContext(
    currentQuery: string,
    allMessages: Message[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userSettings: any
  ): Promise<ContextWindow> {
    // 1. Classify the query type
    const queryType = this.classifyQuery(currentQuery);

    // 2. Build minimal system prompt based on query
    const systemPrompt = this.getMinimalSystemPrompt(queryType);

    // 3. Select only relevant message history
    const relevantHistory = this.selectRelevantMessages(
      currentQuery,
      allMessages,
      queryType
    );

    // 4. Build compressed user context
    const userContext = this.buildUserContext(userSettings, queryType);

    return {
      systemPrompt,
      relevantHistory,
      userContext,
      estimatedTokens: this.estimateTokens(systemPrompt, relevantHistory)
    };
  }

  private classifyQuery(query: string): string {
    const lower = query.toLowerCase();

    if (lower.includes('workout') || lower.includes('run') || lower.includes('tomorrow')) {
      return 'workout_prescription';
    }
    if (lower.includes('injury') || lower.includes('pain')) {
      return 'injury_management';
    }
    if (lower.includes('race') || lower.includes('goal')) {
      return 'race_planning';
    }
    if (lower.includes('how') || lower.includes('what') || lower.includes('why')) {
      return 'coaching_knowledge';
    }
    return 'general';
  }

  private getMinimalSystemPrompt(queryType: string): string {
    const basePrompt = `You are an AI running coach. Be concise and helpful.

User Settings:
- Current weekly mileage: {currentMileage}
- VDOT: {vdot}
- Training paces: Easy {easyPace}, Tempo {tempoPace}

Available tools: ${this.getRelevantTools(queryType).join(', ')}`;

    // Add only relevant instructions
    const typeSpecificPrompts: Record<string, string> = {
      workout_prescription: '\n\nFocus on prescribing appropriate workouts based on user fitness.',
      injury_management: '\n\nPrioritize safety. Suggest modifications and rest as needed.',
      race_planning: '\n\nHelp plan training for races using periodization principles.',
      coaching_knowledge: '\n\nProvide evidence-based coaching advice.',
      general: ''
    };

    return basePrompt + (typeSpecificPrompts[queryType] || '');
  }

  private getRelevantTools(queryType: string): string[] {
    const toolMap: Record<string, string[]> = {
      workout_prescription: ['prescribe_workout', 'get_planned_workout_by_date', 'suggest_next_workout'],
      injury_management: ['log_injury', 'get_injury_status', 'suggest_workout_modification'],
      race_planning: ['add_race', 'get_races', 'generate_training_plan'],
      coaching_knowledge: ['get_coaching_knowledge'],
      general: ['get_user_settings', 'get_recent_workouts']
    };

    return toolMap[queryType] || toolMap.general;
  }

  private selectRelevantMessages(
    currentQuery: string,
    allMessages: Message[],
    queryType: string
  ): Message[] {
    if (allMessages.length <= this.PRIORITY_MESSAGES * 2) {
      return allMessages;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _relevant: Message[] = [];
    const queryKeywords = this.extractKeywords(currentQuery);

    // Always keep most recent messages
    const recentMessages = allMessages.slice(-this.PRIORITY_MESSAGES);

    // Find older relevant messages
    const olderMessages = allMessages.slice(0, -this.PRIORITY_MESSAGES);
    const relevantOlder = olderMessages.filter(msg => {
      const score = this.calculateRelevance(msg.content, queryKeywords, queryType);
      return score > 0.3;
    });

    // Take top 3 most relevant older messages
    const topRelevant = relevantOlder
      .sort((a, b) => {
        const scoreA = this.calculateRelevance(a.content, queryKeywords, queryType);
        const scoreB = this.calculateRelevance(b.content, queryKeywords, queryType);
        return scoreB - scoreA;
      })
      .slice(0, 3);

    return [...topRelevant, ...recentMessages];
  }

  private extractKeywords(text: string): string[] {
    // Extract meaningful keywords
    const keywords = text.toLowerCase().split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['what', 'when', 'where', 'how', 'the', 'and', 'for'].includes(word));

    return keywords;
  }

  private calculateRelevance(content: string, keywords: string[], queryType: string): number {
    const lower = content.toLowerCase();
    let score = 0;

    // Keyword matching
    keywords.forEach(keyword => {
      if (lower.includes(keyword)) score += 0.2;
    });

    // Type-specific relevance
    const typeKeywords: Record<string, string[]> = {
      workout_prescription: ['workout', 'miles', 'pace', 'tempo', 'interval', 'easy'],
      injury_management: ['injury', 'pain', 'rest', 'recover', 'hurt'],
      race_planning: ['race', 'goal', 'target', 'plan', 'training'],
      coaching_knowledge: ['why', 'how', 'benefit', 'improve', 'technique']
    };

    const relevantKeywords = typeKeywords[queryType] || [];
    relevantKeywords.forEach(keyword => {
      if (lower.includes(keyword)) score += 0.15;
    });

    return Math.min(score, 1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildUserContext(settings: any, queryType: string): Record<string, any> {
    // Include only relevant user data for the query type
    const baseContext = {
      vdot: settings.vdot,
      currentMileage: settings.currentWeeklyMileage
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typeSpecificContext: Record<string, any> = {
      workout_prescription: {
        easyPace: settings.easyPaceSeconds,
        tempoPace: settings.tempoPaceSeconds,
        preferredLongRunDay: settings.preferredLongRunDay
      },
      injury_management: {
        injuryHistory: settings.injuryHistory,
        currentInjuries: settings.currentInjuries
      },
      race_planning: {
        races: settings.upcomingRaces,
        peakMileageTarget: settings.peakWeeklyMileageTarget
      }
    };

    return {
      ...baseContext,
      ...(typeSpecificContext[queryType] || {})
    };
  }

  private estimateTokens(systemPrompt: string, messages: Message[]): number {
    const allText = systemPrompt + messages.map(m => m.content).join(' ');
    return Math.ceil(allText.length / 4);
  }
}