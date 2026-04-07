//src/components/site/ForProviders/LegalObligations.tsx

import { ArrowRight, Scale } from 'lucide-react';
import CitationLink from '../Citations/CitationLink';

interface LegalObligationsProps {
  onNext: () => void;
}

const LegalObligations: React.FC<LegalObligationsProps> = ({ onNext }) => (
  <div className="max-w-4xl mx-auto px-8 py-12 w-full">
    <div className="flex items-center justify-center mx-auto w-full gap-4 mb-10">
      <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
        <Scale className="w-5 h-5 text-white" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Your Legal Obligations</h2>
        <p className="text-slate-500 text-sm mt-1">
          Compliance requirements for healthcare providers
        </p>
      </div>
    </div>

    <div className="space-y-3">
      {/* 1. Formal SAR & Deadline */}
      <section className="text-left">
        <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
          1. This is a formal Subject Access Request (SAR)
        </h3>
        <div className="space-y-4 text-slate-700 leading-relaxed text-sm">
          <p>
            A Belrose request constitutes a formal SAR under <strong>GDPR Article 15</strong>{' '}
            <CitationLink id="gdpr-text" />. You are legally required to provide patients with their
            personal health records <strong>within 30 days</strong> (one month){' '}
            <CitationLink id="ico-deadline" />.
          </p>
        </div>
      </section>

      {/* 2. Format & NHS App */}
      <section className="text-left">
        <h3 className="font-bold text-slate-900 mb-2">
          2. Your patient has requested their record in a commonly used electronic form via Belrose
          Health
        </h3>
        <p className="text-sm text-slate-700 leading-relaxed mb-1">
          ICO guidance states that controllers must provide data in a commonly used electronic form
          and that the patient's preferred format be considered <CitationLink id="ico-how" />.{' '}
          <strong>You may not refuse a request or insist on a different channel</strong> just
          because it is your preferred method. If you believe the request represents a significant
          burden to your organization's operations, reach out to us at{' '}
          <a href="mailto:requests@belrosehealth.com" className="text-primary font-medium">
            requests@belrosehealth.com.
          </a>{' '}
          We can provide assistance.
        </p>
      </section>

      {/* 3. Identity Verification */}
      <section className="text-left">
        <h3 className="font-bold text-slate-900 mb-2">3. Identity & Verification</h3>
        <p className="text-sm text-slate-700 leading-relaxed mb-1">
          If you have doubts about the identity of the requester, you may contact the patient
          directly to verify (they are CC'd on the request email). Belrose Health has also
          independently verified the identity of the patient via a government-issued photo ID and
          liveness check. Verification records are retained and available within the platform.
        </p>
      </section>
    </div>
    <div className="flex justify-end mt-6">
      <button onClick={onNext} className="flex items-center gap-3 group text-right">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Next</p>
          <p className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            How It Works
          </p>
        </div>
        <ArrowRight
          size={18}
          className="text-gray-400 group-hover:translate-x-1 transition-transform"
        />
      </button>
    </div>
  </div>
);

export default LegalObligations;
