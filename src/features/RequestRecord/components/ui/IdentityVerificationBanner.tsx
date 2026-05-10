// src/features/RequestRecord/components/ui/IdentityVerificationBanner.tsx

import { ShieldAlert, ArrowRight, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const IdentityVerificationBanner: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-complement-5/20 border border-complement-5 rounded-xl p-4 flex gap-4 items-start">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-complement-5/20 flex items-center justify-center">
        <ShieldAlert className="w-4 h-4 text-complement-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-complement-5">Identity verification required</p>
        <p className="text-xs text-complement-5 mt-0.5 leading-relaxed">
          To protect you and your providers, Belrose requires identity verification before sending
          record requests.
        </p>

        <div className="flex flex-wrap justify-center gap-2 mt-3">
          <button
            onClick={() => navigate('/verification')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-complement-5 hover:bg-complement-5/50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Verify my identity
            <ArrowRight className="w-3 h-3" />
          </button>

          <a
            href="mailto:support@belrosehealth.com?subject=Identity Verification Help"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-complement-5 text-complement-5 hover:bg-complement-5/10 text-xs font-medium rounded-lg transition-colors"
          >
            <Mail className="w-3 h-3" />
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
};

export default IdentityVerificationBanner;
