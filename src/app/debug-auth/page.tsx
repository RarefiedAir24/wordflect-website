'use client';

import { useState } from 'react';
import { apiService } from '@/services/api';

interface AuthState {
  isAuthenticated: boolean;
  tokenExpired: boolean;
  storedUser: Record<string, unknown> | null;
  tokenExists: boolean;
  tokenLength?: number;
  tokenPayload: Record<string, unknown> | null;
  apiTest: {
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  } | null;
}

export default function DebugAuth() {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkAuthState = async () => {
    setLoading(true);
    setError(null);
    setAuthState(null);

    try {
      console.log('🔍 Checking authentication state...');
      
      // Check if authenticated
      const isAuth = apiService.isAuthenticated();
      console.log('🔍 Is authenticated:', isAuth);
      
      // Check token expiration
      const isExpired = apiService.isTokenExpired();
      console.log('🔍 Token expired:', isExpired);
      
      // Get stored user
      const user = apiService.getStoredUser();
      console.log('🔍 Stored user:', user);
      
      // Get token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      console.log('🔍 Token exists:', !!token);
      console.log('🔍 Token length:', token?.length);
      
      // Decode token if it exists
      let tokenPayload = null;
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          tokenPayload = payload;
          console.log('🔍 Token payload:', payload);
          console.log('🔍 Token exp:', new Date(payload.exp * 1000));
          console.log('🔍 Current time:', new Date());
          console.log('🔍 Token expired?', payload.exp < Math.floor(Date.now() / 1000));
        } catch (e) {
          console.error('🔍 Error decoding token:', e);
        }
      }
      
      // Test API call
      let apiTest: {
        success: boolean;
        data?: Record<string, unknown>;
        error?: string;
      } | null = null;
      try {
        console.log('🔍 Testing API call...');
        const response = await apiService.getDetailedStatistics();
        apiTest = { success: true, data: response as Record<string, unknown> };
        console.log('🔍 API call successful:', response);
      } catch (apiError) {
        console.error('🔍 API call failed:', apiError);
        apiTest = { success: false, error: apiError instanceof Error ? apiError.message : 'Unknown error' };
      }
      
      setAuthState({
        isAuthenticated: isAuth,
        tokenExpired: isExpired,
        storedUser: user,
        tokenExists: !!token,
        tokenLength: token?.length,
        tokenPayload,
        apiTest
      });
      
    } catch (err) {
      console.error('❌ Debug error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const clearAuth = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthState(null);
    console.log('🔍 Auth data cleared');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Authentication Debug</h1>
        
        <div className="space-y-4">
          <button
            onClick={checkAuthState}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check Auth State'}
          </button>
          
          <button
            onClick={clearAuth}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Clear Auth Data
          </button>
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {authState && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Authentication State</h2>
            <div className="bg-white p-6 rounded-lg shadow">
              <pre className="text-sm overflow-auto">
                {JSON.stringify(authState, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
