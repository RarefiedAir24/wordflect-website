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
      setSelectedDateObj(new Date(selectedDate));
    }
  }, [selectedDate]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleDateChange = (date: Date) => {
    setSelectedDateObj(date);
    const dateString = date.toISOString().split('T')[0];
    onDateSelect(dateString);
    setIsOpen(false);
  };

  const goToToday = () => {
    const today = new Date();
    handleDateChange(today);
  };

  const goToYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    handleDateChange(yesterday);
  };

  const goToLastWeek = () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    handleDateChange(lastWeek);
  };

  const goToLastMonth = () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    handleDateChange(lastMonth);
  };

  const getMaxDate = () => {
    return new Date(); // Today is the maximum date
  };

  const getMinDate = () => {
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 1); // 1 year ago
    return minDate;
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
                    handleDateChange(new Date(e.target.value));
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
                  {selectedDateObj.toLocaleDateString('en-US', { weekday: 'long' })} • 
                  {selectedDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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
