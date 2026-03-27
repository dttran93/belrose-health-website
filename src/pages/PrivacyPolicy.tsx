// src/pages/PrivacyPolicy.tsx
//
// SETUP — two steps:
//
// 1. In App.tsx, add this import at the top:
//      import PrivacyPolicy from './pages/PrivacyPolicy';
//
// 2. In App.tsx, add this route alongside your other public routes:
//      <Route path="/privacy" element={<PrivacyPolicy />} />
//
// 3. In your Footer component, add a link:
//      <a href="/privacy">Privacy Policy</a>

import React, { useEffect, useRef, useState } from 'react';
import Navbar from '@/components/site/Navbar';
import Footer from '@/components/site/Footer';
import WaitlistBanner from '@/components/site/WaitlistBanner';

// ─── Shared prose components (avoids repeating Tailwind strings) ──────────────

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-left text-[15px] leading-relaxed text-slate-600 mb-4">{children}</p>
);

const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="text-left mb-4 space-y-1">{children}</ul>
);

const LI = ({ children }: { children: React.ReactNode }) => (
  <li className="text-left text-[15px] leading-relaxed text-slate-600 pl-5 relative before:absolute before:left-0 before:top-[10px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-pink-400">
    {children}
  </li>
);

const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-left text-[11px] font-bold tracking-widest uppercase text-slate-400 mt-7 mb-2">
    {children}
  </h3>
);

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a
    href={href}
    target={href.startsWith('mailto') ? undefined : '_blank'}
    rel={href.startsWith('mailto') ? undefined : 'noreferrer'}
    className="text-pink-500 border-b border-pink-200 hover:border-pink-500 transition-colors"
  >
    {children}
  </a>
);

// ─── Table ────────────────────────────────────────────────────────────────────

const Table = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div className="overflow-x-auto rounded-lg border border-slate-200 my-5">
    <table className="w-full text-[13.5px]">
      <thead className="bg-slate-50">
        <tr>
          {headers.map(h => (
            <th
              key={h}
              className="text-left px-4 py-2.5 text-[11px] font-bold tracking-wider uppercase text-slate-400 border-b border-slate-200"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
            {row.map((cell, j) => (
              <td
                key={j}
                className="px-4 py-3 text-slate-600 align-top leading-relaxed border-b border-slate-100 last:border-b-0"
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Section data ─────────────────────────────────────────────────────────────

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

const LAST_UPDATED = 'March 2026';

const sections: Section[] = [
  {
    id: 'overview',
    title: 'Overview',
    content: (
      <>
        <P>
          Belrose Health Ltd ("Belrose", "we", "us", or "our") is committed to protecting your
          privacy. This Privacy Policy explains what data we collect, why we collect it, and how it
          is handled when you use belrosehealth.com and our platform (collectively, the "Service").
        </P>
        <P>
          We are based in London, United Kingdom. Our Service is subject to the UK General Data
          Protection Regulation (UK GDPR) and the Data Protection Act 2018. Belrose Health Ltd is
          the data controller for the purposes of this policy.
        </P>
        <P>
          Questions? Contact us at{' '}
          <A href="mailto:privacy@belrosehealth.com">privacy@belrosehealth.com</A>.
        </P>
      </>
    ),
  },
  {
    id: 'data-we-collect',
    title: 'Data We Collect',
    content: (
      <>
        <P>We collect the following categories of information:</P>
        <H3>1. Account Information</H3>
        <P>
          When you create an account, we collect your email address and a hashed version of your
          password. We do not store your password in plain text.
        </P>
        <H3>2. Health Records (Client-Side Encrypted)</H3>
        <P>
          You may upload or connect health records to the platform. These records are{' '}
          <strong className="font-semibold text-slate-800">
            encrypted on your device before being transmitted to our servers
          </strong>{' '}
          using client-side encryption. This means Belrose cannot read, access, or use your health
          data — only you hold the decryption keys. We store only the encrypted ciphertext so you
          can retrieve it.
        </P>
        <P>
          Because we cannot access this data, it falls outside our operational control. You are the
          sole data controller of your encrypted health records.
        </P>
        <H3>3. Analytics Data (Google Analytics)</H3>
        <P>
          With your consent, we use Google Analytics to understand how visitors use our website.
          This includes pages visited, session duration, general geographic location, device type,
          and browser. This data is aggregated and anonymised; it does not identify you personally.
        </P>
        <P>
          You can opt out at any time via the cookie banner or the{' '}
          <A href="https://tools.google.com/dlpage/gaoptout">
            Google Analytics opt-out browser add-on
          </A>
          .
        </P>
        <H3>4. Payment Information</H3>
        <P>
          Payments are processed by a third-party processor (Stripe). We do not store your card
          number, CVV, or bank account details. We retain only transaction identifiers and
          subscription status for account management.
        </P>
      </>
    ),
  },
  {
    id: 'legal-basis',
    title: 'Why We Collect It (Legal Basis)',
    content: (
      <>
        <P>Under UK GDPR, we must have a lawful basis for processing personal data:</P>
        <Table
          headers={['Data', 'Purpose', 'Legal Basis']}
          rows={[
            [
              'Email address',
              'Account creation, authentication, service communications',
              'Contract performance',
            ],
            [
              'Encrypted health records',
              'Secure storage and retrieval at your request',
              'Contract performance',
            ],
            [
              'Analytics data',
              'Understanding usage to improve the product',
              'Consent (opt-in via cookie banner)',
            ],
            [
              'Payment identifiers',
              'Subscription management and fraud prevention',
              'Contract performance / Legitimate interests',
            ],
          ]}
        />
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies',
    content: (
      <>
        <Table
          headers={['Cookie', 'Provider', 'Purpose', 'Duration']}
          rows={[
            ['_ga, _ga_*', 'Google Analytics', 'Distinguish unique users and sessions', '2 years'],
            ['cookie_consent', 'Belrose', 'Remember your cookie preference', '1 year'],
            [
              'auth_session',
              'Firebase / Belrose',
              'Keep you logged in (strictly necessary)',
              'Session / 30 days',
            ],
          ]}
        />
        <P>
          Strictly necessary cookies (auth_session) operate without consent as they are required for
          the Service to function. Analytics cookies are only set after you give explicit consent
          via the cookie banner.
        </P>
      </>
    ),
  },
  {
    id: 'data-sharing',
    title: 'Data Sharing & Third Parties',
    content: (
      <>
        <P>
          We do not sell your personal data. We share it only with the following processors, each
          bound by data processing agreements:
        </P>
        <UL>
          <LI>
            <strong className="font-semibold text-slate-700">Google LLC</strong> — Analytics and
            Firebase infrastructure (Authentication, Firestore, Storage)
          </LI>
          <LI>
            <strong className="font-semibold text-slate-700">Stripe Inc.</strong> — Payment
            processing
          </LI>
          <LI>
            <strong className="font-semibold text-slate-700">Resend</strong> — Transactional email
            delivery
          </LI>
        </UL>
        <P>
          We may disclose data to authorities if required by law, or to protect the rights,
          property, or safety of Belrose, our users, or others.
        </P>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'Data Retention',
    content: (
      <UL>
        <LI>
          <strong className="font-semibold text-slate-700">Account data</strong> — Active account
          lifetime; deleted within 30 days of account closure.
        </LI>
        <LI>
          <strong className="font-semibold text-slate-700">Encrypted health records</strong> — Until
          you delete them or close your account.
        </LI>
        <LI>
          <strong className="font-semibold text-slate-700">Analytics data</strong> — 26 months
          (Google Analytics default).
        </LI>
        <LI>
          <strong className="font-semibold text-slate-700">Payment records</strong> — 7 years for
          legal and tax compliance.
        </LI>
      </UL>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your Rights',
    content: (
      <>
        <P>Under UK GDPR you have the right to:</P>
        <UL>
          <LI>
            <strong className="font-semibold text-slate-700">Access</strong> — Request a copy of the
            personal data we hold about you.
          </LI>
          <LI>
            <strong className="font-semibold text-slate-700">Rectification</strong> — Ask us to
            correct inaccurate data.
          </LI>
          <LI>
            <strong className="font-semibold text-slate-700">Erasure</strong> — Ask us to delete
            your personal data ("right to be forgotten").
          </LI>
          <LI>
            <strong className="font-semibold text-slate-700">Restriction</strong> — Ask us to
            restrict how we process your data.
          </LI>
          <LI>
            <strong className="font-semibold text-slate-700">Portability</strong> — Receive your
            data in a machine-readable format.
          </LI>
          <LI>
            <strong className="font-semibold text-slate-700">Object</strong> — Object to processing
            based on legitimate interests.
          </LI>
          <LI>
            <strong className="font-semibold text-slate-700">Withdraw consent</strong> — Withdraw
            analytics consent at any time via cookie settings.
          </LI>
        </UL>
        <P>
          Contact us at <A href="mailto:privacy@belrosehealth.com">privacy@belrosehealth.com</A>. We
          respond within 30 days. You may also complain to the ICO at{' '}
          <A href="https://ico.org.uk">ico.org.uk</A>.
        </P>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    content: (
      <>
        <UL>
          <LI>Client-side encryption of all health records — we cannot read your data</LI>
          <LI>Encrypted data transmission over HTTPS (TLS)</LI>
          <LI>Firebase Authentication for secure identity management</LI>
          <LI>Blockchain-based verification of record integrity</LI>
          <LI>Role-based access controls within the platform</LI>
        </UL>
        <P>
          No system is completely secure. To report a security issue, contact{' '}
          <A href="mailto:privacy@belrosehealth.com">privacy@belrosehealth.com</A>.
        </P>
      </>
    ),
  },
  {
    id: 'children',
    title: "Children's Privacy",
    content: (
      <P>
        Our Service is not directed to children under 16. We do not knowingly collect personal data
        from anyone under 16. If you believe a child has provided us with personal data, please
        contact us and we will delete it promptly.
      </P>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to This Policy',
    content: (
      <P>
        We may update this policy from time to time. When we do, we will revise the "Last Updated"
        date and, for material changes, notify you by email or in-app notice. Continued use of the
        Service after changes constitutes acceptance of the updated policy.
      </P>
    ),
  },
];

// ─── Page component ───────────────────────────────────────────────────────────

const PrivacyPolicy: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>(sections[0]!.id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Scroll to top on mount (important since your router reuses the same scroll container)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Highlight the active nav item as user scrolls
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    sections.forEach(({ id }) => {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) =>
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Same banner + navbar as the rest of the public site */}
      <WaitlistBanner />
      <Navbar />

      <main className="flex-1">
        {/* ── Hero ── */}
        <div className="bg-primary px-8 md:px-12 py-20 relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-[480px] h-[480px] rounded-full
          bg-white/[0.03] -translate-y-1/2 translate-x-1/2 pointer-events-none"
          />
          <div
            className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full
          bg-pink-500/10 translate-y-1/2 -translate-x-1/2 pointer-events-none"
          />
          <div className="relative max-w-3xl mx-auto">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-pink-300/70 mb-4">
              Legal
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
              Privacy Policy
            </h1>
            <p className="text-sm text-white/40">
              Last updated: {LAST_UPDATED} · Belrose Health Ltd · London, UK
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="max-w-5xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-12 items-start">
          {/* Sticky sidebar nav */}
          <nav className="hidden md:block sticky top-24" aria-label="Policy sections">
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-3">
              Contents
            </p>
            <ul className="border-l border-slate-200 space-y-0.5">
              {sections.map(({ id, title }) => (
                <li key={id}>
                  <button
                    onClick={() => scrollTo(id)}
                    className={`w-full text-left text-[13px] px-4 py-2 border-l-2 -ml-px transition-colors leading-snug ${
                      activeSection === id
                        ? 'text-pink-500 border-pink-500 font-medium'
                        : 'text-slate-400 border-transparent hover:text-slate-700'
                    }`}
                  >
                    {title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <article>
            {sections.map(({ id, title, content }) => (
              <section
                key={id}
                id={id}
                className="mb-14 scroll-mt-24"
                ref={el => {
                  sectionRefs.current[id] = el;
                }}
              >
                <h2 className="text-left text-xl font-bold text-black tracking-tight mb-5 pb-3 border-b border-slate-200">
                  {title}
                </h2>
                {content}
              </section>
            ))}

            {/* Contact card */}
            <div className="mt-4 p-8 rounded-xl bg-[#0f172a] relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_100%_50%,rgba(236,72,153,0.15),transparent)] pointer-events-none" />
              <div className="relative">
                <h3 className="text-white font-bold text-base mb-2">Questions about your data?</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-5">
                  Our privacy contact handles all data-related requests. We aim to respond within 30
                  days.
                </p>
                <a
                  href="mailto:privacy@belrosehealth.com"
                  className="inline-flex items-center gap-2 text-sm font-medium text-pink-400 border border-pink-500/30 px-5 py-2.5 rounded-lg hover:bg-pink-500/10 transition-colors"
                >
                  privacy@belrosehealth.com →
                </a>
              </div>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
