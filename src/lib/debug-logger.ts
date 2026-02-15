/**
 * Debug logger that only logs in development
 */

const isDev = process.env.NODE_ENV === 'development';

export const debugLog = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (...args: any[]) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) => {
    if (isDev) {
      console.error('[DEBUG ERROR]', ...args);
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn('[DEBUG WARN]', ...args);
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stream: (event: string, data: any) => {
    if (isDev) {
      console.log(`[STREAM ${event}]`, data);
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api: (method: string, endpoint: string, data?: any) => {
    if (isDev) {
      console.log(`[API ${method}] ${endpoint}`, data);
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: (operation: string, table: string, data?: any) => {
    if (isDev) {
      console.log(`[DB ${operation}] ${table}`, data);
    }
  }
};