import { Anthropic } from '@anthropic-ai/sdk';

interface QueryClassification {
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  category: string;
  requiredExpertise: string[];
  suggestedModel: string;
  estimatedCost: number;
}

export class OlympicCoachRouter {
  // Models with their capabilities and costs
  private readonly MODELS = {
    HAIKU: {
      id: 'claude-3-haiku-20240307',
      capabilities: ['basic_queries', 'simple_workouts', 'pace_calculations'],
      costPerMillion: { input: 0.25, output: 1.25 },
      maxComplexity: 'simple'
    },
    SONNET: {
      id: 'claude-3-5-sonnet-20241022',
      capabilities: ['workout_prescription', 'training_analysis', 'injury_guidance'],
      costPerMillion: { input: 3, output: 15 },
      maxComplexity: 'moderate'
    },
    OPUS: {
      id: 'claude-3-opus-20240229',
      capabilities: ['expert_planning', 'biomechanics', 'periodization', 'race_strategy'],
      costPerMillion: { input: 15, output: 75 },
      maxComplexity: 'expert'
    }
  };

  // Classify query and route to appropriate model
  classifyAndRoute(query: string, context: any): QueryClassification {
    const classification = this.analyzeQuery(query, context);

    // Route based on complexity and required expertise
    let suggestedModel = this.MODELS.HAIKU.id;

    if (classification.complexity === 'expert' ||
        classification.requiredExpertise.includes('periodization') ||
        classification.requiredExpertise.includes('biomechanics')) {
      suggestedModel = this.MODELS.OPUS.id;
    } else if (classification.complexity === 'complex' ||
               classification.requiredExpertise.includes('injury_analysis') ||
               classification.requiredExpertise.includes('race_planning')) {
      suggestedModel = this.MODELS.SONNET.id;
    }

    return {
      ...classification,
      suggestedModel,
      estimatedCost: this.estimateCost(suggestedModel, query.length)
    };
  }

  private analyzeQuery(query: string, context: any): Omit<QueryClassification, 'suggestedModel' | 'estimatedCost'> {
    const lower = query.toLowerCase();
    const requiredExpertise: string[] = [];

    // Check for Olympic-level expertise requirements
    if (lower.includes('periodiz') || lower.includes('macrocycle') || lower.includes('mesocycle')) {
      requiredExpertise.push('periodization');
    }
    if (lower.includes('biomechan') || lower.includes('form') || lower.includes('gait')) {
      requiredExpertise.push('biomechanics');
    }
    if (lower.includes('lactate') || lower.includes('vo2') || lower.includes('threshold')) {
      requiredExpertise.push('exercise_physiology');
    }
    if (lower.includes('taper') || lower.includes('peak') || lower.includes('race strategy')) {
      requiredExpertise.push('race_planning');
    }
    if (lower.includes('injury') && (lower.includes('prevent') || lower.includes('rehab'))) {
      requiredExpertise.push('injury_analysis');
    }
    if (lower.includes('nutrition') || lower.includes('fuel') || lower.includes('hydration')) {
      requiredExpertise.push('sports_nutrition');
    }
    if (lower.includes('mental') || lower.includes('psychology') || lower.includes('motivation')) {
      requiredExpertise.push('sports_psychology');
    }

    // Determine complexity
    let complexity: 'simple' | 'moderate' | 'complex' | 'expert' = 'simple';

    if (requiredExpertise.length >= 2 || lower.includes('analyze') || lower.includes('design')) {
      complexity = 'expert';
    } else if (requiredExpertise.length === 1 || lower.includes('plan') || lower.includes('adjust')) {
      complexity = 'complex';
    } else if (lower.includes('workout') || lower.includes('pace') || lower.includes('schedule')) {
      complexity = 'moderate';
    }

    // Categorize the query
    let category = 'general';
    if (lower.includes('workout') || lower.includes('training')) category = 'training';
    if (lower.includes('race') || lower.includes('competition')) category = 'racing';
    if (lower.includes('injury') || lower.includes('pain')) category = 'injury';
    if (lower.includes('nutrition') || lower.includes('diet')) category = 'nutrition';
    if (lower.includes('form') || lower.includes('technique')) category = 'biomechanics';

    return {
      complexity,
      category,
      requiredExpertise
    };
  }

  private estimateCost(modelId: string, queryLength: number): number {
    const model = Object.values(this.MODELS).find(m => m.id === modelId);
    if (!model) return 0;

    // Rough estimate based on query length
    const estimatedTokens = queryLength / 4;
    const inputCost = (estimatedTokens / 1000000) * model.costPerMillion.input;
    const outputCost = (500 / 1000000) * model.costPerMillion.output; // Assume 500 token response

    return Math.round((inputCost + outputCost) * 10000) / 10000;
  }

  // Get specialized prompt based on expertise needed
  getExpertPrompt(expertise: string[]): string {
    const expertPrompts: Record<string, string> = {
      periodization: `
You are an expert in training periodization with deep knowledge of:
- Macrocycle, mesocycle, and microcycle planning
- Base, build, peak, and taper phases
- Supercompensation theory
- Training stress balance (TSB)
- Progressive overload principles`,

      biomechanics: `
You are a biomechanics expert specializing in running form:
- Gait analysis and correction
- Running economy optimization
- Injury prevention through form improvement
- Cadence and stride length optimization
- Force production and elastic recoil`,

      exercise_physiology: `
You are an exercise physiologist with expertise in:
- Lactate threshold and VO2max training
- Energy system development
- Mitochondrial adaptations
- Muscle fiber type considerations
- Altitude training effects`,

      race_planning: `
You are a race strategy expert focusing on:
- Optimal pacing strategies
- Tapering protocols
- Race day nutrition and hydration
- Mental preparation
- Environmental considerations`,

      injury_analysis: `
You are a sports medicine specialist with knowledge of:
- Common running injuries and their causes
- Load management and progression
- Return-to-running protocols
- Prehabilitation exercises
- When to seek medical attention`,

      sports_nutrition: `
You are a sports nutritionist specializing in endurance athletes:
- Daily nutrition for training adaptations
- Pre/during/post workout fueling
- Hydration strategies
- Supplement considerations
- Race day nutrition planning`,

      sports_psychology: `
You are a sports psychologist working with elite runners:
- Mental toughness development
- Visualization techniques
- Goal setting and motivation
- Managing pre-race anxiety
- Building confidence through training`
    };

    // Combine relevant expert prompts
    const relevantPrompts = expertise
      .map(exp => expertPrompts[exp])
      .filter(Boolean)
      .join('\n');

    return relevantPrompts || 'You are an experienced running coach.';
  }
}