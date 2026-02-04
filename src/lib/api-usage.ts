import { db } from './db';
import { apiUsageLogs, type NewApiUsageLog } from './schema';
import { type ApiService } from './schema-enums';
import { desc, eq, gte } from 'drizzle-orm';

/**
 * Log an API call for usage tracking
 */
export async function logApiUsage(log: Omit<NewApiUsageLog, 'id' | 'createdAt'>) {
  try {
    await db.insert(apiUsageLogs).values({
      ...log,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // Don't let logging failures break the app
    console.error('[API Usage] Failed to log:', error);
  }
}

/**
 * Helper to time an API call and log it
 */
export async function trackApiCall<T>(
  service: ApiService,
  endpoint: string,
  method: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();
  let statusCode: number | undefined;
  let errorMessage: string | undefined;

  try {
    const result = await fn();
    statusCode = 200; // Assume success if no error
    return result;
  } catch (error: unknown) {
    // Try to extract status code from error
    if (error && typeof error === 'object' && 'status' in error) {
      statusCode = (error as { status: number }).status;
    }
    errorMessage = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    const responseTimeMs = Date.now() - startTime;
    await logApiUsage({
      service,
      endpoint,
      method,
      statusCode,
      responseTimeMs,
      errorMessage,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });
  }
}

/**
 * Log Anthropic API usage with token counts
 */
export async function logAnthropicUsage(params: {
  endpoint: string;
  inputTokens: number;
  outputTokens: number;
  model?: string;
  responseTimeMs?: number;
  error?: string;
}) {
  await logApiUsage({
    service: 'anthropic',
    endpoint: params.endpoint,
    method: 'POST',
    statusCode: params.error ? 500 : 200,
    responseTimeMs: params.responseTimeMs,
    tokensUsed: params.inputTokens + params.outputTokens,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    errorMessage: params.error,
    metadata: params.model ? JSON.stringify({ model: params.model }) : undefined,
  });
}

/**
 * Get API usage statistics
 */
export async function getApiUsageStats(daysBack: number = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = cutoff.toISOString();

  // Get all logs within the period
  const logs = await db.query.apiUsageLogs.findMany({
    where: gte(apiUsageLogs.createdAt, cutoffStr),
    orderBy: [desc(apiUsageLogs.createdAt)],
  });

  // Aggregate by service
  const byService: Record<ApiService, {
    totalCalls: number;
    successCalls: number;
    errorCalls: number;
    avgResponseTime: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    rateLimitHits: number;
  }> = {
    strava: { totalCalls: 0, successCalls: 0, errorCalls: 0, avgResponseTime: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, rateLimitHits: 0 },
    anthropic: { totalCalls: 0, successCalls: 0, errorCalls: 0, avgResponseTime: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, rateLimitHits: 0 },
    intervals: { totalCalls: 0, successCalls: 0, errorCalls: 0, avgResponseTime: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, rateLimitHits: 0 },
    open_meteo: { totalCalls: 0, successCalls: 0, errorCalls: 0, avgResponseTime: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, rateLimitHits: 0 },
  };

  const responseTimes: Record<ApiService, number[]> = {
    strava: [],
    anthropic: [],
    intervals: [],
    open_meteo: [],
  };

  for (const log of logs) {
    const service = log.service as ApiService;
    byService[service].totalCalls++;

    if (log.statusCode === 429) {
      byService[service].rateLimitHits++;
      byService[service].errorCalls++;
    } else if (log.statusCode && log.statusCode >= 200 && log.statusCode < 300) {
      byService[service].successCalls++;
    } else if (log.errorMessage) {
      byService[service].errorCalls++;
    } else {
      byService[service].successCalls++;
    }

    if (log.responseTimeMs) {
      responseTimes[service].push(log.responseTimeMs);
    }

    if (log.tokensUsed) byService[service].totalTokens += log.tokensUsed;
    if (log.inputTokens) byService[service].inputTokens += log.inputTokens;
    if (log.outputTokens) byService[service].outputTokens += log.outputTokens;
  }

  // Calculate averages
  for (const service of Object.keys(byService) as ApiService[]) {
    const times = responseTimes[service];
    if (times.length > 0) {
      byService[service].avgResponseTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    }
  }

  // Get daily breakdown
  const dailyBreakdown: Record<string, Record<ApiService, number>> = {};
  for (const log of logs) {
    const day = log.createdAt.split('T')[0];
    if (!dailyBreakdown[day]) {
      dailyBreakdown[day] = { strava: 0, anthropic: 0, intervals: 0, open_meteo: 0 };
    }
    dailyBreakdown[day][log.service as ApiService]++;
  }

  // Recent logs (last 50)
  const recentLogs = logs.slice(0, 50);

  return {
    period: { days: daysBack, from: cutoffStr, to: new Date().toISOString() },
    byService,
    dailyBreakdown,
    recentLogs,
    totalCalls: logs.length,
  };
}

/**
 * Get Strava rate limit status (rough estimate based on recent calls)
 */
export async function getStravaRateLimitStatus() {
  const fifteenMinAgo = new Date();
  fifteenMinAgo.setMinutes(fifteenMinAgo.getMinutes() - 15);

  const recentCalls = await db.query.apiUsageLogs.findMany({
    where: eq(apiUsageLogs.service, 'strava'),
  });

  const last15Min = recentCalls.filter(
    log => new Date(log.createdAt) >= fifteenMinAgo
  );

  const today = new Date().toISOString().split('T')[0];
  const todayCalls = recentCalls.filter(
    log => log.createdAt.startsWith(today)
  );

  return {
    last15Minutes: last15Min.length,
    limit15Minutes: 100,
    remaining15Minutes: Math.max(0, 100 - last15Min.length),
    todayCalls: todayCalls.length,
    dailyLimit: 1000,
    remainingDaily: Math.max(0, 1000 - todayCalls.length),
    rateLimitHits: last15Min.filter(l => l.statusCode === 429).length,
  };
}
