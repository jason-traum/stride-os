// TODO: Create responseCache and workoutTemplates tables
// import { responseCache, workoutTemplates } from '@/lib/schema';

interface CachedResponse {
  query: string;
  response: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolCalls?: any[];
  timestamp: string;
}

interface LocalResponse {
  handled: boolean;
  response?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolCalls?: any[];
  confidence: number;
}

export class LocalIntelligence {
  // Handle common queries locally without API calls
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async handleLocally(_query: string, context: any): Promise<LocalResponse> {
    const normalizedQuery = this.normalizeQuery(_query);

    // 1. Check response cache first
    const cached = await this.checkCache(normalizedQuery);
    if (cached) {
      return {
        handled: true,
        response: cached.response,
        toolCalls: cached.toolCalls,
        confidence: 0.9
      };
    }

    // 2. Check if it's a simple query we can handle
    const simpleResponse = await this.handleSimpleQuery(normalizedQuery, context);
    if (simpleResponse.handled) {
      return simpleResponse;
    }

    // 3. Check if it's a template-based workout request
    const templateResponse = await this.handleTemplateQuery(normalizedQuery, context);
    if (templateResponse.handled) {
      return templateResponse;
    }

    return { handled: false, confidence: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async checkCache(query: string): Promise<CachedResponse | null> {
    // TODO: Implement when responseCache table is created
    // Check if we have a recent cached response
    // const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // const cached = await db.query.responseCache.findFirst({
    //   where: and(
    //     eq(responseCache.queryHash, this.hashQuery(query)),
    //     gte(responseCache.createdAt, oneHourAgo)
    //   )
    // });

    // if (cached) {
    //   return {
    //     query: cached.originalQuery,
    //     response: cached.response,
    //     toolCalls: cached.toolCalls ? JSON.parse(cached.toolCalls) : undefined,
    //     timestamp: cached.createdAt
    //   };
    // }

    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleSimpleQuery(query: string, context: any): Promise<LocalResponse> {
    // Handle common simple queries without API
    const responses: Record<string, string> = {
      'hello': "Hello! I'm your AI running coach. How can I help you with your training today?",
      'thanks': "You're welcome! Keep up the great training!",
      'bye': "Take care and happy running! Feel free to check in anytime.",
      'what is my vdot': `Your current VDOT is ${context.vdot || 'not set'}`,
      'what is my weekly mileage': `Your current weekly mileage target is ${context.currentWeeklyMileage || 'not set'} miles`,
      'what are my paces': this.formatPaces(context),
      'how many miles this week': 'Let me check your recent workouts... [Would need get_training_summary tool]'
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [pattern, _response] of Object.entries(responses)) {
      if (query.includes(pattern)) {
        // Some responses need tool calls
        if (response.includes('[Would need')) {
          return { handled: false, confidence: 0 };
        }

        return {
          handled: true,
          response,
          confidence: 1.0
        };
      }
    }

    return { handled: false, confidence: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleTemplateQuery(query: string, context: any): Promise<LocalResponse> {
    // Handle workout requests with templates
    if (!query.includes('workout') && !query.includes('run')) {
      return { handled: false, confidence: 0 };
    }

    // Check for specific workout types
    const workoutPatterns = {
      'easy run': { type: 'easy', defaultMiles: 5 },
      'tempo run': { type: 'tempo', defaultMiles: 6 },
      'long run': { type: 'long', defaultMiles: 10 },
      'recovery run': { type: 'recovery', defaultMiles: 3 },
      'tomorrow': { type: 'auto', useDate: 'tomorrow' }
    };

    for (const [pattern, config] of Object.entries(workoutPatterns)) {
      if (query.includes(pattern)) {
        if (pattern === 'tomorrow') {
          // This needs the API to check planned workouts
          return { handled: false, confidence: 0 };
        }

        // Use template for simple workout prescription
        const workout = this.generateWorkoutFromTemplate(config, context);
        return {
          handled: true,
          response: workout.description,
          confidence: 0.7 // Lower confidence for template-based responses
        };
      }
    }

    return { handled: false, confidence: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private generateWorkoutFromTemplate(config: any, context: any): any {
    const { type, defaultMiles } = config;
    const easyPace = this.formatPace(context.easyPaceSeconds || 540);
    const tempoPace = this.formatPace(context.tempoPaceSeconds || 420);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templates: Record<string, any> = {
      easy: {
        description: `Easy Run: ${defaultMiles} miles at ${easyPace} pace. Keep it conversational and relaxed. This builds your aerobic base.`
      },
      tempo: {
        description: `Tempo Run: 2 miles warmup, ${defaultMiles - 3} miles at ${tempoPace} pace, 1 mile cooldown. Tempo pace should feel "comfortably hard".`
      },
      long: {
        description: `Long Run: ${defaultMiles} miles at ${easyPace} to ${this.formatPace((context.easyPaceSeconds || 540) + 30)} pace. Focus on time on feet, not pace.`
      },
      recovery: {
        description: `Recovery Run: ${defaultMiles} miles at ${this.formatPace((context.easyPaceSeconds || 540) + 60)} pace or slower. This should feel very easy.`
      }
    };

    return templates[type] || templates.easy;
  }

  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim()
      .replace(/[.,!?]/g, '')
      .replace(/\s+/g, ' ');
  }

  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatPaces(context: any): string {
    const paces = [];
    if (context.easyPaceSeconds) paces.push(`Easy: ${this.formatPace(context.easyPaceSeconds)}`);
    if (context.tempoPaceSeconds) paces.push(`Tempo: ${this.formatPace(context.tempoPaceSeconds)}`);
    if (context.intervalPaceSeconds) paces.push(`Interval: ${this.formatPace(context.intervalPaceSeconds)}`);

    return paces.length > 0
      ? `Your training paces are: ${paces.join(', ')}`
      : "I don't have your pace information yet.";
  }

  private formatPace(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  }

  // Store successful responses for future use
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  async cacheResponse(query: string, response: string, toolCalls?: any[]): Promise<void> {
    // TODO: Implement when responseCache table is created
    // await db.insert(responseCache).values({
    //   queryHash: this.hashQuery(this.normalizeQuery(query)),
    //   originalQuery: query,
    //   response,
    //   _toolCalls: toolCalls ? JSON.stringify(toolCalls) : null,
    //   createdAt: new Date().toISOString()
    // });
  }
}