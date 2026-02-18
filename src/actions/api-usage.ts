'use server';

import { db } from '@/lib/db';
import { apiUsageLogs, profiles } from '@/lib/schema';
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

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4 },
};
const DEFAULT_PRICING = { input: 3, output: 15 };

function computeCostUsd(log: {
  inputTokens: number | null;
  outputTokens: number | null;
  metadata: string | null;
}): { model: string; cost: number; profileId?: number } {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = log.metadata ? JSON.parse(log.metadata) as Record<string, unknown> : {};
  } catch {
    metadata = {};
  }

  const model = typeof metadata.model === 'string' ? metadata.model : 'unknown';
  const profileId = typeof metadata.profileId === 'number' ? metadata.profileId : undefined;
  const estimatedCost = typeof metadata.estimatedCost === 'number' ? metadata.estimatedCost : 0;

  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
  const hasTokenData = (log.inputTokens || 0) > 0 || (log.outputTokens || 0) > 0;
  const cost = hasTokenData
    ? ((log.inputTokens || 0) / 1_000_000) * pricing.input +
      ((log.outputTokens || 0) / 1_000_000) * pricing.output
    : estimatedCost;

  return { model, cost, profileId };
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

  logs.forEach(log => {
    const date = new Date(log.createdAt).toISOString().split('T')[0];
    const tokens = log.tokensUsed || 0;
    const { model, cost } = computeCostUsd(log);

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

export interface UserModelCostBreakdown {
  period: { days: number; from: string; to: string };
  totals: { cost: number; requests: number; tokens: number };
  byProfile: Array<{
    profileId: number | null;
    profileName: string;
    cost: number;
    requests: number;
    tokens: number;
    byModel: Array<{
      model: string;
      cost: number;
      requests: number;
      tokens: number;
    }>;
  }>;
}

export async function getUserModelCostBreakdown(days: number = 30): Promise<UserModelCostBreakdown> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [logs, profileRows] = await Promise.all([
    db
      .select()
      .from(apiUsageLogs)
      .where(
        and(
          eq(apiUsageLogs.service, 'anthropic'),
          gte(apiUsageLogs.createdAt, startDate.toISOString()),
          lte(apiUsageLogs.createdAt, endDate.toISOString())
        )
      )
      .orderBy(desc(apiUsageLogs.createdAt)),
    db.select().from(profiles),
  ]);

  const profileNameById = new Map<number, string>();
  for (const p of profileRows) {
    profileNameById.set(p.id, p.name);
  }

  const grouped = new Map<string, {
    profileId: number | null;
    profileName: string;
    cost: number;
    requests: number;
    tokens: number;
    byModel: Map<string, { cost: number; requests: number; tokens: number }>;
  }>();

  let totalCost = 0;
  let totalRequests = 0;
  let totalTokens = 0;

  for (const log of logs) {
    const { model, cost, profileId } = computeCostUsd(log);
    const tokens = log.tokensUsed || 0;
    const key = String(profileId ?? 'unknown');

    if (!grouped.has(key)) {
      grouped.set(key, {
        profileId: profileId ?? null,
        profileName: profileId ? (profileNameById.get(profileId) || `Profile ${profileId}`) : 'Unattributed',
        cost: 0,
        requests: 0,
        tokens: 0,
        byModel: new Map(),
      });
    }

    const profileGroup = grouped.get(key)!;
    profileGroup.cost += cost;
    profileGroup.requests += 1;
    profileGroup.tokens += tokens;

    if (!profileGroup.byModel.has(model)) {
      profileGroup.byModel.set(model, { cost: 0, requests: 0, tokens: 0 });
    }
    const modelGroup = profileGroup.byModel.get(model)!;
    modelGroup.cost += cost;
    modelGroup.requests += 1;
    modelGroup.tokens += tokens;

    totalCost += cost;
    totalRequests += 1;
    totalTokens += tokens;
  }

  const byProfile = Array.from(grouped.values())
    .map((g) => ({
      profileId: g.profileId,
      profileName: g.profileName,
      cost: g.cost,
      requests: g.requests,
      tokens: g.tokens,
      byModel: Array.from(g.byModel.entries())
        .map(([model, stats]) => ({ model, ...stats }))
        .sort((a, b) => b.cost - a.cost),
    }))
    .sort((a, b) => b.cost - a.cost);

  return {
    period: {
      days,
      from: startDate.toISOString(),
      to: endDate.toISOString(),
    },
    totals: {
      cost: totalCost,
      requests: totalRequests,
      tokens: totalTokens,
    },
    byProfile,
  };
}
