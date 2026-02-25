// src/components/site/Citations/citationsData.ts
// Component for listing citations

import { ReactNode } from 'react';

export interface Citation {
  num: number;
  year: string;
  title: string;
  source: string;
  apaCitation?: string;
  url?: string;
  content?: ReactNode;
}

export const citations: Record<string, Citation> = {
  'waste-in-US-healthcare': {
    num: 1,
    year: '2019',
    title: 'Failure of care coordination costs U.S. up to $80 billion annually',
    source: 'Journal of the American Medical Association',
    apaCitation:
      'Shrank, W. H., Rogstad, T. L., & Parekh, N. (2019). Waste in the US health care system. JAMA, 322(15), 1501. https://doi.org/10.1001/jama.2019.13978',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31589283/',
  },
  'darnell-smith': {
    num: 2,
    year: '2024',
    title:
      'Coroner Report describes "missed opportunities... to take obesrvations... in line with individualized care plan"',
    source: 'UK Courts and Tribunals Judiciary',
    apaCitation:
      'Courts and Tribunals Judiciary. (2024, June 6). Darnell Smith: Prevention of future deaths report - Courts and Tribunals Judiciary. https://www.judiciary.uk/prevention-of-future-death-reports/darnell-smith-prevention-of-future-deaths-report/',
    url: 'https://www.judiciary.uk/prevention-of-future-death-reports/darnell-smith-prevention-of-future-deaths-report/',
  },
  'nice-rwe': {
    num: 3,
    year: '2024',
    title: 'NICE acknowledges trial results may not "translate well to the target population"',
    source: 'National Institute for Health and Care Excellence',
    apaCitation:
      'NICE. (2022, June 23). Overview | NICE real-world evidence framework | Guidance | NICE. https://www.nice.org.uk/corporate/ecd9',
    url: 'https://www.nice.org.uk/corporate/ecd9/chapter/introduction-to-real-world-evidence-in-nice-decision-making',
  },
  'icer-rwe': {
    num: 4,
    year: '2021',
    title: 'ICER discusses consideration of real world evidence in its methodology',
    source: 'Institute for Clinical and Economic Review',
    apaCitation:
      'ICER. (2021, March 16). Considering clinical, Real-World, and unpublished evidence - ICER. https://icer.org/our-approach/methods-process/considering-clinical-real-world-and-unpublished-evidence/',
    url: 'https://icer.org/our-approach/methods-process/considering-clinical-real-world-and-unpublished-evidence/',
  },
  'ccri-fda': {
    num: 5,
    year: '2024',
    title:
      'The FDA discusses the "regulatory and scientific barriers" in accessing real world evidence',
    source: 'Food and Drug Administration',
    apaCitation:
      'U.S. Food and Drug Administration. (2024, December 12). CDER Center for Real-World Evidence Innovation (CCRI) frequently asked questions. https://www.fda.gov/about-fda/cder-center-real-world-evidence-innovation-ccri/cder-center-real-world-evidence-innovation-ccri-frequently-asked-questions',
    url: 'https://www.fda.gov/about-fda/cder-center-real-world-evidence-innovation-ccri/cder-center-real-world-evidence-innovation-ccri-frequently-asked-questions',
  },
  'google-health': {
    num: 6,
    year: '2011',
    title: 'Analysis of the demise of Google Health',
    source: 'MIT Technology Review',
    apaCitation:
      'Talbot, D. (2020, April 2). How a broken medical system killed Google Health. MIT Technology Review. https://www.technologyreview.com/2011/06/29/193325/how-a-broken-medical-system-killed-google-health/',
    url: 'https://www.technologyreview.com/2011/06/29/193325/how-a-broken-medical-system-killed-google-health/',
  },
  'ms-healthvault': {
    num: 7,
    year: '2019',
    title: 'The shutdown of Mirosoft HealthVault',
    source: "Becker's Hospital Review",
    apaCitation:
      'Drees, J. (2019, April 8). Microsoft to shut down patient medical records service HealthVault by November. Becker’s Hospital Review | Healthcare News & Analysis. https://www.beckershospitalreview.com/healthcare-information-technology/microsoft-to-shut-down-patient-medical-records-service-healthvault-by-november/',
    url: 'https://www.beckershospitalreview.com/healthcare-information-technology/microsoft-to-shut-down-patient-medical-records-service-healthvault-by-november/',
  },
  'cambridge-analytica': {
    num: 8,
    year: '2019',
    title: "Whistleblower discusses Facebook's role in Cambridge Analytica scandal",
    source: 'The Guardian',
    apaCitation:
      'Cadwalladr, C. (2018, March 18). ‘I made Steve Bannon’s psychological warfare tool’: meet the data war whistleblower. The Guardian. https://www.theguardian.com/news/2018/mar/17/data-war-whistleblower-christopher-wylie-faceook-nix-bannon-trump',
    url: 'https://www.theguardian.com/news/2018/mar/17/data-war-whistleblower-christopher-wylie-faceook-nix-bannon-trump',
  },
  'nsa-snowden': {
    num: 9,
    year: '2013',
    title:
      "Whistleblower Edward Snowden reveals big tech's participation in vast government surveilence program",
    source: 'The Washington Post',
    apaCitation:
      'Gellman, B., & Poitras, L. (2013, June 7). U.S., British intelligence mining data from nine U.S. Internet companies in broad secret program. The Washington Post. https://www.washingtonpost.com/investigations/us-intelligence-mining-data-from-nine-us-internet-companies-in-broad-secret-program/2013/06/06/3a0c0da8-cebf-11e2-8845-d970ccb04497_story.html?hpid=z1',
    url: 'https://www.washingtonpost.com/investigations/us-intelligence-mining-data-from-nine-us-internet-companies-in-broad-secret-program/2013/06/06/3a0c0da8-cebf-11e2-8845-d970ccb04497_story.html?hpid=z1',
  },
  'nhs-hack-2025': {
    num: 10,
    year: '2025',
    title: 'NHS hack linked to patient death',
    source: 'InfoSecurity Magazine',
    apaCitation:
      'Mascellino, A. . (2025, June 26). Patient death linked to NHS Cyber-Attack. Infosecurity Magazine. https://www.infosecurity-magazine.com/news/patient-death-linked-nhs-cyber/',
    url: 'https://www.infosecurity-magazine.com/news/patient-death-linked-nhs-cyber/',
  },

  'gdpr-article-15': {
    num: 1,

    year: '2016',
    title:
      'Regulation (EU) 2016/679 (General Data Protection Regulation), Article 15 – Right of access by the data subject',
    apaCitation: 'asdf',
    source: 'Official Journal of the European Union',
    url: 'https://gdpr-info.eu/art-15-gdpr/',
  },
  'hipaa-access-rule': {
    num: 2,
    year: '2000',
    title:
      'Standards for Privacy of Individually Identifiable Health Information (HIPAA Privacy Rule)',
    source: 'Federal Register, 65(250)',
    url: 'https://www.hhs.gov/hipaa/for-professionals/privacy/index.html',
  },
  'nhs-it-programme': {
    num: 3,
    year: '2013',
    title:
      'The dismantled NHS IT programme: Report, together with formal minutes, oral and written evidence',
    source: 'UK Parliament',
    url: 'https://publications.parliament.uk/pa/cm201314/cmselect/cmpubacc/294/294.pdf',
  },
  'fda-personalised-medicine': {
    num: 4,
    year: '2023',
    title: 'Novel Drug Approvals for 2023',
    source: 'FDA Center for Drug Evaluation and Research',
    url: 'https://www.fda.gov/drugs/new-drugs-fda-cders-new-molecular-entities-and-new-therapeutic-biological-products/novel-drug-approvals-2023',
  },
  'medical-errors-deaths': {
    num: 5,
    year: '2016',
    title: 'Medical error — the third leading cause of death in the US',
    source: 'BMJ, 353, i2139',
    url: 'https://doi.org/10.1136/bmj.i2139',
  },
  'health-data-market': {
    num: 6,
    year: '2023',
    title: 'Healthcare Data Analytics Market Size, Share & Trends Analysis Report',
    source: 'Grand View Research',
    url: 'https://www.grandviewresearch.com/industry-analysis/healthcare-data-analytics-market',
  },
};
