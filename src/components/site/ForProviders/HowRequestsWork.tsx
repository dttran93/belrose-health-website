//src/components/site/ForProviders/HowRequestsWork.tsx

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Lock,
  NotebookPen,
  Shield,
  Upload,
  UserPlus,
  Zap,
} from 'lucide-react';
import CitationLink from '../Citations/CitationLink';

interface HowRequestsWorkProps {
  onBack: () => void;
}

const HowRequestsWork: React.FC<HowRequestsWorkProps> = ({ onBack }) => (
  <div className="max-w-4xl mx-auto px-8 py-12 w-full">
    <div className="flex items-center justify-center gap-4 mb-10">
      <div className="w-10 h-10 bg-complement-3 rounded-lg flex items-center justify-center flex-shrink-0">
        <Upload className="w-5 h-5 text-white" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900">How Belrose Requests Work</h2>
        <p className="text-slate-500 text-sm mt-1">Simple execution. Transformative potential</p>
      </div>
    </div>

    <div className="space-y-3">
      {/* 1. Any format */}
      <section className="text-left">
        <h3 className="text-base font-bold text-slate-900 mb-2">
          1. Upload anything — we handle the rest
        </h3>
        <p className="text-sm text-slate-700 leading-relaxed mb-1">
          Upload whatever you have, PDFs, Word docs, scanned images, handwritten notes anything
          legible works. There is no required format and no new documents to create.
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">
          Once received, Belrose's converts the record into <strong>FHIR format</strong> — the
          global standard for health data interoperability <CitationLink id="cures-act-fhir" />
          <CitationLink id="dua-act-2025" />. This means the record the patient stores isn't just a
          PDF sitting in a folder. It's structured, searchable, and can flow into any system.
        </p>
      </section>

      {/* 2. E2EE */}
      <section className="text-left">
        <h3 className="text-base font-bold text-slate-900 mb-2">2. Your upload is private</h3>
        <p className="text-sm text-slate-700 leading-relaxed mb-1">
          Before your file leaves your browser, it is encrypted using the patient's cryptographic
          key. Only the patient and you (if you make an account) have the key. No third-party,
          including Belrose, can read the contents.
        </p>
      </section>

      {/* 3. Account CTA — sovereignty pitch */}
      <section className="text-left">
        <h3 className="text-base font-bold text-slate-900 mb-2">
          3. You don't need to make an account, but you should
        </h3>
        <p className="text-sm text-slate-700 leading-relaxed mb-1">
          You can upload without creating an account. But here's why creating a Belrose account is
          worth two minutes of your time.
        </p>

        <div className="space-y-2 mt-3">
          {[
            {
              icon: NotebookPen,
              title: 'Ease the documentation burden on clinicians',
              desc: "You spend hours every week dealing with records. Belrose's patient-owned records can change this: In Belrose's protocol, providers contribute to a record that travels with the patient for life. This reduces duplication, improves continuity of care, and cuts administrative overhead for the worldwide health system.",
            },
            {
              icon: Shield,
              title: 'Retain health data access and credibility',
              desc: 'Creating an account not only allows you to retain access to records you upload, your records will contain your cryptographic verification. Any reader of a Belrose record can verify who created the record and if it has been tampered with.',
            },
            {
              icon: Zap,
              title: 'No new system to learn',
              desc: "Belrose works alongside whatever EHR system you already use. No IT project. No procurement committee. No 10-year plan. You get an email, upload a file, and you're done. If your system is legible, it works with Belrose.",
            },
            {
              icon: CheckCircle,
              title: 'A provable compliance record',
              desc: 'Your upload is timestamped and attributed to your account. If a compliance question ever arises, you have a verifiable audit trail showing you responded within the legal deadline.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex items-start gap-3 border border-slate-100 rounded-xl p-4"
            >
              <div className="w-8 h-8 bg-primary/8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-0.5">{title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>

    {/* Back nav */}
    <div className="flex justify-start mt-10">
      <button onClick={onBack} className="flex items-center gap-2.5 group">
        <ArrowLeft
          size={16}
          className="text-slate-400 group-hover:-translate-x-0.5 transition-transform"
        />
        <div className="text-left">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Back</p>
          <p className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">
            Your Legal Obligations
          </p>
        </div>
      </button>
    </div>
  </div>
);

export default HowRequestsWork;
