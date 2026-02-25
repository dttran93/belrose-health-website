// src/components/site/FAQ/faqData.ts

/**
 * FAQ questions for site
 */

export interface FAQItem {
  q: string;
  a: string;
  homepage?: boolean;
}

type FAQData = Record<string, FAQItem[]>;

export const faqs: FAQData = {
  'Getting Started': [
    {
      q: 'What is Belrose and who is it for?',
      a: 'Belrose is a patient-owned health records platform. It is for anyone who wants to take control of their health data — whether you are managing a chronic condition, keeping track of family records, or simply want a complete picture of your health history in one place.',
      homepage: true,
    },
    {
      q: 'Is Belrose free to use?',
      a: 'Managing your own records is free and always will be. We offer premium features for those who want additional storage, advanced sharing controls, or data monetisation tools.',
      homepage: true,
    },
    {
      q: 'How do I get my records into Belrose?',
      a: 'Under GDPR and HIPAA, you have a legal right to request your health records from any provider. Belrose helps you exercise that right automatically — we handle the requests and import your records once received. You can also upload documents manually.',
    },
    {
      q: 'What types of records can I store?',
      a: 'Anything! GP notes, hospital discharge summaries, lab results, imaging reports, prescriptions, vaccination records, dental records, and even self-reported data like fitness metrics or mental health journals.',
    },
    {
      q: 'What countries is Belrose available in?',
      a: 'While our main focus is currently the US and UK. Belrose is available to any person in any country that wants to manage their own health records.',
      homepage: true,
    },
  ],
  'The Belrose Protocol': [
    {
      q: 'What is the Belrose Protocol?',
      a: 'The Belrose Protocol is a record storage and management procedure we developed. It involves collecting a patients records, standardizing it into interoperable FHIR format, storing it on client-side encrypted servers, and using a distributed network to store hashes for verification. ',
      homepage: true,
    },
    {
      q: 'How can a doctor or third party rely on a record that is completely controlled by the patient? The patient could be lying.',
      a: 'Our protocol involves storing hashes (digital fingerprints) of the record data on a distributed network alongside verifications from trusted parties. This allows future viewers of patient-provided records to know that the record has not been tampered with.',
    },
    {
      q: 'How do I know the FHIR conversion is accurate?',
      a: 'We use multiple validation layers including LLM processing and optional clinician review. Also, we always recommend you ask your GP if anything is missing from your record!',
    },
    {
      q: 'What is a distributed network?',
      a: 'When we say distributed network, we are refering to a shared, digital ledger that records data securely, chronologically, and permanently across a decentralized network of computers. This technology is commonly referred to as a "blockchain." But that term has a lot of baggage so we stick to calling it a "distributed network."',
    },
    {
      q: 'Are there any special requirements for using the distributed network?',
      a: 'No. We take care of all of that on our end. You do not need to worry about any of details of managing a distributed network, just enjoy the security it provides.',
    },
    {
      q: "What if there's a dispute about a record's authenticity?",
      a: "Our system is designed to handle this exact situation. Rather than a binary verified or not verified, our system calculates a credibility score for each record. Verifications increase the score, disputes decrease the score. If there's a dispute about a record's authenticity that can be recorded in our system and made known to any future viewer of the record.",
    },
  ],
  'Privacy & Security': [
    {
      q: 'Can Belrose employees see my records?',
      a: 'No. Your records are encrypted on your device before they ever reach our servers — a process called client-side encryption. This means even Belrose staff cannot read your data. We are the only health tech company that does not want your data (in plain text format).',
      homepage: true,
    },
    {
      q: 'Where is my data stored?',
      a: 'You choose. We recommend our secure servers where you can access our sharing, editing, versioning, and other features. But you can store it in an email chain to your doctor, a text message with your mom, on your phone, or with a third-party provider of your choice. Our protocol is storage-agnostic by design.',
    },
    {
      q: 'What happens if I lose my password?',
      a: 'Because your data is encrypted with a key only you hold, a lost password cannot be recovered by resetting it the usual way. When you sign up, we give you a 24-word recovery phrase — keep it somewhere safe. This is the only way to restore access to your encrypted records.',
    },
    {
      q: 'Is Belrose HIPAA and GDPR compliant?',
      a: 'Yes. Belrose is built from the ground up to comply with both HIPAA (US) and GDPR (UK/EU) standards. Because you own and control your data, Belrose operates as a data processor, not a data controller — giving you the strongest possible legal protections.',
    },
    {
      q: 'What happens if I want to cancel my account?',
      a: 'You can export all your data at any time. If you decide to cancel your account, we provide a full export of your records in standard formats. After cancellation and export, your encrypted data, which we can not read regardless, is permanently deleted from our systems within 30 days.',
    },
    {
      q: 'What happens to our data if Belrose goes bankrupt?',
      a: 'Even if we go bankrupt, your records are protected. You legally own the data you store with our system. Even those with legal ownership of our company or physical access to servers will not be able access to your records unless you allow them to.',
    },
    {
      q: 'Could a government force Belrose to turn over my health data?',
      a: 'No, because the data on our servers is client-side encrypted, even if government or law enforcement came to us with a warrant for your data, we would physically be unable to provide anything besides scrambled cipher text.',
    },
  ],
  'Sharing & Permissions': [
    {
      q: 'How do I share records with my doctor?',
      a: 'You can share any record or set of records with a provider directly from the app. You control the permission level and you can revoke access at any time.',
      homepage: true,
    },
    {
      q: 'Can I share records with someone who is not on Belrose?',
      a: 'Yes. Although we would recommend they create a Belrose account to make full use of our functionality, you can share your record via email, text message, fax, you could even theoretically write your records by hand and send it to them. All while still benefiting from our transformation and verification features.',
    },
    {
      q: 'Can I manage records for a family member?',
      a: 'Yes. Belrose supports dependent accounts, so you can manage records for children, elderly parents, or anyone who has given you consent to do so.',
    },
  ],
  'For Providers & Healthcare Professionals': [
    {
      q: 'Does Belrose require access or integration with EHRs?',
      a: "No. We can accept any version of a patient's health records that you are willing to verify as your work. PDFs, photos, images anything works as long as it is a legitimate health record.",
    },
    {
      q: "Can Belrose records be reuploaded into my clinic's EHR?",
      a: 'Yes we can build a two way integration back into any EHR system. Contact our sales team for more information!',
    },
    {
      q: "Can Belrose integrate with my EHR's APIs to pull data?",
      a: 'Yes, in fact that would be our ideal method of receiving health data. But we recognize the difficulty of such integrations and have built work arounds until such integration can be achieved at scale.',
    },
  ],
  'Data & Monetisation': [
    {
      q: 'Can I earn money from my health data?',
      a: 'Yes — if you choose to. Belrose enables you to opt into sharing anonymised data with researchers, pharmaceutical companies, or other organisations. You set the terms, you control who sees what, and any compensation flows directly to you. Participation is entirely voluntary.',
    },
    {
      q: 'Who owns my data on Belrose?',
      a: 'You do, completely. Belrose does not claim any rights to your data. We do not sell, share, or monetise your records, you do. This is the foundational principle the entire platform is built on.',
    },
    {
      q: 'How is Belrose different from other health record apps?',
      a: "Other health record apps give you 'access' or a 'portal' to your records. Belrose allows you to truly own your records. Correct mistakes, manage access, donate your data, sell your data, all of this is possible with Belrose's data protocol.",
      homepage: true,
    },
  ],
};
