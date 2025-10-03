'use client';

import { useState } from 'react';
import { apiService } from '@/services/api';

interface SessionWordsResult {
  days?: Array<{
    date: string;
    value: number;
    avgLen: number;
  }>;
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export default function DebugSessionWords() {
  const [result, setResult] = useState<SessionWordsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState('30d');

  const testSessionWords = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🔍 Testing session words API call...');
      console.log('🔍 Is authenticated:', apiService.isAuthenticated());
      console.log('🔍 Token expired:', apiService.isTokenExpired());
      
      const response = await apiService.getUserSessionWords({ range });
      console.log('✅ API Response:', response);
      setResult(response);
    } catch (err) {
      console.error('❌ API Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testDirectEndpoint = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🔍 Testing direct endpoint call...');
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token found in localStorage');
      }

      const response = await fetch(`/api/proxy-session-words?range=${range}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('✅ Direct endpoint response:', data);
      setResult(data);
    } catch (err) {
      console.error('❌ Direct endpoint error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testBackendDirect = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🔍 Testing backend direct call...');
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token found in localStorage');
      }

      const response = await fetch(`/api/test-session-words-direct?range=${range}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('✅ Backend direct response:', data);
      setResult(data);
    } catch (err) {
      console.error('❌ Backend direct error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Session Words Debug</h1>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Range:</label>
          <select 
            value={range} 
            onChange={(e) => setRange(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
            <option value="1y">1 year</option>
            <option value="all">All time</option>
          </select>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={testSessionWords}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 mr-2"
          >
            {loading ? 'Testing...' : 'Test API Service'}
          </button>
          
          <button
            onClick={testDirectEndpoint}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 mr-2"
          >
            {loading ? 'Testing...' : 'Test Proxy Endpoint'}
          </button>
          
          <button
            onClick={testBackendDirect}
            disabled={loading}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Backend Direct'}
          </button>
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {result && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Result</h2>
            <div className="bg-white p-6 rounded-lg shadow">
              <pre className="text-sm overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
