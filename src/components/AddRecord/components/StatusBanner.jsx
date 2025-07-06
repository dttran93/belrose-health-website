import React from 'react';
import { Database } from 'lucide-react';

export const StatusBanner = ({ savedToFirestoreCount, savingCount }) => {
    if (savedToFirestoreCount === 0 && savingCount === 0) return null;

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 text-blue-800">
                <Database className="w-5 h-5" />
                <span className="font-medium">Cloud Storage Status:</span>
            </div>
            <div className="mt-2 text-sm text-blue-700">
                {savingCount > 0 && (
                    <p>💾 Saving {savingCount} file{savingCount !== 1 ? 's' : ''} to cloud...</p>
                )}
                {savedToFirestoreCount > 0 && (
                    <p>✅ {savedToFirestoreCount} file{savedToFirestoreCount !== 1 ? 's' : ''} saved to cloud storage</p>
                )}
            </div>
        </div>
    );
};
