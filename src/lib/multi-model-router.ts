/**
 * Multi-Model Router for Cost Optimization
 *
 * Routes requests to appropriate Claude models based on complexity:
 * - Haiku: Simple queries, logging, basic information ($0.25/M tokens)
 * - Sonnet: Standard coaching, workout prescriptions ($3/M tokens)
 * - Opus: Complex analysis, planning, expert knowledge ($15/M tokens)
 */

export interface ModelSelection {
  model: string;
  reasoning: string[];
  estimatedTokens: { input: number; output: number };
  estimatedCost: number;
  complexity: 'simple' | 'moderate' | 'complex';
}

export class MultiModelRouter {
  // Updated Claude model IDs and costs
  private readonly MODELS = {
    HAIKU: {
      id: 'claude-sonnet-4-20250514',  // Using Sonnet for simple queries until Haiku is available
      name: 'Sonnet 4 (Simple)',
      costPerMillion: { input: 3, output: 15 },  // Sonnet pricing
      capabilities: [
        'basic_queries',
        'simple_workouts',
        'logging',
        'pace_calculations',
        'greetings',
        'simple_questions'
      ]
    },
    SONNET: {
      id: 'claude-sonnet-4-20250514',
      name: 'Sonnet 4',
      costPerMillion: { input: 3, output: 15 },
      capabilities: [
        'workout_prescription',
        'training_analysis',
        'weekly_reviews',
        'plan_adjustments',
        'injury_guidance',
        'standard_coaching'
      ]
    },
    OPUS: {
      id: 'claude-opus-4-20250514',
      name: 'Opus 4',
      costPerMillion: { input: 15, output: 75 },
      capabilities: [
        'complex_analysis',
        'race_planning',
        'periodization',
        'biomechanics',
        'comprehensive_reviews',
        'expert_coaching'
      ]
    }
  };

  /**
   * Analyze the request and select appropriate model
   */
  selectModel(
    message: string,
    toolsUsed: string[],
    conversationLength: number,
    userPreference?: string
  ): ModelSelection {
    const reasoning: string[] = [];

    // Respect user preference if specified
    if (userPreference) {
      const model = this.getModelByPreference(userPreference);
      if (model) {
        reasoning.push(`User requested ${userPreference} model`);
        return this.createModelSelection(model.id, reasoning, message, 'moderate');
      }
    }

    // Check for tool usage patterns
    const toolComplexity = this.analyzeToolComplexity(toolsUsed);

    // Analyze message content
    const messageAnalysis = this.analyzeMessage(message);

    // Consider conversation context
    const contextComplexity = conversationLength > 20 ? 'complex' :
                             conversationLength > 10 ? 'moderate' : 'simple';

    // Decision logic
    let selectedModel = this.MODELS.HAIKU.id;
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';

    // Route to Haiku for simple cases
    if (this.isSimpleQuery(message, toolsUsed, messageAnalysis)) {
      reasoning.push('Simple query detected - using Haiku');
      reasoning.push(`Message type: ${messageAnalysis.type}`);
    }
    // Route to Opus for complex cases
    else if (this.requiresExpertise(message, toolsUsed, messageAnalysis, toolComplexity)) {
      selectedModel = this.MODELS.OPUS.id;
      complexity = 'complex';
      reasoning.push('Complex analysis required - using Opus');
      reasoning.push(`Expertise needed: ${messageAnalysis.expertiseRequired.join(', ')}`);
    }
    // Default to Sonnet for standard coaching
    else {
      selectedModel = this.MODELS.SONNET.id;
      complexity = 'moderate';
      reasoning.push('Standard coaching query - using Sonnet');
      reasoning.push(`Tools used: ${toolsUsed.length > 0 ? toolsUsed.join(', ') : 'none'}`);
    }

    // Add context consideration
    if (contextComplexity === 'complex' && selectedModel === this.MODELS.HAIKU.id) {
      selectedModel = this.MODELS.SONNET.id;
      complexity = 'moderate';
      reasoning.push('Upgraded to Sonnet due to long conversation context');
    }

    return this.createModelSelection(selectedModel, reasoning, message, complexity);
  }

  /**
   * Check if query is simple enough for Haiku
   */
  private isSimpleQuery(
    message: string,
    toolsUsed: string[],
    analysis: MessageAnalysis
  ): boolean {
    // Simple greetings and thanks
    if (analysis.type === 'greeting' || analysis.type === 'thanks') {
      return true;
    }

    // Simple logging (when tools do the work)
    if (analysis.type === 'logging' && toolsUsed.includes('log_workout')) {
      return true;
    }

    // Basic pace calculations
    if (analysis.type === 'pace_calc' && !analysis.requiresAnalysis) {
      return true;
    }

    // Simple information queries
    if (analysis.type === 'info_query' && toolsUsed.length === 1) {
      return true;
    }

    return false;
  }

  /**
   * Check if query requires Opus expertise
   */
  private requiresExpertise(
    message: string,
    toolsUsed: string[],
    analysis: MessageAnalysis,
    toolComplexity: string
  ): boolean {
    // Multiple complex tools
    if (toolComplexity === 'complex') {
      return true;
    }

    // Requires specific expertise
    if (analysis.expertiseRequired.length >= 2) {
      return true;
    }

    // Complex analysis or planning
    if (analysis.type === 'complex_analysis' || analysis.type === 'race_planning') {
      return true;
    }

    // Keywords that indicate complexity
    const complexKeywords = [
      'analyze my training',
      'comprehensive review',
      'periodization',
      'biomechanics',
      'race strategy',
      'injury analysis',
      'plateau',
      'not improving',
      'overtraining'
    ];

    const lowerMessage = message.toLowerCase();
    return complexKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Analyze message content
   */
  private analyzeMessage(message: string): MessageAnalysis {
    const lower = message.toLowerCase();
    const analysis: MessageAnalysis = {
      type: 'general',
      expertiseRequired: [],
      requiresAnalysis: false
    };

    // Determine message type
    if (lower.match(/^(hi|hello|hey|good morning|good afternoon)/)) {
      analysis.type = 'greeting';
    } else if (lower.includes('thank') || lower.includes('bye')) {
      analysis.type = 'thanks';
    } else if (lower.includes('log') || lower.includes('did') || lower.includes('ran')) {
      analysis.type = 'logging';
    } else if (lower.includes('pace') && (lower.includes('calculate') || lower.includes('what is'))) {
      analysis.type = 'pace_calc';
    } else if (lower.includes('workout') || lower.includes('run today') || lower.includes('should i do')) {
      analysis.type = 'workout_request';
    } else if (lower.includes('analyze') || lower.includes('review')) {
      analysis.type = 'complex_analysis';
      analysis.requiresAnalysis = true;
    } else if (lower.includes('race') && (lower.includes('plan') || lower.includes('strategy'))) {
      analysis.type = 'race_planning';
    } else if (lower.includes('?')) {
      analysis.type = 'info_query';
    }

    // Check expertise requirements
    if (lower.includes('biomechan') || lower.includes('form') || lower.includes('gait')) {
      analysis.expertiseRequired.push('biomechanics');
    }
    if (lower.includes('periodiz') || lower.includes('macrocycle') || lower.includes('mesocycle')) {
      analysis.expertiseRequired.push('periodization');
    }
    if (lower.includes('lactate') || lower.includes('vo2') || lower.includes('threshold')) {
      analysis.expertiseRequired.push('exercise_physiology');
    }
    if (lower.includes('injury') && (lower.includes('prevent') || lower.includes('rehab'))) {
      analysis.expertiseRequired.push('injury_prevention');
    }

    return analysis;
  }

  /**
   * Analyze complexity of tools being used
   */
  private analyzeToolComplexity(toolsUsed: string[]): string {
    const complexTools = [
      'get_fitness_trend',
      'analyze_recovery_pattern',
      'get_training_load',
      'compare_workouts',
      'get_race_day_plan',
      'suggest_plan_adjustment'
    ];

    const simpleTools = [
      'log_workout',
      'log_assessment',
      'get_recent_workouts',
      'get_user_settings'
    ];

    const complexToolCount = toolsUsed.filter(tool => complexTools.includes(tool)).length;
    const totalTools = toolsUsed.length;

    if (complexToolCount >= 2 || totalTools >= 5) {
      return 'complex';
    } else if (complexToolCount === 1 || totalTools >= 3) {
      return 'moderate';
    } else {
      return 'simple';
    }
  }

  /**
   * Create model selection response
   */
  private createModelSelection(
    modelId: string,
    reasoning: string[],
    message: string,
    complexity: 'simple' | 'moderate' | 'complex'
  ): ModelSelection {
    const model = Object.values(this.MODELS).find(m => m.id === modelId)!;

    // Estimate tokens (rough approximation)
    const inputTokens = Math.ceil((message.length + 2000) / 4); // Include system prompt
    const outputTokens = complexity === 'simple' ? 200 :
                        complexity === 'moderate' ? 500 : 1000;

    const cost = (inputTokens / 1_000_000) * model.costPerMillion.input +
                 (outputTokens / 1_000_000) * model.costPerMillion.output;

    return {
      model: modelId,
      reasoning,
      estimatedTokens: { input: inputTokens, output: outputTokens },
      estimatedCost: Math.round(cost * 10000) / 10000,
      complexity
    };
  }

  /**
   * Get model by user preference
   */
  private getModelByPreference(preference: string): typeof this.MODELS.HAIKU | null {
    const pref = preference.toLowerCase();
    if (pref.includes('haiku') || pref.includes('cheap') || pref.includes('fast')) {
      return this.MODELS.HAIKU;
    } else if (pref.includes('opus') || pref.includes('best') || pref.includes('expert')) {
      return this.MODELS.OPUS;
    } else if (pref.includes('sonnet') || pref.includes('standard')) {
      return this.MODELS.SONNET;
    }
    return null;
  }

  /**
   * Get cost savings compared to always using Opus
   */
  getCostSavings(modelId: string): number {
    const model = Object.values(this.MODELS).find(m => m.id === modelId);
    const opus = this.MODELS.OPUS;

    if (!model || model.id === opus.id) return 0;

    const modelAvgCost = (model.costPerMillion.input + model.costPerMillion.output) / 2;
    const opusAvgCost = (opus.costPerMillion.input + opus.costPerMillion.output) / 2;

    return Math.round((1 - modelAvgCost / opusAvgCost) * 100);
  }
}

interface MessageAnalysis {
  type: 'greeting' | 'thanks' | 'logging' | 'pace_calc' | 'workout_request' |
        'complex_analysis' | 'race_planning' | 'info_query' | 'general';
  expertiseRequired: string[];
  requiresAnalysis: boolean;
}