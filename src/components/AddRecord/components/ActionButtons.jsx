import React from 'react';
import { Check, X } from 'lucide-react';

export const ActionButtons = ({ onConfirm, onCancel, isLoading = false }) => (
    <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center space-x-2 disabled:opacity-50"
        >
            <X className="w-4 h-4" />
            <span>Cancel</span>
        </button>
        <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
        >
            <Check className="w-4 h-4" />
            <span>{isLoading ? 'Saving...' : 'Confirm & Save'}</span>
        </button>
    </div>
);