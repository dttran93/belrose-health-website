// ── LIST VIEW ─────────────────────────────────────────────────────────────────

import { AlertCircle, Inbox, Loader2, Plus, RefreshCw } from 'lucide-react';
import { RequestFilter } from '../../hooks/useRecordRequests';
import { Button } from '@/components/ui/Button';
import RequestCard from '../ui/RequestCard';
import { RecordRequest } from '../../services/fulfillRequestService';

interface RequestListViewProps {
  filtered: RecordRequest[];
  loading: boolean;
  error: string | null;
  filter: RequestFilter;
  setFilter: (f: RequestFilter) => void;
  refresh: () => void;
  cancelRequest: (id: string) => Promise<void>;
  resendRequest: (id: string) => Promise<void>;
  counts: { pending: number; opened: number; fulfilled: number };
  expandedId: string | null;
  toggleExpand: (id: string) => void;
  onNew: () => void;
  onViewRecord: (id: string) => void;
}

const RequestListView: React.FC<RequestListViewProps> = ({
  filtered,
  loading,
  error,
  filter,
  setFilter,
  refresh,
  cancelRequest,
  resendRequest,
  counts,
  expandedId,
  toggleExpand,
  onNew,
  onViewRecord,
}) => (
  <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Record requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          Request your health records from providers via a secure upload link.
        </p>
      </div>
      <Button onClick={onNew} className="gap-2 flex-shrink-0">
        <Plus className="w-4 h-4" />
        New request
      </Button>
    </div>

    <div className="grid grid-cols-3 gap-3">
      <StatCard label="Pending" value={counts.pending} color="amber" />
      <StatCard label="Opened" value={counts.opened} color="blue" />
      <StatCard label="Fulfilled" value={counts.fulfilled} color="green" />
    </div>

    <div className="flex items-center justify-between">
      <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
        {(['active', 'fulfilled', 'all'] as RequestFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
              filter === f
                ? 'bg-slate-900 text-white font-medium'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <button
        onClick={refresh}
        className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
        title="Refresh"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
    </div>

    {loading && (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )}
    {error && !loading && (
      <div className="bg-white rounded-2xl border border-red-200 p-6 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )}
    {!loading && !error && filtered.length === 0 && <EmptyState filter={filter} onNew={onNew} />}
    {!loading &&
      !error &&
      filtered.map(request => (
        <RequestCard
          key={request.inviteCode}
          request={request}
          isExpanded={expandedId === request.inviteCode}
          onToggle={() => toggleExpand(request.inviteCode)}
          onCancel={cancelRequest}
          onResend={resendRequest}
          onViewRecord={onViewRecord}
        />
      ))}
  </div>
);

// ── StatCard ──────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: number;
  color: 'amber' | 'blue' | 'green';
}> = ({ label, value, color }) => {
  const bg = { amber: 'bg-amber-50', blue: 'bg-blue-50', green: 'bg-green-50' };
  const num = { amber: 'text-amber-700', blue: 'text-blue-700', green: 'text-green-700' };
  return (
    <div className={`${bg[color]} rounded-xl p-4`}>
      <p className={`text-2xl font-semibold ${num[color]}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
};

const EmptyState: React.FC<{ filter: RequestFilter; onNew: () => void }> = ({ filter, onNew }) => {
  const messages: Record<RequestFilter, string> = {
    active: 'No active requests.',
    fulfilled: 'No fulfilled requests yet.',
    all: "You haven't sent any requests yet.",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 py-16 flex flex-col items-center text-center gap-4">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
        <Inbox className="w-6 h-6 text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">{messages[filter]}</p>
        {filter !== 'fulfilled' && (
          <p className="text-xs text-slate-400 mt-1">Send your first request to get started.</p>
        )}
      </div>
      {filter !== 'fulfilled' && (
        <Button onClick={onNew} variant="outline" className="gap-2">
          <Plus className="w-4 h-4" />
          New request
        </Button>
      )}
    </div>
  );
};

export default RequestListView;
