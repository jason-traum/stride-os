'use server';

import { db } from '@/lib/db';
import { apiUsageLogs } from '@/lib/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

interface LogApiUsageParams {
  profileId?: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  estimatedCost: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export async function logApiUsage({
  profileId,
  model,
  inputTokens,
  outputTokens,
  toolCalls,
  estimatedCost,
  metadata = {}
}: LogApiUsageParams) {
  try {
    await db.insert(apiUsageLogs).values({
      service: 'anthropic',
      endpoint: 'messages.create',
      method: 'POST',
      statusCode: 200,
      inputTokens,
      outputTokens,
      tokensUsed: inputTokens + outputTokens,
      metadata: JSON.stringify({
        ...metadata,
        model,
        toolCalls,
        profileId,
        estimatedCost
      }),
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log API usage:', error);
    // Don't throw - we don't want logging failures to break the app
  }
}

export interface ApiUsageStats {
  daily: Array<{
    date: string;
    totalCost: number;
    totalTokens: number;
    requestCount: number;
    byModel: Record<string, {
      cost: number;
      tokens: number;
      requests: number;
    }>;
  }>;
  weeklyTotal: {
    cost: number;
    tokens: number;
    requests: number;
  };
  monthlyTotal: {
    cost: number;
    tokens: number;
    requests: number;
  };
}

export async function getApiUsageStats(days: number = 30): Promise<ApiUsageStats> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get all Anthropic API usage logs
  const logs = await db
    .select()
    .from(apiUsageLogs)
    .where(
      and(
        eq(apiUsageLogs.service, 'anthropic'),
        gte(apiUsageLogs.createdAt, startDate.toISOString()),
        lte(apiUsageLogs.createdAt, endDate.toISOString())
      )
    )
    .orderBy(desc(apiUsageLogs.createdAt));

  // Process logs into daily stats
  const dailyStats = new Map<string, {
    totalCost: number;
    totalTokens: number;
    requestCount: number;
    byModel: Record<string, {
      cost: number;
      tokens: number;
      requests: number;
    }>;
  }>();

  const weeklyTotal = { cost: 0, tokens: 0, requests: 0 };
  const monthlyTotal = { cost: 0, tokens: 0, requests: 0 };

  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  // Model pricing for cost calculation from actual tokens
  const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-20250514': { input: 3, output: 15 },
    'claude-opus-4-20250514': { input: 15, output: 75 },
    'claude-haiku-3-5-20241022': { input: 0.8, output: 4 },
  };
  const DEFAULT_PRICING = { input: 3, output: 15 }; // Sonnet as default

  logs.forEach(log => {
    const date = new Date(log.createdAt).toISOString().split('T')[0];
    const metadata = log.metadata ? JSON.parse(log.metadata) : {};
    const tokens = log.tokensUsed || 0;
    const model = metadata.model || 'unknown';

    // Calculate cost from actual stored tokens + model pricing (prefer real tokens over estimates)
    const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
    const cost = (log.inputTokens || log.outputTokens)
      ? ((log.inputTokens || 0) / 1_000_000) * pricing.input +
        ((log.outputTokens || 0) / 1_000_000) * pricing.output
      : (metadata.estimatedCost || 0);

    // Update daily stats
    if (!dailyStats.has(date)) {
      dailyStats.set(date, {
        totalCost: 0,
        totalTokens: 0,
        requestCount: 0,
        byModel: {}
      });
    }

    const dayStats = dailyStats.get(date)!;
    dayStats.totalCost += cost;
    dayStats.totalTokens += tokens;
    dayStats.requestCount += 1;

    if (!dayStats.byModel[model]) {
      dayStats.byModel[model] = { cost: 0, tokens: 0, requests: 0 };
    }
    dayStats.byModel[model].cost += cost;
    dayStats.byModel[model].tokens += tokens;
    dayStats.byModel[model].requests += 1;

    // Update weekly/monthly totals
    const logDate = new Date(log.createdAt);
    if (logDate >= oneWeekAgo) {
      weeklyTotal.cost += cost;
      weeklyTotal.tokens += tokens;
      weeklyTotal.requests += 1;
    }
    if (logDate >= oneMonthAgo) {
      monthlyTotal.cost += cost;
      monthlyTotal.tokens += tokens;
      monthlyTotal.requests += 1;
    }
  });

  // Convert map to sorted array
  const daily = Array.from(dailyStats.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    daily,
    weeklyTotal,
    monthlyTotal
  };
}