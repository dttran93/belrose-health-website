// src/features/RecordRequest/providerDirectory/useProviderSearch.ts

/**
 * useProviderSearch
 *
 * Debounced search hook for the provider directory.
 * The form uses this to power the institution search input.
 *
 * Abstracts the directory implementation entirely — the form component
 * never imports NHSEnglandDirectory or knows which backend is in use.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ProviderDirectoryFactory } from '../ProviderDirectoryFactory';
import type { ProviderDirectoryResult, ProviderRegion } from '../types';

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

interface UseProviderSearchReturn {
  results: ProviderDirectoryResult[];
  loading: boolean;
  error: string | null;
  // Call this to trigger a search (wired to input onChange)
  search: (query: string) => void;
  // Clear results (e.g. when user selects a result or clears the input)
  clear: () => void;
  select: (result: ProviderDirectoryResult) => void; // ← add
  selected: ProviderDirectoryResult | null;
  clearSelection: () => void; // ← add
}

export function useProviderSearch(region: ProviderRegion): UseProviderSearchReturn {
  const [results, setResults] = useState<ProviderDirectoryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProviderDirectoryResult | null>(null);

  const select = useCallback((result: ProviderDirectoryResult) => {
    setSelected(result);
    setResults([]); // close the dropdown
    setError(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
  }, []);

  // Keep a ref to the debounce timer so we can cancel it on new keystrokes
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a ref to the directory instance so it's not recreated on every render
  const directoryRef = useRef(ProviderDirectoryFactory.getDirectory(region));

  // Re-create directory if region changes
  useEffect(() => {
    try {
      directoryRef.current = ProviderDirectoryFactory.getDirectory(region);
    } catch {
      // Region not yet supported — directory stays as previous
    }
  }, [region]);

  const search = useCallback((query: string) => {
    // Clear any pending debounced call
    if (timerRef.current) clearTimeout(timerRef.current);

    if (query.trim().length < MIN_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    timerRef.current = setTimeout(async () => {
      try {
        const data = await directoryRef.current.search(query, { limit: 8 });
        setResults(data);
        setError(null);
      } catch (err: any) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setResults([]);
    setLoading(false);
    setError(null);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { results, loading, error, search, clear, select, selected, clearSelection };
}
