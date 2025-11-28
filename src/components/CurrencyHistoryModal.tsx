'use client';

import React, { useState, useMemo } from 'react';

interface Transaction {
  id: string;
  type: 'flectcoins' | 'gems';
  amount: number;
  reason: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface CurrencyHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencyType: 'flectcoins' | 'gems';
  transactions: Transaction[];
  summary: {
    earned: number;
    spent: number;
    net: number;
  };
  isLoading?: boolean;
}

type FilterType = 'all' | 'earned' | 'spent';

const CurrencyHistoryModal: React.FC<CurrencyHistoryModalProps> = ({
  isOpen,
  onClose,
  currencyType,
  transactions,
  summary,
  isLoading = false,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  
  // Filter transactions based on active filter (must be before early return)
  const filteredTransactions = useMemo(() => {
    if (activeFilter === 'all') return transactions;
    if (activeFilter === 'earned') return transactions.filter(t => t.amount > 0);
    if (activeFilter === 'spent') return transactions.filter(t => t.amount < 0);
    return transactions;
  }, [transactions, activeFilter]);
  
  if (!isOpen) return null;

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getReasonLabel = (reason: string, metadata?: Record<string, unknown>) => {
    const labels: Record<string, string> = {
      'game_completion': 'Game Completion',
      'mission_reward': metadata?.missionTitle ? `Mission: ${metadata.missionTitle as string}` : 'Mission Reward',
      'hint_purchase': 'Hint Powerup',
      'shuffle_purchase': 'Shuffle Powerup',
      'freeze_purchase': 'Freeze Powerup',
      'time_extension_purchase': 'Time Extension',
      'theme_purchase': metadata?.themeId ? `Theme: ${(metadata.themeId as string).charAt(0).toUpperCase() + (metadata.themeId as string).slice(1)}` : 'Theme Purchase',
      'frame_purchase': metadata?.frameName ? `Frame: ${metadata.frameName as string}` : 'Frame Purchase',
      'gem_purchase': 'Gem Purchase',
      'subscription_gems': metadata?.subscriptionName ? `Subscription: ${metadata.subscriptionName as string}` : 'Subscription Gems',
    };
    return labels[reason] || reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const currencyIcon = currencyType === 'flectcoins' ? '💰' : '💎';
  const currencyName = currencyType === 'flectcoins' ? 'Flectcoins' : 'Gems';
  const currencyColor = currencyType === 'flectcoins' 
    ? 'from-amber-400 to-yellow-500' 
    : 'from-pink-400 to-rose-500';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${currencyColor} flex items-center justify-center text-2xl`}>
              {currencyIcon}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{currencyName} History</h3>
              <p className="text-sm text-gray-600">Track your earnings and spending</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary Cards with Filtering */}
        <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setActiveFilter(activeFilter === 'earned' ? 'all' : 'earned')}
              className={`rounded-lg p-4 border transition-all hover:shadow-md ${
                activeFilter === 'earned'
                  ? 'bg-green-100 border-green-400 ring-2 ring-green-300'
                  : 'bg-green-50 border-green-200 hover:bg-green-100'
              }`}
            >
              <div className="text-sm text-green-700 font-medium flex items-center justify-between">
                <span>Earned</span>
                {activeFilter === 'earned' && (
                  <span className="text-xs bg-green-200 px-2 py-0.5 rounded-full">Filtered</span>
                )}
              </div>
              <div className="text-2xl font-bold text-green-800">{summary.earned.toLocaleString()}</div>
            </button>
            <button
              onClick={() => setActiveFilter(activeFilter === 'spent' ? 'all' : 'spent')}
              className={`rounded-lg p-4 border transition-all hover:shadow-md ${
                activeFilter === 'spent'
                  ? 'bg-red-100 border-red-400 ring-2 ring-red-300'
                  : 'bg-red-50 border-red-200 hover:bg-red-100'
              }`}
            >
              <div className="text-sm text-red-700 font-medium flex items-center justify-between">
                <span>Spent</span>
                {activeFilter === 'spent' && (
                  <span className="text-xs bg-red-200 px-2 py-0.5 rounded-full">Filtered</span>
                )}
              </div>
              <div className="text-2xl font-bold text-red-800">{summary.spent.toLocaleString()}</div>
            </button>
            <button
              onClick={() => setActiveFilter('all')}
              className={`rounded-lg p-4 border transition-all hover:shadow-md ${
                activeFilter === 'all'
                  ? `bg-gradient-to-r ${currencyColor} ring-2 ring-opacity-50`
                  : `bg-gradient-to-r ${currencyColor} opacity-90 hover:opacity-100`
              } text-white`}
            >
              <div className="text-sm font-medium opacity-90 flex items-center justify-between">
                <span>Net Balance</span>
                {activeFilter === 'all' && (
                  <span className="text-xs bg-white bg-opacity-30 px-2 py-0.5 rounded-full">All</span>
                )}
              </div>
              <div className="text-2xl font-bold">{summary.net.toLocaleString()}</div>
            </button>
          </div>
        </div>

        {/* Transaction List */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🔍</div>
              <p className="text-gray-600 font-medium">No {activeFilter === 'earned' ? 'earnings' : 'spending'} found</p>
              <p className="text-sm text-gray-500 mt-2">
                {activeFilter === 'all' 
                  ? `Start playing to see your ${currencyName.toLowerCase()} history!`
                  : `No ${activeFilter === 'earned' ? 'earned' : 'spent'} ${currencyName.toLowerCase()} transactions match this filter.`
                }
              </p>
              {activeFilter !== 'all' && (
                <button
                  onClick={() => setActiveFilter('all')}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Show all transactions
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((transaction) => {
                const isEarned = transaction.amount > 0;
                const absAmount = Math.abs(transaction.amount);
                
                return (
                  <div
                    key={transaction.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      isEarned 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isEarned ? 'bg-green-200' : 'bg-red-200'
                      }`}>
                        <span className="text-xl">
                          {isEarned ? '➕' : '➖'}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {getReasonLabel(transaction.reason, transaction.metadata)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatDate(transaction.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div className={`text-lg font-bold ${
                      isEarned ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {isEarned ? '+' : '-'}{absAmount.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CurrencyHistoryModal;

