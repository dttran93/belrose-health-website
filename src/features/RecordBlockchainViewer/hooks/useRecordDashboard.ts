// src/features/HealthRecordViewer/hooks/useRecordDashboard.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HealthRecordView,
  HealthRecordStats,
  AnchoredRecord,
  Verification,
  Dispute,
  UnacceptedUpdateFlag,
} from '../lib/types';
import {
  getHealthRecordStats,
  getAnchoredRecords,
  getAllVerifications,
  getAllDisputes,
  getAllUnacceptedFlags,
} from '../services/healthRecordService';

interface UseHealthRecordDashboardReturn {
  // View state
  currentView: HealthRecordView;
  setCurrentView: (view: HealthRecordView) => void;

  // Stats
  stats: HealthRecordStats;

  // Loading/error
  isLoading: boolean;
  error: string | null;

  // Anchored records data
  anchoredRecords: AnchoredRecord[];
  filteredRecords: AnchoredRecord[];

  // Verifications data
  verifications: Verification[];
  filteredVerifications: Verification[];

  // Disputes data
  disputes: Dispute[];
  filteredDisputes: Dispute[];

  // Flags data
  unacceptedFlags: UnacceptedUpdateFlag[];
  filteredFlags: UnacceptedUpdateFlag[];

  // Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Actions
  refresh: () => Promise<void>;
}

/**
 * Hook for managing HealthRecordCore dashboard state
 *
 * Handles:
 * - Fetching stats, records, verifications, disputes, flags from blockchain
 * - View switching between anchoring, verifications, disputes, flags
 * - Search/filter functionality
 * - Enriching blockchain data with Firebase profiles (if available)
 */
export function useHealthRecordDashboard(): UseHealthRecordDashboardReturn {
  // ===============================================================
  // STATE
  // ===============================================================

  const [currentView, setCurrentView] = useState<HealthRecordView>('anchoring');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Data state
  const [stats, setStats] = useState<HealthRecordStats>({
    totalAnchoredRecords: 0,
    totalVerifications: 0,
    totalDisputes: 0,
    totalUnacceptedFlags: 0,
  });
  const [anchoredRecords, setAnchoredRecords] = useState<AnchoredRecord[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [unacceptedFlags, setUnacceptedFlags] = useState<UnacceptedUpdateFlag[]>([]);

  // ===============================================================
  // DATA FETCHING
  // ===============================================================

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch stats first (fast)
      const statsData = await getHealthRecordStats();
      setStats(statsData);

      // Fetch all data in parallel
      const [recordsData, verificationsData, disputesData, flagsData] = await Promise.all([
        getAnchoredRecords(),
        getAllVerifications(),
        getAllDisputes(),
        getAllUnacceptedFlags(),
      ]);

      setAnchoredRecords(recordsData);
      setVerifications(verificationsData);
      setDisputes(disputesData);
      setUnacceptedFlags(flagsData);
    } catch (err) {
      console.error('Failed to fetch health record data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ===============================================================
  // FILTERING
  // ===============================================================

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return anchoredRecords;

    const query = searchQuery.toLowerCase();
    return anchoredRecords.filter(record => {
      // Search by record ID
      if (record.recordId.toLowerCase().includes(query)) return true;

      // Search by subject hash or profile
      for (const subject of record.subjects) {
        if (subject.subjectIdHash.toLowerCase().includes(query)) return true;
        if (subject.profile?.displayName.toLowerCase().includes(query)) return true;
        if (subject.profile?.email.toLowerCase().includes(query)) return true;
      }

      // Search by version hash
      for (const version of record.versionHistory) {
        if (version.hash.toLowerCase().includes(query)) return true;
      }

      return false;
    });
  }, [anchoredRecords, searchQuery]);

  const filteredVerifications = useMemo(() => {
    if (!searchQuery.trim()) return verifications;

    const query = searchQuery.toLowerCase();
    return verifications.filter(v => {
      if (v.recordId.toLowerCase().includes(query)) return true;
      if (v.recordHash.toLowerCase().includes(query)) return true;
      if (v.verifierIdHash.toLowerCase().includes(query)) return true;
      if (v.verifierProfile?.displayName.toLowerCase().includes(query)) return true;
      if (v.verifierProfile?.email.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [verifications, searchQuery]);

  const filteredDisputes = useMemo(() => {
    if (!searchQuery.trim()) return disputes;

    const query = searchQuery.toLowerCase();
    return disputes.filter(d => {
      if (d.recordId.toLowerCase().includes(query)) return true;
      if (d.recordHash.toLowerCase().includes(query)) return true;
      if (d.disputerIdHash.toLowerCase().includes(query)) return true;
      if (d.disputerProfile?.displayName.toLowerCase().includes(query)) return true;
      if (d.disputerProfile?.email.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [disputes, searchQuery]);

  const filteredFlags = useMemo(() => {
    if (!searchQuery.trim()) return unacceptedFlags;

    const query = searchQuery.toLowerCase();
    return unacceptedFlags.filter(f => {
      if (f.subjectIdHash.toLowerCase().includes(query)) return true;
      if (f.recordId?.toLowerCase().includes(query)) return true;
      if (f.noteHash.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [unacceptedFlags, searchQuery]);

  // ===============================================================
  // RETURN
  // ===============================================================

  return {
    // View
    currentView,
    setCurrentView,

    // Stats
    stats,

    // Loading/error
    isLoading,
    error,

    // Data
    anchoredRecords,
    filteredRecords,
    verifications,
    filteredVerifications,
    disputes,
    filteredDisputes,
    unacceptedFlags,
    filteredFlags,

    // Filters
    searchQuery,
    setSearchQuery,

    // Actions
    refresh: fetchData,
  };
}
