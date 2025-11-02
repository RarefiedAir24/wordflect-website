'use client';

import React, { useState, useEffect } from 'react';

interface ThemeDatePickerProps {
  onDateSelect: (date: string) => void;
  selectedDate: string;
  className?: string;
}

export default function ThemeDatePicker({ onDateSelect, selectedDate, className }: ThemeDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);

  useEffect(() => {
    if (selectedDate) {
      // Parse YYYY-MM-DD as UTC to avoid timezone issues
      const [year, month, day] = selectedDate.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      setSelectedDateObj(date);
    }
  }, [selectedDate]);

  const formatDate = (date: Date) => {
    // Use UTC methods to avoid timezone shifting
    // The date string (YYYY-MM-DD) represents a UTC date
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Extract all components using UTC methods
    // Extract year from UTC ISO string (YYYY-MM-DD) for absolute consistency
    const utcIsoString = date.toISOString(); // e.g., "2025-11-02T00:00:00.000Z"
    const year = parseInt(utcIsoString.substring(0, 4), 10);
    const weekday = weekdays[date.getUTCDay()];
    const monthName = months[date.getUTCMonth()];
    const day = date.getUTCDate();
    
    return `${weekday}, ${monthName} ${day}, ${year}`;
  };

  const formatDateShort = (date: Date) => {
    // Use UTC methods to avoid timezone shifting
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // Extract year from UTC ISO string for absolute consistency
    const utcIsoString = date.toISOString();
    const year = parseInt(utcIsoString.substring(0, 4), 10);
    const monthName = months[date.getUTCMonth()];
    const day = date.getUTCDate();
    return `${monthName} ${day}, ${year}`;
  };

  const handleDateChange = (date: Date) => {
    setSelectedDateObj(date);
    // Use UTC date components to create YYYY-MM-DD string to avoid timezone issues
    // Extract year from UTC ISO string for consistency
    const utcIsoString = date.toISOString();
    const year = parseInt(utcIsoString.substring(0, 4), 10);
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    console.log('📅 handleDateChange - Date object:', date.toISOString());
    console.log('📅 handleDateChange - Date string sent:', dateString);
    console.log('📅 handleDateChange - Formatted display will be:', formatDate(date));
    onDateSelect(dateString);
    setIsOpen(false);
  };

  const goToToday = () => {
    // Get today's date in UTC to match backend date calculations
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    console.log('🗓️ goToToday - Current UTC time:', now.toUTCString());
    console.log('🗓️ goToToday - UTC date object:', today.toISOString());
    handleDateChange(today);
  };

  const goToYesterday = () => {
    // Get yesterday's date in UTC
    const now = new Date();
    const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    handleDateChange(yesterday);
  };

  const goToLastWeek = () => {
    // Get last week's date in UTC (7 days ago)
    const now = new Date();
    const lastWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7));
    handleDateChange(lastWeek);
  };

  const goToLastMonth = () => {
    // Get last month's date in UTC
    const now = new Date();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, now.getUTCDate()));
    handleDateChange(lastMonth);
  };

  const getMaxDate = () => {
    // Today in UTC
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  };

  const getMinDate = () => {
    // 1 year ago in UTC
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()));
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <span className="flex items-center">
          <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {selectedDateObj ? formatDate(selectedDateObj) : 'Select a date'}
        </span>
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          <div className="p-4">
            {/* Quick date buttons */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Select</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={goToToday}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Today
                </button>
                <button
                  onClick={goToYesterday}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Yesterday
                </button>
                <button
                  onClick={goToLastWeek}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Last Week
                </button>
                <button
                  onClick={goToLastMonth}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Last Month
                </button>
              </div>
            </div>

            {/* Date picker */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Select Date</h3>
              <input
                type="date"
                value={selectedDateObj ? selectedDateObj.toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    // Parse YYYY-MM-DD as UTC to avoid timezone issues
                    const [year, month, day] = e.target.value.split('-').map(Number);
                    const date = new Date(Date.UTC(year, month - 1, day));
                    handleDateChange(date);
                  }
                }}
                max={getMaxDate().toISOString().split('T')[0]}
                min={getMinDate().toISOString().split('T')[0]}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Selected date info */}
            {selectedDateObj && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-900">
                  Selected: {formatDateShort(selectedDateObj)}
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  {formatDate(selectedDateObj)} • UTC
                </div>
              </div>
            )}

            {/* Close button */}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
