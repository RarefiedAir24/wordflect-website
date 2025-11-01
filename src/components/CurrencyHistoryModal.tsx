'use client';

import React from 'react';

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

const CurrencyHistoryModal: React.FC<CurrencyHistoryModalProps> = ({
  isOpen,
  onClose,
  currencyType,
  transactions,
  summary,
  isLoading = false,
}) => {
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
    };
    return labels[reason] || reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const currencyIcon = currencyType === 'flectcoins' ? '💰' : '💎';
  const currencyName = currencyType === 'flectcoins' ? 'Flectcoins' : 'Gems';
  const currencyColor = currencyType === 'flectcoins' 
    ? 'from-amber-400 to-yellow-500' 
    : 'from-pink-400 to-rose-500';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
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

        {/* Summary Cards */}
        <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-sm text-green-700 font-medium">Earned</div>
              <div className="text-2xl font-bold text-green-800">{summary.earned.toLocaleString()}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-sm text-red-700 font-medium">Spent</div>
              <div className="text-2xl font-bold text-red-800">{summary.spent.toLocaleString()}</div>
            </div>
            <div className={`bg-gradient-to-r ${currencyColor} rounded-lg p-4 text-white`}>
              <div className="text-sm font-medium opacity-90">Net Balance</div>
              <div className="text-2xl font-bold">{summary.net.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📝</div>
              <p className="text-gray-600 font-medium">No transactions yet</p>
              <p className="text-sm text-gray-500 mt-2">Start playing to see your {currencyName.toLowerCase()} history!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => {
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

