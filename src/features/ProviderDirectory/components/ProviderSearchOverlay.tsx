// src/features/ProviderDirectory/components/ProviderSearchOverlay.tsx

/**
 * ProviderSearchOverlay
 *
 * Renders a search input + results dropdown for finding NHS providers.
 * Used in Step 1 of the new request form.
 *
 * Shows:
 *   - Search input with loading spinner
 *   - Results dropdown with institution name, address, phone
 *   - "No results" state
 *   - Selected provider confirmation card with "Change" button
 *
 * The parent passes in the hook's search/select/clear functions rather
 * than calling them internally, keeping this component purely presentational.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Search,
  Loader2,
  MapPin,
  Phone,
  Building2,
  CheckCircle,
  X,
  AlertTriangle,
} from 'lucide-react';
import type { ProviderDirectoryResult } from '../types';

interface ProviderSearchOverlayProps {
  results: ProviderDirectoryResult[];
  loading: boolean;
  error: string | null;
  selected: ProviderDirectoryResult | null;
  onSearch: (query: string) => void;
  onSelect: (result: ProviderDirectoryResult) => void;
  onClear: () => void;
  onClearSelection: () => void;
  onManualInput: () => void;
}

const ProviderSearchOverlay: React.FC<ProviderSearchOverlayProps> = ({
  results,
  loading,
  error,
  selected,
  onSearch,
  onSelect,
  onClear,
  onClearSelection,
  onManualInput,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        onClear();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClear]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onSearch(val);
    setShowDropdown(val.length >= 2);
  };

  const handleSelect = (result: ProviderDirectoryResult) => {
    setInputValue('');
    setShowDropdown(false);
    onSelect(result);
  };

  const handleClearSelection = () => {
    setInputValue('');
    onClearSelection();
  };

  // ── Closed practice warning card ─────────────────────────────────────────────
  if (selected?.status === 'closed') {
    const icb = selected.parentInstitutions.find(p => p.type === 'Integrated Care Board');

    return (
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {selected.institutionName}
              </p>
              <p className="text-xs text-amber-700 mt-0.5 font-medium">This practice is closed</p>
              {selected.address.lines.length > 0 && (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {[...selected.address.lines, selected.address.postCode]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearSelection}
            className="text-xs text-slate-400 hover:text-slate-600 flex-shrink-0 flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            Change
          </button>
        </div>

        <div className="bg-white border border-amber-200 rounded-md px-3 py-2">
          <p className="text-xs text-slate-700">
            Records from closed practices are held by their parent organisation.
            {icb
              ? ` Your request will be directed to ${icb.name}.`
              : ' Your request will be directed to their Integrated Care Board.'}
          </p>
          {!selected.email && (
            <p className="text-xs text-amber-600 mt-1">
              No contact email found — you may need to enter the ICB's email manually below.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Active practice confirmation card ─────────────────────────────────────────
  if (selected?.status === 'active') {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-left text-sm font-medium text-slate-900 truncate">
                {selected.institutionName}
              </p>
              {selected.address.lines.length > 0 && (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {[...selected.address.lines, selected.address.postCode]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              {selected.phone && (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  {selected.phone}
                </p>
              )}
              {!selected.email && (
                <p className="text-xs text-amber-600 mt-1">
                  No email found in NHS directory — enter manually below
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearSelection}
            className="rounded-lg px-1 py-0.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-red-100 flex-shrink-0 flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            Change
          </button>
        </div>
      </div>
    );
  }

  // ── Search input + dropdown ─────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => (results.length > 0 || loading) && setShowDropdown(true)}
          placeholder="Search by practice name or postcode..."
          autoComplete="off"
          className="w-full h-9 pl-9 pr-9 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {/* Loading state */}
          {loading && results.length === 0 && (
            <div className="px-3 py-3 text-xs text-slate-400 text-center">Searching...</div>
          )}

          {/* Error state */}
          {error && <div className="px-3 py-2.5 text-xs text-red-600">{error}</div>}

          {/* Empty state */}
          {!loading && !error && results.length === 0 && inputValue.length >= 2 && (
            <div className="px-3 py-4 text-center text-xs text-slate-500">
              No practices found for "{inputValue}"
            </div>
          )}

          {/* Results */}
          {results.map(result => (
            <button
              key={result.id}
              type="button"
              onClick={() => handleSelect(result)}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
            >
              <div className="flex items-start gap-2.5">
                <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {result.institutionName}
                    </p>
                    {result.status === 'closed' && (
                      <span className="flex-shrink-0 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        closed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {[...result.address.lines, result.address.postCode].filter(Boolean).join(', ')}
                  </p>
                  {result.phone && <p className="text-xs text-slate-400 mt-0.5">{result.phone}</p>}
                </div>
                {result.email && (
                  <span className="flex-shrink-0 text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full self-start mt-0.5">
                    email ✓
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-1.5">
        Can't find your provider?{' '}
        <button
          type="button"
          onClick={onManualInput}
          className="text-slate-500 underline underline-offset-2 hover:text-slate-700"
        >
          Enter their details manually
        </button>
      </p>
    </div>
  );
};

export default ProviderSearchOverlay;
