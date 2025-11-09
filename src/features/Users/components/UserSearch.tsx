// src/features/User/components/UserSearch.tsx

import React, { useState } from 'react';
import { Search, X, Loader2, User, Mail, Hash } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import { BelroseUserProfile } from '@/types/core';

interface UserSearchProps {
  onUserSelect: (user: BelroseUserProfile) => void;
  excludeUserIds?: string[]; // Users to exclude from results (e.g., already added)
  placeholder?: string;
  showFilters?: boolean; // Show search type filters
  autoFocus?: boolean;
  className?: string;
}

type SearchType = 'all' | 'id' | 'email' | 'name';

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

  // Handle search
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
      // For now, we'll search by ID (since that's what getUserProfile supports)
      // In production, you'd call a backend API that can search by name/email
      const profile = await getUserProfile(searchQuery.trim());

      if (profile) {
        // Check if user should be excluded
        if (excludeUserIds.includes(profile.uid)) {
          setError('This user has already been added');
          setSearchResults([]);
        } else {
          setSearchResults([profile]);
          setError(null);
        }
      } else {
        setError('No user found matching your search');
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Error searching for user. Please try again.');
      setSearchResults([]);
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

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

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
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              autoFocus={autoFocus}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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

        {/* Optional Search Type Filters */}
        {showFilters && (
          <div className="flex gap-2">
            <button
              onClick={() => setSearchType('all')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                searchType === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSearchType('id')}
              className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                searchType === 'id'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Hash className="w-3 h-3" />
              ID
            </button>
            <button
              onClick={() => setSearchType('email')}
              className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                searchType === 'email'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Mail className="w-3 h-3" />
              Email
            </button>
            <button
              onClick={() => setSearchType('name')}
              className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                searchType === 'name'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <User className="w-3 h-3" />
              Name
            </button>
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
          <p className="text-xs text-gray-600 font-medium">Search Results:</p>
          {searchResults.map(user => (
            <div
              key={user.uid}
              onClick={() => handleSelectUser(user)}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 hover:border-primary cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {user.displayName || 'No name'}
                  </p>
                  <p className="text-sm text-gray-600 truncate">{user.email}</p>
                  {user.affiliations && user.affiliations.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {user.affiliations.join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1 truncate">ID: {user.uid}</p>
                </div>
                <div className="text-xs text-gray-400 group-hover:text-primary transition-colors">
                  Click to select →
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {hasSearched && !isSearching && searchResults.length === 0 && !error && (
        <div className="text-center py-8">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No users found</p>
          <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
};

export default UserSearch;
