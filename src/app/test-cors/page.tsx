"use client";
import { useState } from 'react';
import { apiService } from '@/services/api';

export default function TestCors() {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testCors = async () => {
    setLoading(true);
    setResults([]);
    
    try {
      addResult('🔍 Testing CORS and API connectivity...');
      
      // Test 1: Check if authenticated
      const isAuth = apiService.isAuthenticated();
      addResult(`🔐 Authentication: ${isAuth ? 'YES' : 'NO'}`);
      
      if (!isAuth) {
        addResult('❌ Not authenticated - cannot test API calls');
        return;
      }

      // Test 2: Test user profile endpoint
      addResult('📡 Testing /user/profile...');
      try {
        const profile = await apiService.getUserProfile();
        addResult(`✅ Profile loaded: ${profile.username}`);
      } catch (error) {
        addResult(`❌ Profile error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Test 3: Test missions endpoint
      addResult('📡 Testing /user/missions...');
      try {
        const missions = await apiService.getMissions();
        addResult(`✅ Missions loaded: ${Array.isArray(missions) ? missions.length : 'Unknown format'}`);
        if (Array.isArray(missions)) {
          addResult(`📋 Mission count: ${missions.length}`);
        }
      } catch (error) {
        addResult(`❌ Missions error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Test 4: Test stats update endpoint
      addResult('📡 Testing /user/update-stats...');
      try {
        const statsResult = await apiService.updateUserStats({
          test: true,
          timestamp: Date.now()
        });
        addResult(`✅ Stats update: Success`);
      } catch (error) {
        addResult(`❌ Stats error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    } catch (error) {
      addResult(`💥 General error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">CORS & API Test</h1>
        
        <button 
          onClick={testCors}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-6"
        >
          {loading ? 'Testing...' : 'Test CORS & API'}
        </button>

        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Test Results:</h2>
          <div className="space-y-2 font-mono text-sm">
            {results.map((result, index) => (
              <div key={index} className="p-2 bg-gray-700 rounded">
                {result}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 