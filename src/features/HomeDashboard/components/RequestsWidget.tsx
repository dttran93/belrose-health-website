// src/features/HomeDashboard/components/RequestsWidget.tsx

/**
 * RequestsWidget
 *
 * Shows the user's most recent outbound record requests (sent to providers).
 * Always visible — shows an empty CTA when there are no requests yet.
 *
 * Uses RecordRequest type from the existing useRecordRequests hook.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { RecordRequest } from '@belrose/shared';

interface RequestsWidgetProps {
  requests: RecordRequest[];
}

const statusConfig = {
  pending: {
    label: 'Pending',
    icon: <Clock className="w-3 h-3" />,
    classes: 'bg-complement-4/15 text-complement-4',
  },
  fulfilled: {
    label: 'Received',
    icon: <CheckCircle2 className="w-3 h-3" />,
    classes: 'bg-complement-3/15 text-complement-3',
  },
  denied: {
    label: 'Denied',
    icon: <XCircle className="w-3 h-3" />,
    classes: 'bg-destructive/10 text-destructive',
  },
  cancelled: {
    label: 'Denied',
    icon: <XCircle className="w-3 h-3" />,
    classes: 'bg-destructive/10 text-destructive',
  },
};

export const RequestsWidget: React.FC<RequestsWidgetProps> = ({ requests }) => {
  const navigate = useNavigate();

  const recent = requests.slice(0, 3);

  if (recent.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <p className="text-sm text-muted-foreground">No requests yet</p>
        <button
          onClick={() => navigate('/app/record-requests')}
          className="flex items-center gap-1 text-xs text-complement-1 font-medium hover:underline"
        >
          <Plus className="w-3 h-3" /> Request from a provider
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {recent.map(req => {
        const config = statusConfig[req.status];
        const name = req.targetEmail || req.targetUserId || 'Unknown provider';

        return (
          <div key={name} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true })}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${config.classes}`}
            >
              {config.icon}
              {config.label}
            </span>
          </div>
        );
      })}

      <div className="pt-2.5">
        <button
          onClick={() => navigate('/app/record-requests')}
          className="flex items-center gap-1 text-xs text-complement-1 font-medium hover:underline"
        >
          <Plus className="w-3 h-3" /> New request
        </button>
      </div>
    </div>
  );
};

export default RequestsWidget;
