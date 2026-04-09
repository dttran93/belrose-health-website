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
import InboundRequestListView from '@/features/RequestRecord/components/Request/InboundRequestListView';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { RecordRequest } from '@/features/RequestRecord/services/fulfillRequestService';
import { useInboundRequests } from '@/features/RequestRecord/hooks/usePendingInboundRequests';

type PageView = 'list' | 'new';
type Tab = 'sent' | 'received';

const RecordRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const outbound = useRecordRequests();
  const inbound = useInboundRequests();

  const [pageView, setPageView] = useState<PageView>('list');
  const [tab, setTab] = useState<Tab>('sent');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => setExpandedId(prev => (prev === id ? null : id));

  const handleFulfill = (request: RecordRequest) => {
    // Pass the request context via router state so the add-record page
    // can pre-populate and mark the request as fulfilled on upload
    navigate('/app/add-record', { state: { fulfillRequest: request } });
  };

  if (pageView === 'new') {
    return (
      <div className="min-h-screen bg-gray-50">
        <NewRequestForm
          user={user}
          onBack={() => setPageView('list')}
          onSuccess={() => {
            outbound.refresh();
            setPageView('list');
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start text-left justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Record requests</h1>
            <p className="text-sm text-gray-500 mt-1">
              {tab === 'sent' ? (
                <>
                  <span>Request your health records</span>
                </>
              ) : (
                <>
                  <span>Fulfill requests from other users.</span>
                </>
              )}
            </p>
          </div>
          {tab === 'sent' && (
            <Button onClick={() => setPageView('new')} className="gap-2 flex-shrink-0">
              <Plus className="w-4 h-4" />
              New request
            </Button>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('sent')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              tab === 'sent'
                ? 'bg-slate-900 text-white font-medium'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sent by me
          </button>
          <button
            onClick={() => setTab('received')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2 ${
              tab === 'received'
                ? 'bg-slate-900 text-white font-medium'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Received
            {inbound.counts.pending > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  tab === 'received' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {inbound.counts.pending}
              </span>
            )}
          </button>
        </div>

        {/* Tab content */}
        {tab === 'sent' && (
          <RequestListView
            filtered={outbound.filtered}
            loading={outbound.loading}
            error={outbound.error}
            filter={outbound.filter}
            setFilter={outbound.setFilter}
            refresh={outbound.refresh}
            cancelRequest={outbound.cancelRequest}
            resendRequest={outbound.resendRequest}
            counts={outbound.counts}
            expandedId={expandedId}
            toggleExpand={toggleExpand}
            onNew={() => setPageView('new')}
            onViewRecord={id => navigate('/app/all-records', { state: { openRecordId: id } })}
          />
        )}

        {tab === 'received' && (
          <InboundRequestListView
            filtered={inbound.filtered}
            loading={inbound.loading}
            error={inbound.error}
            filter={inbound.filter}
            setFilter={inbound.setFilter}
            counts={inbound.counts}
            onFulfill={handleFulfill}
          />
        )}
      </div>
    </div>
  );
};

export default RecordRequestsPage;
