'use client';

import React, { useState, useEffect } from 'react';

interface CountdownData {
  success: boolean;
  nextReset: {
    utc: string;
    timestamp: number;
    timezone: string;
  };
  countdown: {
    totalSeconds: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
  currentTime: {
    utc: string;
    timestamp: number;
  };
}

interface MissionResetCountdownProps {
  className?: string;
  variant?: 'dashboard' | 'profile' | 'compact';
}

export default function MissionResetCountdown({ 
  className = '', 
  variant = 'dashboard' 
}: MissionResetCountdownProps) {
  const [countdownData, setCountdownData] = useState<CountdownData | null>(null);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial countdown data
  useEffect(() => {
    fetchCountdownData();
  }, []);

  // Update countdown every second
  useEffect(() => {
    if (!countdownData) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const resetTime = countdownData.nextReset.timestamp;
      const totalSeconds = Math.floor((resetTime - now) / 1000);

      if (totalSeconds <= 0) {
        // Reset time reached, fetch new data
        fetchCountdownData();
        return;
      }

      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setTimeLeft({ hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdownData]);

  const fetchCountdownData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/proxy-next-reset');
      const data = await response.json();
      
      if (data.success) {
        setCountdownData(data);
        setTimeLeft({
          hours: data.countdown.hours,
          minutes: data.countdown.minutes,
          seconds: data.countdown.seconds
        });
      } else {
        setError('Failed to load reset time');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error fetching countdown data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (value: number) => value.toString().padStart(2, '0');

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="bg-gray-200 rounded-lg h-16 w-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-red-600 text-sm">Failed to load reset time</p>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-700">Daily Reset</span>
          </div>
          <div className="text-sm font-mono text-gray-600">
            {formatTime(timeLeft.hours)}:{formatTime(timeLeft.minutes)}:{formatTime(timeLeft.seconds)}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'profile') {
    return (
      <div className={`bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-gray-800">Daily Missions Reset</span>
          </div>
        </div>
        <div className="flex items-center justify-center space-x-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{formatTime(timeLeft.hours)}</div>
            <div className="text-xs text-gray-600">Hours</div>
          </div>
          <div className="text-gray-400">:</div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{formatTime(timeLeft.minutes)}</div>
            <div className="text-xs text-gray-600">Minutes</div>
          </div>
          <div className="text-gray-400">:</div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{formatTime(timeLeft.seconds)}</div>
            <div className="text-xs text-gray-600">Seconds</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          Resets daily at midnight UTC
        </div>
      </div>
    );
  }

  // Dashboard variant (default)
  return (
    <div className={`bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200 rounded-xl p-6 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse"></div>
          <h3 className="text-lg font-semibold text-gray-800">Daily Missions Reset</h3>
        </div>
        <div className="text-xs text-gray-500 bg-white/50 px-2 py-1 rounded-full">
          UTC
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center bg-white/60 rounded-lg p-4">
          <div className="text-3xl font-bold text-indigo-600">{formatTime(timeLeft.hours)}</div>
          <div className="text-sm text-gray-600 mt-1">Hours</div>
        </div>
        <div className="text-center bg-white/60 rounded-lg p-4">
          <div className="text-3xl font-bold text-purple-600">{formatTime(timeLeft.minutes)}</div>
          <div className="text-sm text-gray-600 mt-1">Minutes</div>
        </div>
        <div className="text-center bg-white/60 rounded-lg p-4">
          <div className="text-3xl font-bold text-pink-600">{formatTime(timeLeft.seconds)}</div>
          <div className="text-sm text-gray-600 mt-1">Seconds</div>
        </div>
      </div>
      
      <div className="text-center">
        <div className="text-sm text-gray-600 mb-1">
          Next reset: {countdownData?.nextReset.utc ? new Date(countdownData.nextReset.utc).toLocaleString() : 'Loading...'}
        </div>
        <div className="text-xs text-gray-500">
          All daily missions reset simultaneously at midnight UTC
        </div>
      </div>
    </div>
  );
}
