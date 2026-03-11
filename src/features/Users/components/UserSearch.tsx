// src/features/Users/components/UserSearch.tsx

import React, { useState } from 'react';
import { Search, X, Loader2, User, Mail, Hash } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { searchUsers, SearchType } from '@/features/Users/services/userProfileService';
import { BelroseUserProfile } from '@/types/core';
import UserCard from './ui/UserCard';
import { getAuth } from 'firebase/auth';

interface UserSearchProps {
  onUserSelect: (user: BelroseUserProfile) => void;
  excludeUserIds?: string[];
  placeholder?: string;
  showFilters?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export const UserSearch: React.FC<UserSearchProps> = ({
  onUserSelect,
  excludeUserIds = [],
  placeholder = 'Search by name, email, or ID...',
  showFilters = false,
  autoFocus = true,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [searchResults, setSearchResults] = useState<BelroseUserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search term');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    setHasSearched(true);

    try {
      const currentUserId = getAuth().currentUser?.uid;
      const results = await searchUsers(searchQuery, searchType, currentUserId);
      const filtered = results.filter(user => !excludeUserIds.includes(user.uid));

      if (filtered.length === 0 && results.length > 0) {
        setError('All matching users have already been added');
      }

      setSearchResults(filtered);
    } catch (err) {
      console.error('Search error:', err);
      setError('Error searching for users. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle user selection
  const handleSelectUser = (user: BelroseUserProfile) => {
    onUserSelect(user);
    // Clear search after selection
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setError(null);
  };

  // Clear search
  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
    setHasSearched(false);
  };

  const filterButtons: { type: SearchType; label: string; icon?: React.ReactNode }[] = [
    { type: 'all', label: 'All' },
    { type: 'id', label: 'ID', icon: <Hash className="w-3 h-3" /> },
    { type: 'email', label: 'Email', icon: <Mail className="w-3 h-3" /> },
    { type: 'name', label: 'Name', icon: <User className="w-3 h-3" /> },
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSearch()}
              placeholder={placeholder}
              autoFocus={autoFocus}
              className="w-full bg-input px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            {searchQuery && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Search Type Filters */}
        {showFilters && (
          <div className="flex gap-2">
            {filterButtons.map(({ type, label, icon }) => (
              <button
                key={type}
                onClick={() => setSearchType(type)}
                className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                  searchType === type
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-600 font-medium">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          </p>
          {searchResults.map(user => (
            <UserCard
              key={user.uid}
              user={user}
              onViewUser={() => {}}
              onDelete={() => {}}
              onCardClick={() => {}}
              variant="default"
              color="yellow"
              menuType="acceptOrCancel"
              onAccept={() => handleSelectUser(user)}
              onCancel={handleClear}
            />
          ))}
        </div>
      )}

      {/* No Results */}
      {hasSearched && !isSearching && searchResults.length === 0 && !error && (
        <div className="text-center py-8">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No users found</p>
          <p className="text-xs text-gray-400 mt-1">
            Try a different search term or exact ID/email
          </p>
        </div>
      )}
    </div>
  );
};

export default UserSearch;
