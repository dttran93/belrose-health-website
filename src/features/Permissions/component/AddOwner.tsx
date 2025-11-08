import React, { useState } from 'react';
import { UserPlus, Search, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '../hooks/usePermissions';
import { getUserProfile, UserProfile } from '@/components/auth/services/userProfileService';
import * as Dialog from '@radix-ui/react-dialog';

interface AddOwnerProps {
  recordId: string;
  currentOwners: string[];
  onSuccess?: () => void;
}

export const AddOwner: React.FC<AddOwnerProps> = ({ recordId, currentOwners, onSuccess }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedProfile, setSearchedProfile] = useState<UserProfile | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const { addOwner, isLoading } = usePermissions({
    onSuccess: msg => {
      setIsOpen(false);
      onSuccess?.();
    },
    onError: err => {
      // Error is handled by the hook
    },
  });

  // Search for user by ID or email
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a user ID or email');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSearchedProfile(null);

    try {
      // Try to get profile by ID
      const profile = await getUserProfile(searchQuery.trim());

      if (profile) {
        // Check if user is already an owner
        if (currentOwners.includes(profile.uid)) {
          setSearchError('This user is already an owner');
          setSearchedProfile(null);
        } else {
          setSearchedProfile(profile);
          setSearchError(null);
        }
      } else {
        setSearchError('User not found. Make sure the user ID is correct.');
      }
    } catch (error) {
      setSearchError('Error searching for user');
    } finally {
      setSearching(false);
    }
  };

  const handleAddOwner = async () => {
    if (!searchedProfile) return;

    const success = await addOwner(recordId, searchedProfile.uid);
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

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Owner
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl z-50 w-full max-w-md p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-xl font-bold text-gray-900">Add Owner</Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                onClick={handleClose}
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-900 font-medium mb-2">What can owners do?</p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• View and edit the record</li>
              <li>• Share the record with others</li>
              <li>• Add and remove other owners</li>
              <li>• Verify or dispute the record</li>
            </ul>
          </div>

          {/* Search */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search User</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter user ID or email..."
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
              <p className="text-xs text-gray-500 mt-1">Search by user ID or email address</p>
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
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {searchedProfile.displayName || 'No name'}
                    </p>
                    <p className="text-sm text-gray-600">{searchedProfile.email}</p>
                    {searchedProfile.affiliations && searchedProfile.affiliations.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {searchedProfile.affiliations.join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <Button onClick={handleAddOwner} disabled={isLoading} className="w-full">
                  {isLoading ? 'Adding Owner...' : 'Add as Owner'}
                </Button>
              </div>
            )}
          </div>

          {/* Current Owners Count */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Current owners: <span className="font-semibold">{currentOwners.length}</span>
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default AddOwner;
