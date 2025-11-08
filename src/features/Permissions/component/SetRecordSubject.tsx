//src/features/Permissions/component/SetRecordSubject.tsx

import React, { useState } from 'react';
import { CircleUser, Search, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '../hooks/usePermissions';
import { getUserProfile, UserProfile } from '@/components/auth/services/userProfileService';
import * as Dialog from '@radix-ui/react-dialog';

interface SetRecordSubjectProps {
  recordId: string;
  currentSubjectId?: string;
  onSuccess?: () => void;
}

export const SetRecordSubject: React.FC<SetRecordSubjectProps> = ({
  recordId,
  currentSubjectId,
  onSuccess,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedProfile, setSearchedProfile] = useState<UserProfile | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const { setSubject, isLoading } = usePermissions({
    onSuccess: msg => {
      setIsOpen(false);
      onSuccess?.();
    },
    onError: err => {
      // Error is handled by the hook
    },
  });

  // Search for user by ID
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a user ID');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSearchedProfile(null);

    try {
      const profile = await getUserProfile(searchQuery.trim());

      if (profile) {
        setSearchedProfile(profile);
        setSearchError(null);
      } else {
        setSearchError('User not found');
      }
    } catch (error) {
      setSearchError('Error searching for user');
    } finally {
      setSearching(false);
    }
  };

  const handleSetSubject = async () => {
    if (!searchedProfile) return;

    const success = await setSubject(recordId, searchedProfile.uid);
    if (success) {
      setSearchQuery('');
      setSearchedProfile(null);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
    setSearchedProfile(null);
    setSearchError(null);
  };

  // If subject is already set, show info message
  if (currentSubjectId) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Record subject is already set</p>
            <p className="text-xs text-amber-700 mt-1">
              The record subject cannot be changed once set. Current subject: {currentSubjectId}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" className="w-full">
          <CircleUser className="w-4 h-4 mr-2" />
          Set Record Subject
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl z-50 w-full max-w-md p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-xl font-bold text-gray-900">
              Set Record Subject
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                onClick={handleClose}
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-900 mb-1">
                  Important: This cannot be changed!
                </p>
                <ul className="text-xs text-red-700 space-y-1">
                  <li>• The subject is the person this record is about</li>
                  <li>• They automatically become an owner</li>
                  <li>• Only they can delete this record</li>
                  <li>• This setting is permanent</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search User by ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter user ID..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <Button
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  variant="outline"
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Search Error */}
            {searchError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{searchError}</p>
              </div>
            )}

            {/* Search Result */}
            {searchedProfile && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                    <CircleUser className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {searchedProfile.displayName || 'No name'}
                    </p>
                    <p className="text-sm text-gray-600">{searchedProfile.email}</p>
                    <p className="text-xs text-gray-500 mt-1">ID: {searchedProfile.uid}</p>
                  </div>
                </div>

                {/* Confirmation */}
                <div className="bg-white border border-amber-300 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-amber-900 mb-1">Confirm this is correct</p>
                  <p className="text-xs text-amber-700">
                    Make sure this is the right person before setting them as the subject.
                  </p>
                </div>

                <Button onClick={handleSetSubject} disabled={isLoading} className="w-full">
                  {isLoading ? 'Setting Subject...' : 'Set as Record Subject'}
                </Button>
              </div>
            )}
          </div>

          {/* Instructions */}
          {!searchedProfile && !searchError && (
            <div className="mt-4 text-sm text-gray-600">
              <p className="font-medium mb-2">How to find the user ID:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Ask the user to check their profile settings</li>
                <li>Or look up their user ID in your user management system</li>
                <li>The ID usually starts with letters and numbers</li>
              </ol>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default SetRecordSubject;
