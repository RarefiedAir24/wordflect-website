'use client';

import React, { useState } from 'react';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'days-active' | 'current-streak' | 'best-streak';
  title: string;
  data: { date: string; active: boolean }[];
  startDate?: string;
  endDate?: string;
}

interface CalendarViewProps {
  data: { date: string; active: boolean }[];
  type: 'days-active' | 'current-streak' | 'best-streak';
  startDate?: string;
  endDate?: string;
}

const CalendarView: React.FC<CalendarViewProps> = ({ data, type, startDate, endDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  console.log('🗓️ CalendarView received data:', data.length, 'items');
  console.log('🗓️ CalendarView active days:', data.filter(d => d.active).length);
  console.log('🗓️ CalendarView data sample:', data.slice(0, 5));

  // Group data by month
  const dataByMonth = data.reduce((acc, item) => {
    const date = new Date(item.date);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(item);
    return acc;
  }, {} as Record<string, { date: string; active: boolean }[]>);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getMonthData = (date: Date) => {
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    return dataByMonth[monthKey] || [];
  };

  const isDateActive = (day: number, monthData: { date: string; active: boolean }[]) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = monthData.find(d => d.date === dateStr);
    const isActive = dayData?.active || false;
    
    // For streak types, if the day exists in the data array, it's part of the streak
    // (the data generation now includes all consecutive days in the streak range)
    if (type === 'current-streak' || type === 'best-streak') {
      if (dayData !== undefined) {
        // Day is in the data array, meaning it's part of the streak
        return true;
      }
      return false;
    }
    
    // For days-active, only mark days that actually have sessions
    if (isActive) {
      console.log('🗓️ Found active day:', dateStr, 'in month data:', monthData.length, 'items');
    }
    
    return isActive;
  };

  const isDateInRange = (day: number) => {
    if (!startDate || !endDate) return false;
    
    const currentDateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentDate = new Date(currentDateStr);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return currentDate >= start && currentDate <= end;
  };

  const monthData = getMonthData(currentMonth);
  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div className="w-full">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h3 className="text-xl font-bold text-gray-900">{formatMonthYear(currentMonth)}</h3>
        
        <button
          onClick={() => navigateMonth('next')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-semibold text-gray-600">
            {day}
          </div>
        ))}
        
        {/* Empty days for alignment */}
        {emptyDays.map((_, index) => (
          <div key={`empty-${index}`} className="p-2"></div>
        ))}
        
        {/* Calendar days */}
        {days.map(day => {
          const isActive = isDateActive(day, monthData);
          const inRange = isDateInRange(day);
          
          let bgColor = 'bg-gray-50';
          let textColor = 'text-gray-400';
          let borderColor = 'border-gray-200';
          
          if (isActive) {
            if (type === 'days-active') {
              bgColor = 'bg-blue-500';
              textColor = 'text-white';
              borderColor = 'border-blue-600';
            } else if (type === 'current-streak') {
              bgColor = 'bg-orange-500';
              textColor = 'text-white';
              borderColor = 'border-orange-600';
            } else if (type === 'best-streak') {
              bgColor = 'bg-purple-500';
              textColor = 'text-white';
              borderColor = 'border-purple-600';
            }
          } else if (inRange) {
            bgColor = 'bg-gray-200';
            textColor = 'text-gray-600';
            borderColor = 'border-gray-300';
          }
          
          return (
            <div
              key={day}
              className={`p-2 text-center text-sm rounded-lg border ${bgColor} ${textColor} ${borderColor} transition-all duration-200`}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${
            type === 'days-active' ? 'bg-blue-500' : 
            type === 'current-streak' ? 'bg-orange-500' : 
            'bg-purple-500'
          }`}></div>
          <span className="text-gray-700">Active day</span>
        </div>
        {type !== 'days-active' && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-200"></div>
            <span className="text-gray-700">Streak period</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gray-50 border border-gray-200"></div>
          <span className="text-gray-700">No activity</span>
        </div>
      </div>
    </div>
  );
};

const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  data,
  startDate,
  endDate
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden my-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            {startDate && endDate && (
              <p className="text-sm text-gray-600 mt-1">
                {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <CalendarView 
            data={data} 
            type={type}
            startDate={startDate}
            endDate={endDate}
          />
        </div>
      </div>
    </div>
  );
};

export default CalendarModal;
