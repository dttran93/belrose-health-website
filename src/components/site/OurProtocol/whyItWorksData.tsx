// src/components/site/OurProtocol/whyItWorksData.ts

import { Building2, Crown, HeartHandshake, LucideIcon, TrendingUp } from 'lucide-react';
import { ReactNode } from 'react';
import CitationLink from '../Citations/CitationLink';

export interface WhySection {
  icon: LucideIcon;
  label: string;
  heading: string;
  body: ReactNode;
  stat: string;
  statLabel: ReactNode;
}

export const whySections: WhySection[] = [
  {
    icon: Building2,
    label: 'The Problem with Current Solutions',
    heading: 'Your data is sold for billions. You get nothing.',
    body: `Health data companies harvest your data from wherever they can legally obtain them, aggregate them into identity graphs, and sell them to hospitals, insurers, and governments. You contributed that value and received nothing. `,
    stat: '$19B',
    statLabel: (
      <>
        <p>
          Annual revenue of just one major health data broker
          <CitationLink id="databroker-rev" />
        </p>
      </>
    ),
  },
  {
    icon: Crown,
    label: 'Data Sovereignty',
    heading: 'Sovereignty is more than privacy.',
    body: `Privacy is about who sees your data. Sovereignty is about who controls and benefits from it. Countless HealthTech companies and governments have asked people to unify data on their platforms. None have succeeded because people quickly realize the value flows almost entirely to the company or institution. Belrose fundamentally reverses this dynamic.`,
    stat: '0',
    statLabel: 'Belrose employees who can read your records',
  },
  {
    icon: TrendingUp,
    label: 'Closing the Loop',
    heading: 'When patients win, everyone wins.',
    body: `We believe if patients have genuine control and real incentive, they will voluntarily maintain records far more complete and accurate than anything a data broker could scrape together. These records will form the infrastructure for the next generation of personalized and preventative medicine.`,
    stat: '$78B',
    statLabel: (
      <>
        <p>
          Estimated cost of waste due solely to failure of care coordination
          <CitationLink id="waste-in-US-healthcare" />
        </p>
      </>
    ),
  },
  {
    icon: HeartHandshake,
    label: 'A Healthier, More Equitable World',
    heading: 'Your wellbeing is our product.',
    body: `Health outcomes today are largely predicted by postcode, income, and ethnicity. Belrose puts the same data infrastructure that pharmaceutical companies and insurers use into the hands of every patient regardless of background. With Belrose, your wellbeing — not your data — becomes the product.`,
    stat: '∞',
    statLabel: 'The value of your health, controlled by you',
  },
];
