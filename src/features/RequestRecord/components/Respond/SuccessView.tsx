// src/features/RquestRecord/components/SuccessView.tsx

import { Button } from '@/components/ui/Button';
import { AlertTriangle, CheckCircle, UserPlus } from 'lucide-react';
import { RecordRequest } from '../../services/fulfillRequestService';

interface SuccessViewProps {
  recordRequest: RecordRequest;
  isRegisteredUser: boolean;
  hasKeyInMemory: boolean;
  onRegister: () => void;
}

const SuccessView: React.FC<SuccessViewProps> = ({
  recordRequest,
  isRegisteredUser,
  hasKeyInMemory,
  onRegister,
}) => (
  <div className="max-w-lg mx-auto space-y-5">
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-green-50 px-6 py-8 flex flex-col items-center text-center border-b border-green-100">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Record sent successfully</h2>
        <p className="text-slate-500 text-sm mt-1">
          {recordRequest.requesterName} will be notified and can now access the record.
        </p>
      </div>

      <div className="px-6 py-5">
        {isRegisteredUser ? (
          <p className="text-sm text-slate-600 text-center">
            The record is also saved to your Belrose account.
          </p>
        ) : hasKeyInMemory ? (
          /* Path B — key still in memory, nudge to register NOW */
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Create your account now</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Your access to this record is available{' '}
                    <strong>only while this page is open</strong>. If you navigate away or close
                    this tab, you won't be able to access it on Belrose.
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={onRegister} className="w-full gap-2">
              <UserPlus className="w-4 h-4" />
              Create free account & save access
            </Button>
            <p className="text-xs text-slate-400 text-center">
              Free forever. No credit card required.
            </p>
          </div>
        ) : (
          /* Path C — key gone, softer nudge */
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Want to track future requests, view patient records, and get AI health insights?
            </p>
            <Button variant="outline" onClick={onRegister} className="w-full gap-2">
              <UserPlus className="w-4 h-4" />
              Create a free Belrose account
            </Button>
          </div>
        )}
      </div>
    </div>
  </div>
);

export default SuccessView;
