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
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
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
}

export const apiService = new ApiService(); 