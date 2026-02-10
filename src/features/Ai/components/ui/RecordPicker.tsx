// src/features/AIChat/components/RecordPicker.tsx

import React, { useState } from 'react';
import { Search, Check, X, FileText, Calendar } from 'lucide-react';
import { FileObject } from '@/types/core';

interface RecordPickerProps {
  records: FileObject[];
  selectedRecordIds: string[];
  onSelectionChange: (recordIds: string[]) => void;
  onClose: () => void;
}

export function RecordPicker({
  records,
  selectedRecordIds,
  onSelectionChange,
  onClose,
}: RecordPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelection, setLocalSelection] = useState<Set<string>>(new Set(selectedRecordIds));

  const filteredRecords = records.filter(record => {
    const searchLower = searchQuery.toLowerCase();
    return (
      record.belroseFields?.title.toLowerCase().includes(searchLower) ||
      record.belroseFields?.provider?.toLowerCase().includes(searchLower) ||
      record.belroseFields?.completedDate.includes(searchLower)
    );
  });

  const toggleRecord = (recordId: string) => {
    const newSelection = new Set(localSelection);
    if (newSelection.has(recordId)) {
      newSelection.delete(recordId);
    } else {
      newSelection.add(recordId);
    }
    setLocalSelection(newSelection);
  };

  const handleApply = () => {
    onSelectionChange(Array.from(localSelection));
    onClose();
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Select Specific Records</h3>
            <p className="text-sm text-gray-600 mt-0.5">
              {localSelection.size} of {records.length} selected
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search records by title, provider, or date..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Records List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                {searchQuery ? 'No records match your search' : 'No records available'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecords.map(record => (
                <button
                  key={record.id}
                  onClick={() => toggleRecord(record.id)}
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                    localSelection.has(record.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg mt-0.5 flex-shrink-0 ${
                        localSelection.has(record.id) ? 'bg-blue-100' : 'bg-gray-100'
                      }`}
                    >
                      {localSelection.has(record.id) ? (
                        <Check className="w-4 h-4 text-blue-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {record.belroseFields?.title}
                      </div>
                      {record.belroseFields?.provider && (
                        <div className="text-sm text-gray-600 truncate">
                          {record.belroseFields.provider}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(
                          record.belroseFields?.completedDate
                            ? record.belroseFields?.completedDate
                            : ''
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <button
            onClick={() => setLocalSelection(new Set())}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Clear All
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={localSelection.size === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Apply ({localSelection.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
