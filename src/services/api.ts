// Deployment trigger: Add logging for word definition API responses
// API service for Wordflect backend integration
import { API_CONFIG, buildApiUrl } from "@/config/api";

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignInResponse {
  message: string;
  user: {
    id: string;
    email: string;
    username: string;
    createdAt: string;
  };
  token: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  profileImageUrl?: string;
  highestLevel: number;
  flectcoins: number;
  points: number;
  gems: number;
  allFoundWords: (string | { word: string; date?: string })[];
  selectedFrame?: {
    id: string;
    name: string;
    imageUrl: string;
    rarity: string;
    isDefault?: boolean;
    price: number;
  };
  gamesPlayed: number;
  topScore: number;
  longestWord: string;
  leaderboardPlacements: number;
  battleWins: number;
  battleLosses: number;
  firstPlaceFinishes: number;
  secondPlaceFinishes: number;
  thirdPlaceFinishes: number;
  // Optional time-based engagement fields (populated by backend if available)
  totalPlayTimeMinutes?: number; // total minutes played across sessions
  daysLoggedIn?: number; // total distinct days logged in
  currentStreakDays?: number; // current consecutive login days
  longestStreakDays?: number; // longest streak achieved
  lastLoginAt?: string; // ISO timestamp of last login
  themeWordsFoundToday?: string[]; // theme words found today from mobile app
}

class ApiService {
  private getAuthHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
    console.log('🔐 Auth headers:', { 
      hasToken: !!token, 
      tokenLength: token?.length,
      headers: Object.keys(headers)
    });
    return headers;
  }

  // Historical stats (time series) from backend
  async getUserHistory(params: { range?: string } = {}): Promise<{ days: { date: string; value: number; avgLen?: number }[] }> {
    try {
      const url = new URL(buildApiUrl(API_CONFIG.ENDPOINTS.USER_HISTORY), window.location.origin);
      if (params.range) url.searchParams.set('range', params.range);
      const response = await this.makeRequest(url.toString(), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          await this.signOut();
          throw new Error('Authentication failed. Please sign in again.');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch user history');
      }
      return await response.json();
    } catch (error) {
      console.error('Get user history error:', error);
      throw error;
    }
  }

  // Enhanced Statistics Endpoints
  async getDetailedStatistics(): Promise<unknown> {
    try {
      const response = await this.makeRequest(buildApiUrl(API_CONFIG.ENDPOINTS.USER_STATISTICS_DETAILED), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          await this.signOut();
          throw new Error('Authentication failed. Please sign in again.');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch detailed statistics');
      }
      return await response.json();
    } catch (error) {
      console.error('Get detailed statistics error:', error);
      throw error;
    }
  }

  async getDailyStatistics(date: string): Promise<unknown> {
    try {
      const url = new URL(buildApiUrl(API_CONFIG.ENDPOINTS.USER_STATISTICS_DAILY), window.location.origin);
      url.searchParams.set('date', date);
      const response = await this.makeRequest(url.toString(), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          await this.signOut();
          throw new Error('Authentication failed. Please sign in again.');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch daily statistics');
      }
      return await response.json();
    } catch (error) {
      console.error('Get daily statistics error:', error);
      throw error;
    }
  }

  async getWeeklyStatistics(week: string): Promise<unknown> {
    try {
      const url = new URL(buildApiUrl(API_CONFIG.ENDPOINTS.USER_STATISTICS_WEEKLY), window.location.origin);
      url.searchParams.set('week', week);
      const response = await this.makeRequest(url.toString(), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          await this.signOut();
          throw new Error('Authentication failed. Please sign in again.');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch weekly statistics');
      }
      return await response.json();
    } catch (error) {
      console.error('Get weekly statistics error:', error);
      throw error;
    }
  }

  async getMonthlyStatistics(month: string): Promise<unknown> {
    try {
      const url = new URL(buildApiUrl(API_CONFIG.ENDPOINTS.USER_STATISTICS_MONTHLY), window.location.origin);
      url.searchParams.set('month', month);
      const response = await this.makeRequest(url.toString(), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          await this.signOut();
          throw new Error('Authentication failed. Please sign in again.');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch monthly statistics');
      }
      return await response.json();
    } catch (error) {
      console.error('Get monthly statistics error:', error);
      throw error;
    }
  }

  async trackSession(data: { action: 'start' | 'end'; sessionId?: string; score?: number; level?: number; wordsFound?: number }): Promise<unknown> {
    try {
      const response = await this.makeRequest(buildApiUrl(API_CONFIG.ENDPOINTS.USER_SESSION_TRACK), {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        if (response.status === 401) {
          await this.signOut();
          throw new Error('Authentication failed. Please sign in again.');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to track session');
      }
      return await response.json();
    } catch (error) {
      console.error('Track session error:', error);
      throw error;
    }
  }

  async getTimeAnalytics(filters?: { period?: string; startDate?: string; endDate?: string }): Promise<unknown> {
    try {
      // Build URL with query parameters
      let url = `${API_CONFIG.BASE_URL}/user/time/analytics`;
      const params = new URLSearchParams();
      
      if (filters?.period) params.append('period', filters.period);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log('🔍 getTimeAnalytics - API_CONFIG.BASE_URL:', API_CONFIG.BASE_URL);
      console.log('🔍 getTimeAnalytics - Full URL:', url);
      console.log('🔍 getTimeAnalytics - Filters:', filters);
      
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          await this.signOut();
          throw new Error('Authentication failed. Please sign in again.');
        }
        if (response.status === 403) {
          throw new Error('Access denied. You do not have permission to view time analytics.');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch time analytics');
      }
      return await response.json();
    } catch (error) {
      console.error('Get time analytics error:', error);
      throw error;
    }
  }

  async getThemeAnalytics(): Promise<unknown> {
    try {
      const response = await this.makeRequest(buildApiUrl(API_CONFIG.ENDPOINTS.USER_THEME_ANALYTICS), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await this.signOut();
          throw new Error('Authentication failed. Please sign in again.');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch theme analytics');
      }
      return await response.json();
    } catch (error) {
      console.error('Get theme analytics error:', error);
      throw error;
    }
  }

  async getThemeDayStatistics(date: string): Promise<unknown> {
    try {
      const url = new URL(buildApiUrl(API_CONFIG.ENDPOINTS.USER_THEME_DAY), window.location.origin);
      url.searchParams.set('date', date);
      const response = await this.makeRequest(url.toString(), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await this.signOut();
          throw new Error('Authentication failed. Please sign in again.');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch theme day statistics');
      }
      return await response.json();
    } catch (error) {
      console.error('Get theme day statistics error:', error);
      throw error;
    }
  }

  private async makeRequest(url: string, options: RequestInit, retries = 0): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (retries < API_CONFIG.RETRY.MAX_ATTEMPTS && error instanceof Error && error.name === 'AbortError') {
        console.log(`Request timeout, retrying... (${retries + 1}/${API_CONFIG.RETRY.MAX_ATTEMPTS})`);
        await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY.DELAY));
        return this.makeRequest(url, options, retries + 1);
      }
      throw error;
    }
  }

  async signIn(credentials: SignInRequest): Promise<SignInResponse> {
    try {
      console.log('🔐 API SERVICE: Starting sign-in request...');
      console.log('🔐 API SERVICE: Endpoint:', buildApiUrl(API_CONFIG.ENDPOINTS.SIGNIN));
      console.log('🔐 API SERVICE: Credentials:', { email: credentials.email, passwordLength: credentials.password.length });
      
      const response = await this.makeRequest(buildApiUrl(API_CONFIG.ENDPOINTS.SIGNIN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      console.log('🔐 API SERVICE: Response status:', response.status);
      console.log('🔐 API SERVICE: Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json();
        console.error('🔐 API SERVICE: Sign-in failed with status:', response.status, errorData);
        throw new Error(errorData.message || 'Sign in failed');
      }

      const data: SignInResponse = await response.json();
      console.log('🔐 API SERVICE: Sign-in successful, received data:', {
        hasToken: !!data.token,
        tokenLength: data.token?.length,
        hasUser: !!data.user,
        userId: data.user?.id
      });
      
      // Store token in localStorage
      if (typeof window !== 'undefined') {
        console.log('🔐 API SERVICE: Storing token and user in localStorage...');
        console.log('🔐 API SERVICE: Token to store length:', data.token?.length);
        console.log('🔐 API SERVICE: User to store:', data.user);
        
        try {
          console.log('🔐 API SERVICE: About to store token:', data.token?.substring(0, 20) + '...');
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          console.log('🔐 API SERVICE: localStorage.setItem completed successfully');
          
          // Immediate verification
          const immediateToken = localStorage.getItem('token');
          console.log('🔐 API SERVICE: Immediate token check:', immediateToken ? 'STORED' : 'NOT STORED');
        } catch (storageError) {
          console.error('🔐 API SERVICE: localStorage.setItem failed:', storageError);
          throw new Error('Failed to store authentication data');
        }
        
        // Verify storage immediately
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        console.log('🔐 API SERVICE: Verification - Token stored:', !!storedToken);
        console.log('🔐 API SERVICE: Verification - User stored:', !!storedUser);
        console.log('🔐 API SERVICE: Verification - Token matches:', storedToken === data.token);
        console.log('🔐 API SERVICE: Verification - All localStorage keys:', Object.keys(localStorage));
        
        // Additional verification after a small delay
        setTimeout(() => {
          const delayedToken = localStorage.getItem('token');
          const delayedUser = localStorage.getItem('user');
          console.log('🔐 API SERVICE: Delayed verification - Token still there:', !!delayedToken);
          console.log('🔐 API SERVICE: Delayed verification - User still there:', !!delayedUser);
          console.log('🔐 API SERVICE: Delayed verification - All keys:', Object.keys(localStorage));
        }, 50);
      } else {
        console.warn('🔐 API SERVICE: Window is undefined, cannot store in localStorage');
      }

      return data;
    } catch (error) {
      console.error('🔐 API SERVICE: Sign in error:', error);
      throw error;
    }
  }

  async getUserProfile(): Promise<UserProfile> {
    try {
      const response = await this.makeRequest(buildApiUrl(API_CONFIG.ENDPOINTS.USER_PROFILE), {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
          throw new Error('Authentication failed. Please sign in again.');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch user profile');
      }

      return await response.json();
    } catch (error) {
      console.error('Get user profile error:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }

  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    const token = localStorage.getItem('token');
    return !!token;
  }

  getStoredUser() {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  // Helper method to check if token is expired
  isTokenExpired(): boolean {
    if (typeof window === 'undefined') return true;
    const token = localStorage.getItem('token');
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true;
    }
  }

  // Update user stats
  async updateUserStats(stats: Record<string, unknown>): Promise<unknown> {
    try {
      const url = buildApiUrl(API_CONFIG.ENDPOINTS.USER_UPDATE_STATS);
      console.log('📤 Sending updateUserStats request:', {
        url: url,
        endpoint: API_CONFIG.ENDPOINTS.USER_UPDATE_STATS,
        baseUrl: API_CONFIG.BASE_URL,
        stats
      });
      
      const response = await this.makeRequest(
        url,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(stats),
        }
      );
      
      console.log('📥 updateUserStats response status:', response.status);
      console.log('📥 updateUserStats response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ updateUserStats error response:', errorData);
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to update user stats`);
      }
      
      const result = await response.json();
      console.log('✅ updateUserStats success:', result);
      return result;
    } catch (error) {
      console.error('Update user stats error:', error);
      throw error;
    }
  }

  // Complete a mission
  async completeMission({ id, missionId, period }: { id: string; missionId: string; period: string }): Promise<unknown> {
    try {
      console.log('📤 Sending completeMission request:', {
        url: buildApiUrl(API_CONFIG.ENDPOINTS.USER_COMPLETE_MISSION),
        id,
        missionId,
        period
      });
      
      const response = await this.makeRequest(
        buildApiUrl(API_CONFIG.ENDPOINTS.USER_COMPLETE_MISSION),
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ id, missionId, period }),
        }
      );
      
      console.log('📥 completeMission response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ completeMission error response:', errorData);
        throw new Error(errorData.message || 'Failed to complete mission');
      }
      
      const result = await response.json();
      console.log('✅ completeMission success:', result);
      return result;
    } catch (error) {
      console.error('Complete mission error:', error);
      throw error;
    }
  }

  // Fetch word definition
  async getWordDefinition(word: string): Promise<{ definition: string; pronunciation?: string; attribution?: string }> {
    try {
      // Use proxy endpoint to avoid CORS issues
      const response = await fetch(`/api/proxy-word-definition?word=${encodeURIComponent(word)}`);
      const data = await response.json();
      console.log('[Word Definition Debug]', { word, data }); // <-- Added logging
      if (!response.ok) {
        return { definition: 'No definition found.' };
      }
      if (Array.isArray(data) && data.length > 0) {
        const firstWithText = data.find((entry: { text?: string }) => entry.text && entry.text.trim() !== '');
        if (firstWithText) {
          return {
            definition: firstWithText.text,
            pronunciation: firstWithText.pronunciation,
            attribution: firstWithText.attributionText,
          };
        }
      }
      return { definition: 'No definition found.' };
    } catch (err) {
      console.log('[Word Definition Error]', { word, err }); // <-- Added error logging
      return { definition: 'No definition found.' };
    }
  }

  // Fetch user missions
  async getMissions(): Promise<unknown> {
    try {
      // Check if token is expired before making request
      if (this.isTokenExpired()) {
        console.warn('Token is expired, clearing auth data');
        await this.signOut();
        throw new Error('Session expired. Please sign in again.');
      }

      const fullUrl = buildApiUrl(API_CONFIG.ENDPOINTS.USER_MISSIONS);
      console.log('📤 Sending getMissions request:', {
        url: fullUrl,
        endpoint: API_CONFIG.ENDPOINTS.USER_MISSIONS,
        baseUrl: API_CONFIG.BASE_URL
      });
      
      const response = await this.makeRequest(
        fullUrl,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
        }
      );
      
      console.log('📥 getMissions response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          console.warn('401 response, clearing auth data');
          await this.signOut();
          throw new Error('Session expired. Please sign in again.');
        }
        const errorData = await response.json();
        console.error('❌ getMissions error response:', errorData);
        throw new Error(errorData.message || 'Failed to fetch missions');
      }
      
      const result = await response.json();
      console.log('✅ getMissions success:', result);
      console.log('📋 Missions response type:', typeof result);
      console.log('📋 Missions is array:', Array.isArray(result));
      if (typeof result === 'object' && result !== null) {
        console.log('📋 Missions object keys:', Object.keys(result));
      }
      return result;
    } catch (error) {
      console.error('Get missions error:', error);
      throw error;
    }
  }

  // Fetch user session words data
  async getUserSessionWords(params: { range?: string } = {}): Promise<{ days: Array<{ date: string; value: number; avgLen?: number }> }> {
    try {
      if (this.isTokenExpired()) {
        console.warn('Token is expired, clearing auth data');
        await this.signOut();
        throw new Error('Session expired. Please sign in again.');
      }

      const searchParams = new URLSearchParams();
      if (params.range) searchParams.set('range', params.range);
      // Add user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      searchParams.set('timezone', userTimezone);

      const fullUrl = `${API_CONFIG.ENDPOINTS.USER_SESSION_WORDS}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      console.log('📤 Sending getUserSessionWords request:', { url: fullUrl, params });
      
      const response = await this.makeRequest(fullUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      
      console.log('📥 getUserSessionWords response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('401 response, clearing auth data');
          await this.signOut();
          throw new Error('Session expired. Please sign in again.');
        }
        const errorData = await response.json();
        console.error('❌ getUserSessionWords error response:', errorData);
        throw new Error(errorData.message || 'Failed to fetch session words data');
      }
      
      const result = await response.json();
      console.log('✅ getUserSessionWords success:', result);
      return result;
    } catch (error) {
      console.error('Get user session words error:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService(); 