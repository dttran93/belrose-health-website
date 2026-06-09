// src/components/site/Company/LearnMoreHub.tsx

import React, { useState } from 'react';
import { FileText, Github, Presentation } from 'lucide-react';
import EmailCaptureDialog, { ActionType, ResourceKey } from './ui/EmailCaptureModal';
import LearnMoreCard from './ui/LearnMoreCard';
// ============================================================================
// TYPES
// ============================================================================

interface ModalState {
  resource: ResourceKey;
  action: ActionType;
}

// ============================================================================
// COMPONENT
// ============================================================================

const LearnMoreHub: React.FC = () => {
  const [modal, setModal] = useState<ModalState | null>(null);

  const openModal = (resource: ResourceKey, action: ActionType) => setModal({ resource, action });

  const closeModal = () => setModal(null);

  return (
    <section className="px-8 md:px-[10vw] py-16 bg-gray-100">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center mb-12">
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-pink-500 mb-3">
            Learn more
          </p>
          <h2 className="text-[clamp(1.6rem,2.5vw,2.4rem)] font-bold text-gray-900 mb-3">
            Explore Belrose Health
          </h2>
          <p className="text-[15px] text-gray-500 leading-relaxed max-w-[480px] text-center">
            Read the technical detail, review the business case, or dig into the code.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <LearnMoreCard
            iconBg="bg-teal-50"
            icon={<FileText size={18} className="text-teal-600" />}
            title="Whitepaper"
            description="The Belrose Protocol's encryption, credibility system, and more explained. For researchers and the academically curious."
            onDownload={() => openModal('whitepaper', 'download')}
            onView={() => openModal('whitepaper', 'view')}
          />

          <LearnMoreCard
            iconBg="bg-pink-50"
            icon={<Presentation size={18} className="text-pink-500" />}
            title="Pitch Deck"
            description="The problem, solution, business model, and competitive landscape — for investors and potential partners."
            onDownload={() => openModal('pitch', 'download')}
            onView={() => openModal('pitch', 'view')}
          />

          <LearnMoreCard
            iconBg="bg-gray-100"
            icon={<Github size={18} className="text-gray-500" />}
            title="GitHub"
            description="The Belrose Health web app — built with Vite, React, and Firebase. Browse the source or follow along as we build."
            externalUrl="https://github.com/dttran93/belrose-health-website"
            externalLabel="View repository"
          />
        </div>
      </div>

      {/* Dialog — Radix handles its own portal, no extra wrapper needed */}
      <EmailCaptureDialog
        isOpen={modal !== null}
        resource={modal?.resource ?? 'whitepaper'}
        action={modal?.action ?? 'view'}
        onClose={closeModal}
      />
    </section>
  );
};

export default LearnMoreHub;
