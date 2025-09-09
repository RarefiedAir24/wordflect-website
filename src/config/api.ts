// API Configuration for Wordflect
export const API_CONFIG = {
  // Base URL for the Wordflect API
  // For production, this should point to the actual deployed API
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.wordflect.com',
  
  // API Endpoints
  ENDPOINTS: {
    SIGNIN: '/signin', // Direct API call for testing
    SIGNUP: '/api/proxy-signup', // Use proxy to bypass CORS
    USER_PROFILE: '/api/proxy-profile', // Use proxy to bypass CORS
    USER_MISSIONS: '/api/proxy-missions', // Use proxy to bypass CORS
    USER_UPDATE_STATS: '/api/proxy-stats', // Use proxy to bypass CORS
    USER_COMPLETE_MISSION: '/api/proxy-complete-mission', // Use proxy to bypass CORS
    LEADERBOARD: '/api/proxy-leaderboard', // Use proxy to bypass CORS
    USER_FRAMES: '/api/proxy-frames', // Use proxy to bypass CORS
    WORD_OF_THE_DAY: '/api/proxy-word-of-the-day', // Use proxy to bypass CORS
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