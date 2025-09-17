// API Configuration for Wordflect
export const API_CONFIG = {
  // Base URL for the Wordflect API
  // For production, this should point to the actual deployed API
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod',
  
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
    USER_HISTORY: '/api/proxy-history', // Historical stats
    USER_STATISTICS_DETAILED: '/api/proxy-statistics-detailed', // Comprehensive user statistics
    USER_STATISTICS_DAILY: '/api/proxy-statistics-daily', // Daily statistics
    USER_STATISTICS_WEEKLY: '/api/proxy-statistics-weekly', // Weekly statistics
    USER_STATISTICS_MONTHLY: '/api/proxy-statistics-monthly', // Monthly statistics
    USER_SESSION_TRACK: '/api/proxy-session-track', // Session tracking
    USER_THEME_ANALYTICS: '/api/proxy-theme-analytics', // Theme word analytics
    USER_THEME_DAY: '/api/proxy-theme-day', // Daily theme statistics
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