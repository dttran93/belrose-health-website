// src/components/site/OurProtocol/howItWorksData.ts
// Edit this file to update all How It Works page content

import { FileSearch, Wand2, Database, Share2, ShieldCheck, LucideIcon } from 'lucide-react';

export interface HowItWorksStep {
  slug: string; // URL slug: /how/[slug]
  id: number;
  icon: LucideIcon;
  label: string; // Short label e.g. "Collect"
  title: string; // Page headline
  subtitle: string; // One-liner under headline
  accentColor: string; // Tailwind text color class
  bgColor: string; // Tailwind bg color class
  borderColor: string; // Tailwind border color class
  summary: string; // Short paragraph for index card
  sections: {
    // Detail sections on the step page
    heading: string;
    body: string;
  }[];
  keyPoints: string[]; // Bullet highlights shown as pills/chips
  nextSlug: string | null; // For prev/next navigation
  prevSlug: string | null;
}

export const steps: HowItWorksStep[] = [
  {
    slug: 'collect',
    id: 1,
    icon: FileSearch,
    label: 'Collect',
    title: 'Every Record, From Every Provider',
    subtitle: 'We help you collect your complete health history using your legal access rights.',
    accentColor: 'text-complement-2',
    bgColor: 'bg-complement-2/10',
    borderColor: 'border-complement-2/30',
    summary:
      'GDPR, HIPAA, and equivalent laws across the developed world compel medical professionals to provide you with your own data. We exercise those rights on your behalf.',
    sections: [
      {
        heading: 'Your Legal Right to Your Data',
        body: 'In the US, HIPAA gives patients the right to access their health records from any covered provider within 30 days. In the UK and EU, GDPR Article 15 grants an equivalent right. Similar laws exist in virtually every developed nation. These are hard legal obligations — providers cannot refuse.',
      },
      {
        heading: 'How We Do It For You',
        body: 'After verifying your identity, Belrose submits formal data access requests to your providers on your behalf. We handle the paperwork, follow up on delays, and aggregate everything into one place. You can also self-report data, connect wearables, and import from other health apps.',
      },
      {
        heading: 'What Gets Collected',
        body: 'We collect clinical notes, lab results, imaging reports, prescriptions, vaccination records, hospital discharge summaries, and more — from GPs, specialists, hospitals, and any other medical professional you have seen.',
      },
    ],
    keyPoints: [
      'Legally mandated requests',
      'All providers, all record types',
      'Wearables & app integration',
      'Identity-verified access',
    ],
    prevSlug: null,
    nextSlug: 'standardize',
  },
  {
    slug: 'standardize',
    id: 2,
    icon: Wand2,
    label: 'Standardize',
    title: 'One Format. Universally Readable.',
    subtitle: 'Raw health records come in dozens of incompatible formats. We standardize them all.',
    accentColor: 'text-complement-5',
    bgColor: 'bg-complement-5/10',
    borderColor: 'border-complement-5/30',
    summary:
      'Using LLMs, Computer Vision, and OCR, we convert every record into the FHIR standard — the internationally recognized format for exchanging health information.',
    sections: [
      {
        heading: 'The Problem With Raw Records',
        body: 'Health records exist in a chaotic mix of formats: scanned PDFs, proprietary EHR exports, handwritten notes, HL7 v2 messages, and more. A record from one hospital is often unreadable by another. This fragmentation is one of the biggest inefficiencies in modern healthcare.',
      },
      {
        heading: 'The FHIR Standard',
        body: 'FHIR (Fast Healthcare Interoperability Resources) is the global standard for health data exchange, backed by HL7 International and mandated by regulators in the US, UK, EU, and Australia. By converting your records to FHIR, Belrose makes your data readable by any modern health system in the world.',
      },
      {
        heading: 'Our Transformation Pipeline',
        body: 'We use a combination of Large Language Models for extracting structured data from clinical text, OCR for scanned documents and images, Computer Vision for imaging reports, and rule-based parsers for structured formats. The result is a clean, validated FHIR bundle for every record.',
      },
    ],
    keyPoints: [
      'FHIR R4 standard output',
      'LLM-powered extraction',
      'OCR for scanned documents',
      'Validated & structured',
    ],
    prevSlug: 'collect',
    nextSlug: 'store',
  },
  {
    slug: 'store',
    id: 3,
    icon: Database,
    label: 'Store',
    title: 'Store With Client-Side Encryption',
    subtitle: 'We physically cannot see the content of records you upload to our servers.',
    accentColor: 'text-complement-3',
    bgColor: 'bg-complement-3/10',
    borderColor: 'border-complement-3/30',
    summary:
      'We offer encrypted, HIPAA/GDPR-compliant cloud storage with client-side encryption — meaning even Belrose cannot read your data.',
    sections: [
      {
        heading: 'Client-Side Encryption',
        body: 'Your records are encrypted on your device before they ever leave it. The encryption key is derived from your password and never transmitted to our servers. This means only you can decrypt your data — not Belrose, not our engineers, not law enforcement with a warrant to our servers.',
      },
      {
        heading: 'Our Recommended Storage',
        body: 'We offer HIPAA and GDPR-compliant encrypted cloud storage. Records are stored in encrypted form with zero-knowledge architecture. We recommend this option for most users because it provides automatic backup, cross-device access, and seamless sharing.',
      },
      {
        heading: 'Bring Your Own Storage',
        body: "Don't trust Belrose? You can store your data literally anywhere you want. You would lose access to our sharing, editing, and versioning capabilities, but can still benefit from our transformation and verification layers.",
      },
    ],
    keyPoints: [
      'Client-side encryption',
      'Zero-knowledge architecture',
      'HIPAA & GDPR compliant',
      'BYO storage supported',
    ],
    prevSlug: 'standardize',
    nextSlug: 'share',
  },
  {
    slug: 'share',
    id: 4,
    icon: Share2,
    label: 'Share',
    title: 'Share With Anyone, On Your Terms',
    subtitle:
      'Grant access to doctors, researchers, family, or companies — with full control over what they see.',
    accentColor: 'text-complement-4',
    bgColor: 'bg-complement-4/10',
    borderColor: 'border-complement-4/30',
    summary:
      'Granular permission levels let you decide exactly what each recipient can view, edit, comment, or share. Revoke access instantly, at any time.',
    sections: [
      {
        heading: 'Granular Permission Controls',
        body: 'When you share a record, you set the permission level: viewers, editors, owners. You can share individual records, a curated selection, or your entire health history. Permissions can be time-limited — useful for sharing with a specialist during a specific treatment.',
      },
      {
        heading: 'Who Can You Share With?',
        body: 'Anyone. A GP, a specialist, a hospital system, a research study, an insurance company, a family member. Recipients receive a secure, authenticated link and encryption key and see only what you have explicitly granted them.',
      },
      {
        heading: 'Instant Revocation',
        body: "Changed your mind? Revoke access at any time with a single click. The recipient's key is immediately invalidated. You can also set expiry dates on shares so access automatically ends without any action required from you.",
      },
    ],
    keyPoints: [
      'View/edit/own permission tiers',
      'Time-limited access',
      'Share with anyone',
      'Instant revocation',
    ],
    prevSlug: 'store',
    nextSlug: 'verify',
  },
  {
    slug: 'verify',
    id: 5,
    icon: ShieldCheck,
    label: 'Verify',
    title: 'Credible. Tamper-Proof.',
    subtitle:
      'A cryptographic fingerprint of your records is stored on a distributed network along with verifications from trusted parties.',
    accentColor: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    summary:
      'Digital fingerprints (hashes) of your records are stored publicly on our distributed network. Any party can verify your data is complete and unmodified — no middleman required.',
    sections: [
      {
        heading: 'What Is a Hash?',
        body: 'A cryptographic hash is a fixed-length fingerprint of a document. Change even a single character in the original record, and the hash changes completely. By storing hashes on our distributed network, we create a permanent, tamper-evident audit trail that anyone can check independently.',
      },
      {
        heading: 'Verification Without Exposure',
        body: 'Stored with the hash is a verification from other users. The hash ensures your records have not been altered. The verifications confirm to others the records are legitimate. Hashes are one-way so there is no data exposed on the network.',
      },
      {
        heading: 'A First of Its Kind Credibility System',
        body: 'Today, there is no reliable way for a provider to trust that the records you provide are complete and unmodified. Our credibility system solves this. It enables a new level of trust in patient-provided data — critical for research, insurance, and clinical decision-making.',
      },
    ],
    keyPoints: [
      'Cryptographic Hashes',
      'No private data exposed',
      'Distributed credibility system',
      'Tamper-evident audit trail',
    ],
    prevSlug: 'share',
    nextSlug: null,
  },
];

export const stepsBySlug = Object.fromEntries(steps.map(s => [s.slug, s]));
