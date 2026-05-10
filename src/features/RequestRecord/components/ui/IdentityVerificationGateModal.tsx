// src/features/RequestRecord/components/IdentityVerificationGateModal.tsx

import { ShieldAlert, ArrowRight, Mail, FileText, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface IdentityVerificationGateModalProps {
  onClose: () => void; // called when user dismisses — parent should navigate back to list
}

const IdentityVerificationGateModal: React.FC<IdentityVerificationGateModalProps> = ({
  onClose,
}) => {
  const navigate = useNavigate();

  return (
    // Backdrop — clicking it also dismisses
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      {/* Modal card — stop propagation so clicks inside don't close it */}
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-complement-5/20 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-4 h-4 text-complement-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-black">Identity required</p>
            <p className="text-xs text-foreground">One-time verification</p>
          </div>
        </div>

        <p className="text-xs text-foreground text-left leading-relaxed mb-4">
          Providers need to confirm requests come from the right person. Verify once and you can
          send requests any time — it takes about 2 minutes.
        </p>

        {/* Primary CTA */}
        <button
          onClick={() => navigate('/verification')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-complement-5 hover:bg-complement-5/75 text-white text-sm font-medium rounded-lg transition-colors mb-4"
        >
          Verify my identity
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 border-t border-slate-200" />
          <span className="text-xs text-slate-400">can't verify right now?</span>
          <div className="flex-1 border-t border-slate-200" />
        </div>

        {/* Alternatives */}
        <div className="space-y-1">
          <a
            href="mailto:support@belrosehealth.com?subject=Identity Verification Help"
            className="flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors group"
          >
            <Mail className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-left text-foreground leading-relaxed">
              Email{' '}
              <span className="font-medium text-slate-800 group-hover:text-violet-700 transition-colors">
                support@belrosehealth.com
              </span>{' '}
              — our team can verify you manually via a short video call
            </span>
          </a>

          <div className="flex items-start gap-2.5 px-2 py-2">
            <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-left text-foreground leading-relaxed">
              You can also request your records directly from your provider and upload them to
              Belrose
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdentityVerificationGateModal;
