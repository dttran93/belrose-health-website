// src/features/Settings/components/SearchDiscoverabilityToggle.tsx

import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { updateSearchDiscoverable } from '@/features/Users/services/userProfileService';
import { toast } from 'sonner';

interface SearchDiscoverabilityToggleProps {
  currentValue: boolean;
  onUpdate?: (newValue: boolean) => void;
}

export const SearchDiscoverabilityToggle: React.FC<SearchDiscoverabilityToggleProps> = ({
  currentValue,
  onUpdate,
}) => {
  const [isDiscoverable, setIsDiscoverable] = useState(currentValue);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async () => {
    const newValue = !isDiscoverable;
    setIsSaving(true);

    try {
      await updateSearchDiscoverable(newValue);
      setIsDiscoverable(newValue);
      onUpdate?.(newValue);
      toast.success(
        newValue
          ? 'You are now discoverable by name and email search'
          : 'You are no longer discoverable by name and email search'
      );
    } catch (err) {
      console.error('Failed to update discoverability:', err);
      toast.error('Failed to update privacy setting. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          {isDiscoverable ? (
            <Eye className="w-4 h-4 text-gray-500" />
          ) : (
            <EyeOff className="w-4 h-4 text-gray-500" />
          )}
          <span className="text-sm font-medium text-gray-900">Search discoverability</span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed text-left">
          When enabled, others can find you by searching your name or email. When disabled, only
          people who already know your exact email or user ID can find you.{' '}
          <span className="text-gray-400">
            Your health data is never exposed — this only controls profile discoverability.
          </span>
        </p>
      </div>

      {/* Toggle switch */}
      <button
        onClick={handleToggle}
        disabled={isSaving}
        aria-label={
          isDiscoverable ? 'Disable search discoverability' : 'Enable search discoverability'
        }
        className={`relative flex-shrink-0 mt-0.5 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          isDiscoverable ? 'bg-primary' : 'bg-gray-300'
        } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isSaving ? (
          <Loader2 className="absolute inset-0 m-auto w-3 h-3 animate-spin text-white" />
        ) : (
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              isDiscoverable ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        )}
      </button>
    </div>
  );
};

export default SearchDiscoverabilityToggle;
