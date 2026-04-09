// src/features/RecordRequest/components/InboundRequestListView.tsx

import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { InboundRequestFilter } from '../../hooks/usePendingInboundRequests';
import { RecordRequest } from '../../services/fulfillRequestService';
import InboundRequestCard from '../ui/InboundRequestCard';

interface InboundRequestListViewProps {
  filtered: RecordRequest[];
  loading: boolean;
  error: string | null;
  filter: InboundRequestFilter;
  setFilter: (f: InboundRequestFilter) => void;
  counts: { pending: number; fulfilled: number };
  onFulfill: (request: RecordRequest) => void;
}

const InboundRequestListView: React.FC<InboundRequestListViewProps> = ({
  filtered,
  loading,
  error,
  filter,
  setFilter,
  counts,
  onFulfill,
}) => (
  <div className="space-y-4">
    {/* Stat cards */}
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-amber-50 rounded-xl p-4">
        <p className="text-2xl font-semibold text-amber-700">{counts.pending}</p>
        <p className="text-xs text-slate-500 mt-0.5">Awaiting upload</p>
      </div>
      <div className="bg-green-50 rounded-xl p-4">
        <p className="text-2xl font-semibold text-green-700">{counts.fulfilled}</p>
        <p className="text-xs text-slate-500 mt-0.5">Fulfilled</p>
      </div>
    </div>

    {/* Filter tabs */}
    <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 w-fit">
      {(['pending', 'fulfilled', 'all'] as InboundRequestFilter[]).map(f => (
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

    {/* States */}
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
    {!loading && !error && filtered.length === 0 && (
      <div className="bg-white rounded-2xl border border-slate-200 py-16 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
          <Inbox className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-700">
          {filter === 'pending'
            ? 'No pending requests.'
            : filter === 'fulfilled'
              ? 'No fulfilled requests yet.'
              : 'No incoming requests.'}
        </p>
      </div>
    )}
    {!loading &&
      !error &&
      filtered.map(r => (
        <InboundRequestCard key={r.inviteCode} request={r} onFulfill={onFulfill} />
      ))}
  </div>
);

export default InboundRequestListView;
