// API Configuration for Wordflect
export const API_CONFIG = {
  // Base URL for the Wordflect API
  // For production, this should point to the actual deployed API
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.wordflect.com',
  
  // API Endpoints
  ENDPOINTS: {
    SIGNIN: '/signin', // Direct API call
    SIGNUP: '/signup', // Direct API call
    USER_PROFILE: '/user/profile', // Direct API call
    USER_MISSIONS: '/user/missions', // Direct API call
    USER_UPDATE_STATS: '/user/update-stats', // Direct API call
    USER_COMPLETE_MISSION: '/user/complete-mission', // Direct API call
    LEADERBOARD: '/leaderboard', // Direct API call
    USER_FRAMES: '/user/frames', // Direct API call
    WORD_OF_THE_DAY: '/word-of-the-day', // Direct API call
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
  // Always use direct API URL for production
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}; 