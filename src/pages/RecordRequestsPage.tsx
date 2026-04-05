// src/pages/RecordRequestsPage.tsx

/**
 * RecordRequestsPage  —  /app/record-requests
 *
 * Two views managed by a `pageView` state:
 *
 *   'list'  — stat cards + filter tabs + expandable request cards
 *   'new'   — two-step form
 *               Step 1: Find your provider (region, institution search, doctor, email)
 *               Step 2: Your request details (name, date range, note, send)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { useRecordRequests } from '@/features/RequestRecord/hooks/useRecordRequests';
import NewRequestForm from '@/features/RequestRecord/components/Request/NewRequestForm';
import RequestListView from '@/features/RequestRecord/components/Request/RequestListView';

// ── Page ──────────────────────────────────────────────────────────────────────

type PageView = 'list' | 'new';

const RecordRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const {
    filtered,
    loading,
    error,
    filter,
    setFilter,
    refresh,
    cancelRequest,
    resendRequest,
    counts,
  } = useRecordRequests();

  const [pageView, setPageView] = useState<PageView>('list');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => setExpandedId(prev => (prev === id ? null : id));

  return (
    <div className="min-h-screen bg-gray-50">
      {pageView === 'list' && (
        <RequestListView
          filtered={filtered}
          loading={loading}
          error={error}
          filter={filter}
          setFilter={setFilter}
          refresh={refresh}
          cancelRequest={cancelRequest}
          resendRequest={resendRequest}
          counts={counts}
          expandedId={expandedId}
          toggleExpand={toggleExpand}
          onNew={() => setPageView('new')}
          onViewRecord={id => navigate('/app/all-records', { state: { openRecordId: id } })}
        />
      )}

      {pageView === 'new' && (
        <NewRequestForm
          user={user}
          onBack={() => setPageView('list')}
          onSuccess={() => {
            refresh();
            setPageView('list');
          }}
        />
      )}
    </div>
  );
};

export default RecordRequestsPage;
