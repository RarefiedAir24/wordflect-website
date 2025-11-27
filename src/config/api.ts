// API Configuration for Wordflect - CACHE BUST v4
export const API_CONFIG = {
  // Base URL for the Wordflect API
  // For production, this should point to the actual deployed API
  BASE_URL: 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod',
  
  // API Endpoints - Using proxy routes to bypass CORS
  ENDPOINTS: {
    SIGNIN: '/api/proxy-signin', // Use proxy to bypass CORS
    SIGNUP: '/api/proxy-signup', // Use proxy to bypass CORS
    USER_PROFILE: '/api/proxy-profile', // Use proxy to bypass CORS
    USER_MISSIONS: '/api/proxy-missions', // Use proxy to bypass CORS
    USER_UPDATE_STATS: '/api/proxy-stats', // Use proxy to bypass CORS
    USER_COMPLETE_MISSION: '/api/proxy-complete-mission', // Use proxy to bypass CORS
    LEADERBOARD: '/api/proxy-leaderboard', // Use proxy to bypass CORS
    USER_FRAMES: '/api/proxy-frames', // Use proxy to bypass CORS
    WORD_OF_THE_DAY: '/api/proxy-word-of-the-day', // Use proxy to bypass CORS
    USER_HISTORY: '/api/proxy-history', // Historical stats (proxy OK)
    // Switch these two to direct backend URLs to avoid proxy 403s
    USER_STATISTICS_DETAILED: '/user/statistics/detailed',
    USER_STATISTICS_DAILY: '/api/proxy-statistics-daily', // keep proxy
    USER_STATISTICS_WEEKLY: '/api/proxy-statistics-weekly', // keep proxy
    USER_STATISTICS_MONTHLY: '/api/proxy-statistics-monthly', // keep proxy
    USER_SESSION_TRACK: '/api/proxy-session-track', // Session tracking
    USER_SESSION_WORDS: '/api/proxy-session-words', // Session words data - proxy call with timezone support
    USER_THEME_ANALYTICS: '/api/proxy-theme-analytics', // Theme word analytics
    USER_THEME_DAY: '/api/proxy-theme-day', // Daily theme statistics
    USER_TIME_ANALYTICS: '/user/time/analytics', // Time analytics - direct backend call (was working)
  },
  
  // Request timeout in milliseconds
  TIMEOUT: 10000,
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000,
  }
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  // If it's a proxy route (starts with /api/), don't add the base URL
  if (endpoint.startsWith('/api/')) {
    return endpoint;
  }
  // Use direct API URL for production
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}; 