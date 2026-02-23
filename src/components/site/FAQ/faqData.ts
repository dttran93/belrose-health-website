// src/components/site/FAQ/faqData.ts

/**
 * FAQ questions for site
 */

export interface FAQItem {
  q: string;
  a: string;
}

type FAQData = Record<string, FAQItem[]>;

export const faqs: FAQData = {
  'Getting Started': [
    {
      q: 'What is Belrose and who is it for?',
      a: 'Belrose is a patient-owned health records platform. It is for anyone who wants to take control of their health data — whether you are managing a chronic condition, keeping track of family records, or simply want a complete picture of your health history in one place.',
    },
    {
      q: 'Is Belrose free to use?',
      a: 'Managing your own records is free and always will be. We offer premium features for those who want additional storage, advanced sharing controls, or data monetisation tools.',
    },
    {
      q: 'How do I get my records into Belrose?',
      a: 'Under GDPR and HIPAA, you have a legal right to request your health records from any provider. Belrose helps you exercise that right automatically — we handle the requests and import your records once received. You can also upload documents manually.',
    },
    {
      q: 'What types of records can I store?',
      a: 'Any health-related document: GP notes, hospital discharge summaries, lab results, imaging reports, prescriptions, vaccination records, dental records, and even self-reported data like fitness metrics or mental health journals.',
    },
  ],
  'Privacy & Security': [
    {
      q: 'Can Belrose employees see my records?',
      a: 'No. Your records are encrypted on your device before they ever reach our servers — a process called client-side encryption. This means even Belrose staff cannot read your data. We are, to our knowledge, the only health tech company that has deliberately built a system where we cannot access patient data.',
    },
    {
      q: 'Where is my data stored?',
      a: 'You choose. You can store your records on our secure servers, on your own device, or with a third-party provider of your choice. Our protocol is storage-agnostic by design.',
    },
    {
      q: 'What happens if I lose my password?',
      a: 'Because your data is encrypted with a key only you hold, a lost password cannot be recovered by resetting it the usual way. When you sign up, we give you a 24-word recovery phrase — keep it somewhere safe. This is the only way to restore access to your encrypted records.',
    },
    {
      q: 'Is Belrose HIPAA and GDPR compliant?',
      a: 'Yes. Belrose is built from the ground up to comply with both HIPAA (US) and GDPR (UK/EU) standards. Because you own and control your data, Belrose operates as a data processor, not a data controller — giving you the strongest possible legal protections.',
    },
  ],
  'Sharing & Permissions': [
    {
      q: 'How do I share records with my doctor?',
      a: 'You can share any record or set of records with a provider directly from the app. You control the permission level — view only, comment, or edit — and you can revoke access at any time.',
    },
    {
      q: 'Can I share records with someone who is not on Belrose?',
      a: 'Yes. You can generate a secure, time-limited link to share specific records with anyone, even if they do not have a Belrose account. The link expires automatically and can be revoked at any time.',
    },
    {
      q: 'Can I manage records for a family member?',
      a: 'Yes. Belrose supports dependent accounts, so you can manage records for children, elderly parents, or anyone who has given you consent to do so.',
    },
  ],
  'Data & Monetisation': [
    {
      q: 'Can I earn money from my health data?',
      a: 'Yes — if you choose to. Belrose enables you to opt into sharing anonymised data with researchers, pharmaceutical companies, or other organisations. You set the terms, you control who sees what, and any compensation flows directly to you. Participation is entirely voluntary.',
    },
    {
      q: 'Who owns my data on Belrose?',
      a: 'You do, completely. Belrose does not claim any rights to your data. We do not sell, share, or monetise your records without your explicit consent. This is the foundational principle the entire platform is built on.',
    },
    {
      q: 'How is Belrose different from other health apps?',
      a: "Most health apps make money by harvesting and selling your data. Belrose's business model is the opposite — we make money by helping you get value from your data on your terms. We have no financial incentive to see your data; our incentive is to keep you healthy.",
    },
  ],
};
