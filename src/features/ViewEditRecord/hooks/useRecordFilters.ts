// src/features/ViewEditRecord/hooks/useRecordFilters.ts

import { useState, useMemo } from 'react';
import { FileObject } from '@/types/core';
import { toDate } from '@/utils/dataFormattingUtils';

interface UseRecordFiltersReturn {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sourceTypeFilter: string;
  setSourceTypeFilter: (type: string) => void;
  filteredRecords: FileObject[];
  sortedRecords: FileObject[];
  sourceTypes: string[];
}

export const useRecordFilters = (records: FileObject[]): UseRecordFiltersReturn => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all');

  // Get unique source types for the filter dropdown
  const sourceTypes = useMemo(
    () => Array.from(new Set(records.map(r => r.sourceType).filter(Boolean))) as string[],
    [records]
  );

  // Filter by search term and source type
  const filteredRecords = useMemo(
    () =>
      records.filter(record => {
        const matchesSearch =
          (record.fileName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (record.sourceType || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = sourceTypeFilter === 'all' || record.sourceType === sourceTypeFilter;

        return matchesSearch && matchesType;
      }),
    [records, searchTerm, sourceTypeFilter]
  );

  // Sort filtered records by date, newest first
  const sortedRecords = useMemo(
    () =>
      [...filteredRecords].sort((a, b) => {
        const dateA = toDate(a.createdAt);
        const dateB = toDate(b.createdAt);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.getTime() - dateA.getTime();
      }),
    [filteredRecords]
  );

  return {
    searchTerm,
    setSearchTerm,
    sourceTypeFilter,
    setSourceTypeFilter,
    filteredRecords,
    sortedRecords,
    sourceTypes,
  };
};
