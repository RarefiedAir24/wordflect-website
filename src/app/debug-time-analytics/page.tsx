"use client";
import React, { useEffect, useState } from "react";
import { apiService } from "@/services/api";

export default function DebugTimeAnalytics() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const testTimeAnalytics = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🔍 Testing time analytics API call...');
      console.log('🔍 Is authenticated:', apiService.isAuthenticated());
      console.log('🔍 Token expired:', apiService.isTokenExpired());
      
      const response = await apiService.getTimeAnalytics();
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

      const response = await fetch('/api/proxy-time-analytics', {
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

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Debug Time Analytics</h1>
        
        <div className="space-y-4 mb-8">
          <button
            onClick={testTimeAnalytics}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test API Service Call'}
          </button>
          
          <button
            onClick={testDirectEndpoint}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 ml-4"
          >
            {loading ? 'Testing...' : 'Test Direct Endpoint'}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">API Response:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Instructions:</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Make sure you're logged in to the main profile page first</li>
            <li>Click "Test API Service Call" to test the apiService.getTimeAnalytics() method</li>
            <li>Click "Test Direct Endpoint" to test the proxy route directly</li>
            <li>Check the browser console for detailed logs</li>
            <li>Compare the responses to see if there's a difference</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
