// API Configuration for Wordflect
export const API_CONFIG = {
  // Base URL for the Wordflect API
  // For production, this should point to the actual deployed API
  BASE_URL: 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod',
  
  // API Endpoints - Temporarily using direct API calls to bypass proxy issues
  ENDPOINTS: {
    SIGNIN: '/api/proxy-signin', // Keep proxy for auth
    SIGNUP: '/api/proxy-signup', // Keep proxy for auth
    USER_PROFILE: '/api/proxy-profile', // Keep proxy for auth
    USER_MISSIONS: '/api/proxy-missions', // Keep proxy for auth
    USER_UPDATE_STATS: '/api/proxy-stats', // Keep proxy for auth
    USER_COMPLETE_MISSION: '/api/proxy-complete-mission', // Keep proxy for auth
    LEADERBOARD: '/api/proxy-leaderboard', // Keep proxy for auth
    USER_FRAMES: '/api/proxy-frames', // Keep proxy for auth
    WORD_OF_THE_DAY: '/api/proxy-word-of-the-day', // Keep proxy for auth
    USER_HISTORY: '/user/history', // Direct API call
    USER_STATISTICS_DETAILED: '/user/statistics/detailed', // Direct API call
    USER_STATISTICS_DAILY: '/user/statistics/daily', // Direct API call
    USER_STATISTICS_WEEKLY: '/user/statistics/weekly', // Direct API call
    USER_STATISTICS_MONTHLY: '/user/statistics/monthly', // Direct API call
    USER_SESSION_TRACK: '/api/proxy-session-track', // Keep proxy for auth
    USER_SESSION_WORDS: '/user/session-words', // Direct API call
    USER_THEME_ANALYTICS: '/user/theme-analytics', // Direct API call
    USER_THEME_DAY: '/user/theme-day', // Direct API call
    USER_TIME_ANALYTICS: '/user/time-analytics', // Direct API call
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