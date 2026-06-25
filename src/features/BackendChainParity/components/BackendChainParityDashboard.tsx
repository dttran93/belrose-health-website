// src/features/BackendChainParity/components/BackendChainParityDashboard.tsx

import React, { useState, useMemo } from 'react';
import { RefreshCw, Loader2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { SummaryCards } from './SummaryCards';
import { RecordsIntegrityTable } from './RecordsIntegrityTable';
import { MembersIntegrityTable } from './MembersIntegrityTable';
import { CredibilityIntegrityTable } from './CredibilityIntegrityTable';
import { SyncFailuresTable } from './SyncFailuresTable';
import { TrusteesIntegrityTable } from './TrusteesIntegrityTable';
import { useRecordsIntegrity } from '../hooks/useRecordsIntegrity';
import { useMembersIntegrity } from '../hooks/useMembersIntegrity';
import {
  useVerificationsIntegrity,
  useDisputesIntegrity,
} from '../hooks/useVerificationsIntegrity';
import { useSyncFailures } from '../hooks/useSyncFailures';
import { useTrusteesIntegrity } from '../hooks/useTrusteesIntegrity';
import { computeSummary } from '../lib/types';
import type { IntegrityStatus } from '../lib/types';

type TabId =
  | 'summary'
  | 'records'
  | 'members'
  | 'credibility'
  | 'sync-failures'
  | 'trustees'
  | 'role-events';

const TABS: Array<{ id: TabId; label: string; phase2?: boolean }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'records', label: 'Records' },
  { id: 'members', label: 'Members' },
  { id: 'credibility', label: 'Credibility' },
  { id: 'trustees', label: 'Trustees' },
  { id: 'role-events', label: 'Role Events', phase2: true },
  { id: 'sync-failures', label: 'Chain Failures' },
];

const BackendChainParityDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<IntegrityStatus | 'all'>('all');

  const queryClient = useQueryClient();

  const records = useRecordsIntegrity();
  const members = useMembersIntegrity();
  const verifications = useVerificationsIntegrity();
  const disputes = useDisputesIntegrity();
  const syncFailures = useSyncFailures();
  const trustees = useTrusteesIntegrity();

  const isAnyLoading =
    records.isFetching ||
    members.isFetching ||
    verifications.isFetching ||
    disputes.isFetching ||
    trustees.isFetching;

  const lastChecked = [
    records.dataUpdatedAt,
    members.dataUpdatedAt,
    verifications.dataUpdatedAt,
    disputes.dataUpdatedAt,
    trustees.dataUpdatedAt,
  ]
    .filter(Boolean)
    .reduce((a, b) => Math.min(a, b), Infinity);

  const recordsSummary = records.data ? computeSummary(records.data) : undefined;
  const membersSummary = members.data ? computeSummary(members.data) : undefined;
  const verificationsSummary = verifications.data ? computeSummary(verifications.data) : undefined;
  const disputesSummary = disputes.data ? computeSummary(disputes.data) : undefined;
  const trusteesSummary = trustees.data ? computeSummary(trustees.data) : undefined;

  // Keyed by recordId so RecordsIntegrityTable can show counts per record in the expanded panel
  const verificationsMap = useMemo(() => {
    const map: Record<string, typeof verifications.data> = {};
    for (const v of verifications.data ?? []) {
      if (v.recordId) {
        (map[v.recordId] ??= []).push(v);
      }
    }
    return map;
  }, [verifications.data]);

  const disputesMap = useMemo(() => {
    const map: Record<string, typeof disputes.data> = {};
    for (const d of disputes.data ?? []) {
      if (d.recordId) {
        (map[d.recordId] ??= []).push(d);
      }
    }
    return map;
  }, [disputes.data]);

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['backend-chain-parity'] });
  }

  const statusFilterOptions: Array<{ value: IntegrityStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'synced', label: 'Synced' },
    { value: 'mismatch', label: 'Mismatch' },
    { value: 'missing', label: 'Missing' },
    { value: 'chain_only', label: 'Chain Only' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' },
    { value: 'not_applicable', label: 'N/A' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Backend ↔ Chain Parity</h1>
              <p className="text-gray-500 mt-1 text-sm">
                Firestore-first reconciliation against on-chain state
                {lastChecked !== Infinity && (
                  <span className="ml-2 text-gray-400">
                    · Last checked {new Date(lastChecked).toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={isAnyLoading}
              className="flex items-center gap-2"
            >
              {isAnyLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh from Chain
            </Button>
          </div>

          {/* Tab Navigation */}
          <nav className="mt-6 -mb-px flex space-x-6 overflow-x-auto">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.phase2 && (
                    <span className="text-xs text-gray-400 font-normal">(Phase 2)</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Search + Filter Bar (hidden on summary tab) */}
      {activeTab !== 'summary' && !['trustees', 'role-events'].includes(activeTab) && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search by ID, hash, name, email, or wallet..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 bg-background border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {statusFilterOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {activeTab === 'summary' && (
          <div className="pt-6">
            <SummaryCards
              records={recordsSummary}
              members={membersSummary}
              verifications={verificationsSummary}
              disputes={disputesSummary}
              isLoading={isAnyLoading}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: 'Records', summary: recordsSummary, tab: 'records' as TabId },
                { label: 'Members', summary: membersSummary, tab: 'members' as TabId },
                {
                  label: 'Verifications',
                  summary: verificationsSummary,
                  tab: 'verifications' as TabId,
                },
                { label: 'Disputes', summary: disputesSummary, tab: 'verifications' as TabId },
              ].map(({ label, summary, tab }) => (
                <div
                  key={label}
                  className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-blue-300 transition-colors"
                  onClick={() => setActiveTab(tab)}
                >
                  <div className="font-semibold text-gray-800 mb-3">{label}</div>
                  {summary ? (
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-2xl font-bold text-emerald-600">{summary.synced}</div>
                        <div className="text-xs text-gray-500">Synced</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-amber-600">
                          {summary.mismatch + summary.missing}
                        </div>
                        <div className="text-xs text-gray-500">Issues</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-400">{summary.pending}</div>
                        <div className="text-xs text-gray-500">Pending</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="pt-2">
            {records.isLoading ? (
              <LoadingState label="records" />
            ) : records.error ? (
              <ErrorState error={String(records.error)} />
            ) : (
              <RecordsIntegrityTable
                items={records.data ?? []}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                verificationsMap={verificationsMap}
                disputesMap={disputesMap}
                onViewVerifications={hash => {
                  setActiveTab('credibility');
                  if (hash) setSearchQuery(hash);
                }}
                onViewMember={uid => {
                  setActiveTab('members');
                  setSearchQuery(uid);
                }}
                onClearSearch={() => setSearchQuery('')}
              />
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="pt-2">
            {members.isLoading ? (
              <LoadingState label="members" />
            ) : members.error ? (
              <ErrorState error={String(members.error)} />
            ) : (
              <MembersIntegrityTable
                items={members.data ?? []}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                onClearSearch={() => setSearchQuery('')}
              />
            )}
          </div>
        )}

        {activeTab === 'credibility' && (
          <div className="pt-2">
            {verifications.isLoading || disputes.isLoading ? (
              <LoadingState label="verifications & disputes" />
            ) : (
              <CredibilityIntegrityTable
                verifications={verifications.data ?? []}
                disputes={disputes.data ?? []}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                onClearSearch={() => setSearchQuery('')}
              />
            )}
          </div>
        )}

        {activeTab === 'sync-failures' && (
          <div className="pt-2">
            {syncFailures.isLoading ? (
              <LoadingState label="sync failures" />
            ) : syncFailures.error ? (
              <ErrorState error={String(syncFailures.error)} />
            ) : (
              <SyncFailuresTable items={syncFailures.data ?? []} searchQuery={searchQuery} />
            )}
          </div>
        )}

        {activeTab === 'trustees' && (
          <div className="pt-2">
            {trustees.isLoading ? (
              <LoadingState label="trustee relationships" />
            ) : trustees.error ? (
              <ErrorState error={String(trustees.error)} />
            ) : (
              <TrusteesIntegrityTable
                items={trustees.data ?? []}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                onClearSearch={() => setSearchQuery('')}
              />
            )}
          </div>
        )}

        {activeTab === 'role-events' && (
          <div className="pt-8 text-center">
            <div className="inline-block bg-white border border-gray-200 rounded-xl px-8 py-10">
              <div className="text-gray-400 text-sm mb-2 font-medium uppercase tracking-wide">
                Phase 2
              </div>
              <div className="text-gray-700 font-semibold text-lg mb-1">Role Event Parity</div>
              <div className="text-gray-400 text-sm max-w-sm">
                Bidirectional reconciliation between Firestore{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">permissionChangeEvents</code>{' '}
                and on-chain state — coming in a future release.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const LoadingState: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center py-16">
    <div className="text-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
      <p className="text-gray-500 text-sm">Checking {label} against blockchain…</p>
    </div>
  </div>
);

const ErrorState: React.FC<{ error: string }> = ({ error }) => (
  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
    <span className="font-medium">Error: </span>
    {error}
  </div>
);

export default BackendChainParityDashboard;
