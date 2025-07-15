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
      const response = await this.makeRequest(buildApiUrl(API_CONFIG.ENDPOINTS.SIGNIN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Sign in failed');
      }

      const data: SignInResponse = await response.json();
      
      // Store token in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      return data;
    } catch (error) {
      console.error('Sign in error:', error);
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
      console.log('📤 Sending updateUserStats request:', {
        url: buildApiUrl(API_CONFIG.ENDPOINTS.USER_UPDATE_STATS),
        stats
      });
      
      const response = await this.makeRequest(
        buildApiUrl(API_CONFIG.ENDPOINTS.USER_UPDATE_STATS),
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
      const response = await this.makeRequest(
        buildApiUrl(`/word/definition?word=${encodeURIComponent(word)}`),
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
        }
      );
      if (!response.ok) {
        return { definition: 'No definition found.' };
      }
      const data = await response.json();
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
    } catch {
      return { definition: 'No definition found.' };
    }
  }

  // Fetch user missions
  async getMissions(): Promise<unknown> {
    try {
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
}

export const apiService = new ApiService(); 