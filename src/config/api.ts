// API Configuration for Wordflect
export const API_CONFIG = {
  // Base URL for the Wordflect API
  // For production, this should point to the actual deployed API
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.wordflect.com',
  
  // API Endpoints
  ENDPOINTS: {
    SIGNIN: '/signin',
    SIGNUP: '/signup',
    USER_PROFILE: '/user/profile',
    USER_MISSIONS: '/user/missions',
    USER_UPDATE_STATS: '/user/update-stats',
    USER_COMPLETE_MISSION: '/user/complete-mission',
    LEADERBOARD: '/leaderboard',
    USER_FRAMES: '/user/frames',
    WORD_OF_THE_DAY: '/word-of-the-day',
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
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}; 