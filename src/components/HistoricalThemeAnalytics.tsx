'use client';

import React, { useState, useEffect } from 'react';
import ThemeDatePicker from './ThemeDatePicker';

interface HistoricalThemeData {
  success: boolean;
  date: string;
  theme: {
    name: string;
    words: string[];
  };
  stats: {
    totalThemeWordsFound: number;
    completionRate: number;
    isCompleted: boolean;
  };
  allThemeWords: Array<{
    word: string;
    found: boolean;
  }>;
}

interface HistoricalThemeAnalyticsProps {
  className?: string;
}

export default function HistoricalThemeAnalytics({ className }: HistoricalThemeAnalyticsProps) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [themeData, setThemeData] = useState<HistoricalThemeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThemeData = async (date: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/proxy-theme-day?date=${date}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch theme data: ${response.status}`);
      }

      const data = await response.json();
      console.log('Historical theme data:', data);
      setThemeData(data);
    } catch (err) {
      console.error('Error fetching historical theme data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch theme data');
      setThemeData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate) {
      fetchThemeData(selectedDate);
    }
  }, [selectedDate]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCompletionColor = (completionRate: number) => {
    if (completionRate >= 100) return 'text-green-600 bg-green-100';
    if (completionRate >= 75) return 'text-blue-600 bg-blue-100';
    if (completionRate >= 50) return 'text-yellow-600 bg-yellow-100';
    if (completionRate >= 25) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getCompletionIcon = (completionRate: number) => {
    if (completionRate >= 100) return '🎉';
    if (completionRate >= 75) return '🔥';
    if (completionRate >= 50) return '👍';
    if (completionRate >= 25) return '📈';
    return '💪';
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Historical Theme Analytics</h2>
        <p className="text-gray-600">View your daily theme performance for any past date</p>
      </div>

      {/* Date Picker */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Date
        </label>
        <ThemeDatePicker
          onDateSelect={handleDateSelect}
          selectedDate={selectedDate}
          className="w-full max-w-md"
        />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading theme data...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading theme data</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Theme Data Display */}
      {themeData && !loading && (
        <div className="space-y-6">
          {/* Header Info */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {formatDate(themeData.date)}
                </h3>
                <p className="text-lg text-gray-600 mt-1">
                  {themeData.theme.name} Theme
                </p>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getCompletionColor(themeData.stats.completionRate)}`}>
                  <span className="mr-1">{getCompletionIcon(themeData.stats.completionRate)}</span>
                  {themeData.stats.completionRate}% Complete
                </div>
              </div>
            </div>
          </div>

          {/* Progress Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {themeData.stats.totalThemeWordsFound}
              </div>
              <div className="text-sm text-gray-600">Words Found</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {themeData.theme.words.length}
              </div>
              <div className="text-sm text-gray-600">Total Words</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {themeData.stats.isCompleted ? '✅' : '⏳'}
              </div>
              <div className="text-sm text-gray-600">Status</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-600">
                {themeData.stats.totalThemeWordsFound} / {themeData.theme.words.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${themeData.stats.completionRate}%` }}
              ></div>
            </div>
          </div>

          {/* Theme Words Grid */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Theme Words</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {themeData.allThemeWords.map((wordData, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg text-center text-sm font-medium transition-colors ${
                    wordData.found
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    {wordData.found && (
                      <svg className="w-4 h-4 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {wordData.word}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-blue-900 mb-2">Performance Summary</h4>
            <div className="text-sm text-blue-800">
              {themeData.stats.isCompleted ? (
                <p>🎉 Congratulations! You completed the {themeData.theme.name} theme on {formatDate(themeData.date)}!</p>
              ) : (
                <p>
                  You found {themeData.stats.totalThemeWordsFound} out of {themeData.theme.words.length} words 
                  ({themeData.stats.completionRate}% complete) for the {themeData.theme.name} theme.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!themeData && !loading && !error && (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Theme Data</h3>
          <p className="text-gray-600">Select a date to view your historical theme performance.</p>
        </div>
      )}
    </div>
  );
}
