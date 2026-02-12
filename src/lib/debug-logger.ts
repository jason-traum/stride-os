/**
 * Debug logger that only logs in development
 */

const isDev = process.env.NODE_ENV === 'development';

export const debugLog = {
  info: (...args: any[]) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },

  error: (...args: any[]) => {
    if (isDev) {
      console.error('[DEBUG ERROR]', ...args);
    }
  },

  warn: (...args: any[]) => {
    if (isDev) {
      console.warn('[DEBUG WARN]', ...args);
    }
  },

  stream: (event: string, data: any) => {
    if (isDev) {
      console.log(`[STREAM ${event}]`, data);
    }
  },

  api: (method: string, endpoint: string, data?: any) => {
    if (isDev) {
      console.log(`[API ${method}] ${endpoint}`, data);
    }
  },

  db: (operation: string, table: string, data?: any) => {
    if (isDev) {
      console.log(`[DB ${operation}] ${table}`, data);
    }
  }
};