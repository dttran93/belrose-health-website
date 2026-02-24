// src/components/site/OurProtocol/whyItWorksData.ts

import { Building2, Crown, HeartHandshake, TrendingUp } from 'lucide-react';

/**
 * Content of Why it works panel
 */

export const whySections = [
  {
    icon: Building2,
    label: 'The Problem',
    heading: 'Your data is sold for billions. You get nothing.',
    body: `Health data companies harvest your data from wherever they can legally obtain them, aggregate them into identity graphs, and sell them to hospitals, insurers, and governments. You contributed that value and received nothing. `,
    stat: '$50B',
    statLabel: 'Estimate of the annual revenue of US health data brokers',
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
    stat: '$7T',
    statLabel: 'Estimated healthcare cost savings with better prevention and earlier intervention',
  },
  {
    icon: HeartHandshake,
    label: 'A Healthier, More Equitable World',
    heading: 'Your wellbeing is our product.',
    body: `Health outcomes today are largely predicted by postcode, income, and ethnicity. Belrose puts the same data infrastructure that pharmaceutical companies and insurers use into the hands of every patient. With Belrose, your wellbeing — not your data — becomes the product.`,
    stat: '∞',
    statLabel: 'The value of your health, controlled by you',
  },
];
