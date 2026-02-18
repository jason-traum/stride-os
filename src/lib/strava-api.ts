/**
 * Enhanced Strava API client with proper rate limiting
 */

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

interface RateLimitInfo {
  limit15Min: number;
  usage15Min: number;
  limitDaily: number;
  usageDaily: number;
}

let lastRateLimit: RateLimitInfo | null = null;

/**
 * Parse rate limit headers from Strava response
 */
function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
  const parsePair = (value: string | null, fallbackA: number, fallbackB: number): [number, number] => {
    if (!value) return [fallbackA, fallbackB];
    const [first, second] = value.split(',').map((v) => parseInt(v.trim(), 10));
    return [
      Number.isFinite(first) ? first : fallbackA,
      Number.isFinite(second) ? second : fallbackB,
    ];
  };

  const [limit15Min, limitDaily] = parsePair(headers.get('X-RateLimit-Limit'), 200, 2000);
  const [usage15Min, usageDaily] = parsePair(headers.get('X-RateLimit-Usage'), 0, 0);

  return {
    limit15Min,
    usage15Min,
    limitDaily,
    usageDaily,
  };
}

function getRateLimitBackoffMs(response: Response, attempt: number): number {
  const retryAfterHeader = response.headers.get('Retry-After');
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 180_000);
    }
  }

  // Exponential backoff with a higher cap to survive temporary throttling windows.
  return Math.min(2000 * Math.pow(2, attempt), 120_000);
}

/**
 * Make a request to Strava API with rate limit handling
 */
export async function stravaFetch(
  endpoint: string,
  accessToken: string,
  options?: RequestInit
): Promise<Response> {
  const url = `${STRAVA_API_BASE}${endpoint}`;

  // Check if we're close to rate limit
  if (lastRateLimit) {
    const usage15MinPercent = (lastRateLimit.usage15Min / lastRateLimit.limit15Min) * 100;
    if (usage15MinPercent > 90) {
      console.warn(`[Strava API] Approaching 15-min rate limit: ${usage15MinPercent.toFixed(1)}%`);
      // Add preventive delay
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  let attempt = 0;
  const maxAttempts = 8;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      // Update rate limit info
      lastRateLimit = parseRateLimitHeaders(response.headers);

      // Log rate limit status

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        attempt++;
        const backoffMs = getRateLimitBackoffMs(response, attempt);
        console.warn(`[Strava API] Rate limited. Waiting ${backoffMs}ms before retry ${attempt}/${maxAttempts}`);

        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      // Handle other errors
      if (!response.ok && response.status !== 404) {
        console.error(`[Strava API] Error ${response.status} for ${endpoint}`);
      }

      return response;
    } catch (error) {
      attempt++;
      if (attempt >= maxAttempts) {
        throw error;
      }
      // Network error - exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.error(`[Strava API] Network error, retrying in ${backoffMs}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error(`Failed after ${maxAttempts} attempts`);
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(): RateLimitInfo | null {
  return lastRateLimit;
}

/**
 * Check if we should delay requests based on current usage
 */
export function shouldDelayRequest(): boolean {
  if (!lastRateLimit) return false;
  return (lastRateLimit.usage15Min / lastRateLimit.limit15Min) > 0.8;
}
