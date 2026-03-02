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
    title: 'Failure of care coordination costs U.S. nearly $80 billion annually',
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
  'nhs-waste': {
    num: 11,
    year: '2013',
    title: 'NHS IT System described as "the biggest IT failure ever seen"',
    source: 'The Guardian',
    apaCitation:
      'Syal, R. (2013, September 18). Abandoned NHS IT system has cost £10bn so far. The Guardian. https://www.theguardian.com/society/2013/sep/18/nhs-records-system-10bn',
    url: 'https://www.theguardian.com/society/2013/sep/18/nhs-records-system-10bn',
  },
  'nhs-digital-maturity': {
    num: 12,
    year: '2022',
    title: 'NHS rates only 20% of organizations as "digitally mature"',
    source: 'UK Department of Health & Social Care',
    apaCitation:
      'A plan for digital health and social care. (2022, June 29). GOV.UK. https://www.gov.uk/government/publications/a-plan-for-digital-health-and-social-care/a-plan-for-digital-health-and-social-care',
    url: 'https://www.gov.uk/government/publications/a-plan-for-digital-health-and-social-care/a-plan-for-digital-health-and-social-care',
  },
  'nhs-darzi': {
    num: 13,
    year: '2024',
    title:
      'Independent investigation of NHS concludes "digital maturity is still low across much of the NHS"',
    source: 'UK Department of Health & Social Care',
    apaCitation:
      'Department of Health and Social Care. (2024, November 15). Independent investigation of the NHS in England. GOV.UK. https://www.gov.uk/government/publications/independent-investigation-of-the-nhs-in-england',
    url: 'https://www.gov.uk/government/publications/independent-investigation-of-the-nhs-in-england',
  },
  'nhs-satisfaction': {
    num: 14,
    year: '2025',
    title: 'Public satisfaction with NHS falls to lowest levels in history',
    source: 'Nuffield Trust',
    apaCitation:
      'Public satisfaction with the NHS and social care in 2024: Results from the British Social Attitudes survey. (2025, April 2). Nuffield Trust. https://www.nuffieldtrust.org.uk/research/public-satisfaction-with-the-NHS-and-social-care-in-2024-Results-from-the-British-Social-Attitudes-survey',
    url: 'https://www.nuffieldtrust.org.uk/sites/default/files/2025-04/Public%20satisfaction%20with%20the%20NHS%20and%20social%20care%20in%202024_WEB%20%284%29.pdf',
  },
  'gematik-decade': {
    num: 15,
    year: '2015',
    title:
      'German insurance association, GKV-Spitzenverband, discusses failures of a decade of Gematik',
    source: 'GKV-Spitzenverband',
    apaCitation:
      'Gkv-Spitzenverband. (2015, January 16). Teuren Stillstand bei eGK-Projekt beenden - Schmerzgrenze für Beitragszahler überschritten. https://www.gkv-spitzenverband.de/presse/pressemitteilungen_und_statements/pressemitteilung_215744.jsp',
    url: 'https://www.gov.uk/government/publications/independent-investigation-of-the-nhs-in-england',
  },
  'gematik-hack-2025': {
    num: 16,
    year: '2025',
    title: 'Hackers bypass enhanced protection of electronic patient records',
    source: 'Der Spiegel',
    apaCitation:
      'Beuth, P., & Rosenbach, M. (2025, April 30). Digitalisierung in der Medizin: Hacker hebeln erweiterten Schutz der elektronischen Patientenakte aus. DER SPIEGEL, Hamburg, Germany. https://www.spiegel.de/netzwelt/web/elektronische-patientenakte-hacker-umgehen-auch-die-neuen-schutzmassnahmen-a-f3528e86-0c56-4567-8a23-8aa139c5edb7',
    url: 'https://www.spiegel.de/netzwelt/web/elektronische-patientenakte-hacker-umgehen-auch-die-neuen-schutzmassnahmen-a-f3528e86-0c56-4567-8a23-8aa139c5edb7',
  },
  'gematik-cost-bundestag': {
    num: 17,
    year: '2018',
    title:
      'Parliamentary State Secretary confirms that Gematik spent over 600 million euros between 2005 through 2017',
    source: '19th German Bundestag',
    apaCitation:
      'Deutscher Bundestag. (2018, January 12). Schriftliche Fragen mit den in der Woche vom 8. Januar 2018 eingegangenen Antworten der Bundesregierung, Frage 57 (Abgeordnete Sabine Zimmermann). https://dserver.bundestag.de/btd/19/004/1900415.pdf',
    url: 'https://dserver.bundestag.de/btd/19/004/1900415.pdf',
  },
  'gematik-cost-connectors': {
    num: 18,
    year: '2022',
    title:
      'Tech activist group, CCC, proves Gematik wasted over €400 million in unnecssary hardware upgrades',
    source: 'Chaos Computer Club',
    apaCitation:
      'CCC | Chaos Computer Club spart dem Gesundheitssystem 400 Millionen Euro. (2022, October 15). https://www.ccc.de/de/updates/2022/konnektoren-400-millionen-geschenk',
    url: 'https://www.ccc.de/de/updates/2022/konnektoren-400-millionen-geschenk',
  },
  'snds-covid19': {
    num: 19,
    year: '2022',
    title:
      'French government scientific group discusses positive role of SNDS in COVID-19 response',
    source: 'EPI-PHARE',
    apaCitation:
      'Zureik, M., Cuenot, F., Weill, A., & Dray-Spira, R. (2023). Contribution of real-life studies in France during the COVID-19 pandemic and for the national pharmaco-epidemiological surveillance of COVID-19 vaccines. Therapies, 78(5), 553–557. https://doi.org/10.1016/j.therap.2022.12.013',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9851737/#:~:text=By%20exploiting%20massive%20and%20complex,and%20on%20the%20benefits%20and',
  },
  'dmp-cost': {
    num: 20,
    year: '2012',
    title:
      'French National Assembly audit determines cost of DMP to be over €500 million but adoption less than 20% of target',
    source: 'French National Assembly',
    apaCitation:
      'Cour des comptes. (2012). Le coût du dossier médical personnel depuis sa mise en place. In Cour Des Comptes. https://www.ccomptes.fr/sites/default/files/EzPublish/rapport_cout_dossier_medical_personnel.pdf',
    url: 'https://www.ccomptes.fr/sites/default/files/EzPublish/2_2_5_teleservices_publics_sante.pdf',
  },
  'dmp-audit': {
    num: 21,
    year: '2013',
    title: 'French National Assembly report calls DMP "absent of strategy"',
    source: 'French National Assembly',
    apaCitation:
      'Cour des comptes. (2013). Les téléservices publics de santé : un pilotage toujours insuffisant. In Rapport Public Annuel 2013 – Février 2013 (p. 366). https://www.ccomptes.fr/sites/default/files/EzPublish/2_2_5_teleservices_publics_sante.pdf',
    url: 'https://www.ccomptes.fr/sites/default/files/EzPublish/rapport_cout_dossier_medical_personnel.pdf',
  },
  'mes-lassurance': {
    num: 22,
    year: '2026',
    title:
      'French National Insurance Fund reports only around one-third of MES accounts have been accessed even once',
    source: 'French National Insurance Fund',
    apaCitation:
      'Quatre ans de Mon espace santé. (2026, January 29). L’Assurance Maladie. https://www.assurance-maladie.ameli.fr/presse/2026-01-29-cp-mon-espace-sante-quatre-ans',
    url: 'https://www.assurance-maladie.ameli.fr/presse/2026-01-29-cp-mon-espace-sante-quatre-ans',
  },
  'sweden-who': {
    num: 23,
    year: '2023',
    title:
      'WHO Health Systems Monitor comments on the regional fragmentation of Swedish Health Records',
    source: 'European Observatory on Health Systems and Policies',
    apaCitation:
      'Health System Review for Sweden 2023. (n.d.). OBS. https://eurohealthobservatory.who.int/monitors/health-systems-monitor/countries-hspm/hspm/sweden-2023/physical-and-human-resources/physical-resources',
    url: 'https://eurohealthobservatory.who.int/monitors/health-systems-monitor/countries-hspm/hspm/sweden-2023/physical-and-human-resources/physical-resources',
  },
  'sweden-journalen-usability': {
    num: 24,
    year: '2022',
    title: 'Swedish Unversity surveys Journalen users on problems with record interoperability',
    source: 'Journal of Medical Internet Research - Human Factors',
    apaCitation:
      'Hägglund, M., & Scandurra, I. (2022b). Usability of the Swedish Accessible Electronic Health Record: Qualitative Survey study. JMIR Human Factors, 9(2), e37192. https://doi.org/10.2196/37192',
    url: 'https://humanfactors.jmir.org/2022/2/e37192',
  },
  'jp-errors': {
    num: 25,
    year: '2023',
    title:
      'Prime Minister Kishida confirms 8,351 errors in My Number and health record integration',
    source: "Prime Minister's Office of Japan",
    apaCitation:
      '令和5年12月12日 マイナンバー情報総点検本部 | 総理の一日 | 首相官邸ホームページ. (2023, December 12). 首相官邸ホームページ. https://www.kantei.go.jp/jp/101_kishida/actions/202312/12mynumber.html',
    url: 'https://www.kantei.go.jp/jp/101_kishida/actions/202312/12mynumber.html',
  },
  'jp-errors2': {
    num: 26,
    year: '2023',
    title:
      "Japanese news reports on at least 5 cases of My Number cards showing another person's health data",
    source: 'The Japan News',
    apaCitation:
      '十鳥. (2023, May 14). Japan’s my number ID cards linked to wrong data in 1,000s of cases. The Japan News. https://japannews.yomiuri.co.jp/politics/politics-government/20230513-109551/',
    url: 'https://japannews.yomiuri.co.jp/politics/politics-government/20230513-109551/',
  },
  'jp-survey': {
    num: 27,
    year: '2025',
    title:
      'University of Tokyo Researchers find only 28.6% of Japanese adults express willingness to share health data with the government',
    source: 'Archives of Public Health',
    apaCitation:
      'Sassa, M., Eguchi, A., Maruyama-Sakurai, K., Fujita, T., Kawamura, Y., Kawashima, T., Tanoue, Y., Yoneoka, D., Miyata, H., Yamashita, T., Nakashima, N., & Nomura, S. (2025). Heterogeneity in willingness to share personal health information: a nationwide cluster analysis of 20,000 adults in Japan. Archives of Public Health, 83(1), 109. https://doi.org/10.1186/s13690-025-01599-z',
    url: 'https://link.springer.com/article/10.1186/s13690-025-01599-z',
  },
  'cures-act': {
    num: 28,
    year: '2020',
    title: '21st Century Cures Act imposes penalties for data blocking',
    source: 'US National Archive: Federal Register',
    apaCitation:
      'Office of the National Coordinator for Health Information Technology (ONC) & Department of Health and Human Services (HHS). (2020, June 30). 21st Century Cures Act: Interoperability, information blocking, and the ONC Health IT Certification Program. National Archives: Federal Register. https://www.federalregister.gov/documents/2020/05/01/2020-07419/21st-century-cures-act-interoperability-information-blocking-and-the-onc-health-it-certification',
    url: 'https://www.federalregister.gov/documents/2020/05/01/2020-07419/21st-century-cures-act-interoperability-information-blocking-and-the-onc-health-it-certification',
  },
  'hhs-sued': {
    num: 29,
    year: '2025',
    title:
      'A federal judge orders the US Department of Health and Human Services to stop giving deportation officials Medicaid data',
    source: 'Associated Press',
    apaCitation:
      'Seitz, A., & Kindy, K. (2025, August 14). Judge halts access to personal information of 79M Medicaid enrollees | AP News. AP News. https://apnews.com/article/rfk-jr-medicaid-data-deportation-immigrants-trump-9a6ac84c6c23a608cfc5d343f6433c7f',
    url: 'https://apnews.com/article/rfk-jr-medicaid-data-deportation-immigrants-trump-9a6ac84c6c23a608cfc5d343f6433c7f',
  },
  'ehealth-factsheet': {
    num: 30,
    year: '2024',
    title: 'e-Estonia discusses statistics regarding Estonian National Health Information Service',
    source: 'e-Estonia',
    apaCitation:
      'e-Health Record Factsheet. (2024). In e-Estonia. Retrieved February 25, 2026, from https://e-estonia.com/wp-content/uploads/factsheet_e-health.pdf',
    url: 'https://e-estonia.com/wp-content/uploads/factsheet_e-health.pdf',
  },
  'estonia-biobank': {
    num: 31,
    year: '2025',
    title:
      'The Estonian Biobank team documents the impressive capabilities of the Estonian Biobank',
    source: 'Nature',
    apaCitation:
      'Milani, L., Alver, M., Laur, S., Reisberg, S., Haller, T., Aasmets, O., Abner, E., Alavere, H., Allik, A., Annilo, T., Fischer, K., Hofmeister, R., Hudjashov, G., Jõeloo, M., Kals, M., Karo-Astover, L., Kasela, S., Kolde, A., Krebs, K., . . . Metspalu, A. (2025). The Estonian Biobank’s journey from biobanking to personalized medicine. Nature Communications, 16(1), 3270. https://doi.org/10.1038/s41467-025-58465-3',
    url: 'https://www.nature.com/articles/s41467-025-58465-3',
  },
  'estonia-history': {
    num: 32,
    year: '2018',
    title: 'Estonian researchers document 10 years of the e-Health system',
    source: 'Tallinn University',
    apaCitation:
      'Metsallik, J., Ross, P., Department of Health Technologies, Tallinn University of Technology, Draheim, D., Piho, G., & Information Systems Group, Tallinn University of Technology. (2018). Ten years of the e-Health system in Estonia [Journal-article]. http://ceur-ws.org/Vol-2336/MMHS2018_invited.pdf',
    url: 'https://ceur-ws.org/Vol-2336/MMHS2018_invited.pdf',
  },
  'sg-private': {
    num: 33,
    year: '2011',
    title:
      'Singapore Ministry of Health surveys the current primary care landscape, finds 81% of primary care attendences are with private GP clinics',
    source: 'Singapore Ministry of Health',
    apaCitation:
      'Transforming the primary care landscape: Engaging the GP community and our stakeholders in the journey. (2011, October 8). Ministry of Health. https://www.moh.gov.sg/newsroom/transforming-the-primary-care-landscape-engaging-the-gp-community-and-our-stakeholders-in-the-journey/',
    url: 'https://www.moh.gov.sg/newsroom/transforming-the-primary-care-landscape-engaging-the-gp-community-and-our-stakeholders-in-the-journey/',
  },
  'sg-hib': {
    num: 34,
    year: '2026',
    title:
      'Health Information Bill mandating private providers data disclosure passed in Singapore Parliament',
    source: 'Singapore Ministry of Health',
    apaCitation:
      'HEALTH INFORMATION BILL TO SUPPORT COORDINATED CARE ACROSS SINGAPORE’S HEALTHCARE ECOSYSTEM. (2026, January 12). Ministry of Health. https://www.moh.gov.sg/newsroom/health-information-bill-to-support-coordinated-care-across-singapore-s-healthcare-ecosystem/',
    url: 'https://www.moh.gov.sg/newsroom/health-information-bill-to-support-coordinated-care-across-singapore-s-healthcare-ecosystem/',
  },
  'sg-hack': {
    num: 35,
    year: '2018',
    title:
      'Singapore Ministry of Health announces data breach affecting 1.5 million patients including Prime Minister Loong',
    source: 'Singapore Ministry of Health',
    apaCitation:
      "SingHealth’s IT system target of cyberattack. (2018, July 20). Ministry of Health. https://www.moh.gov.sg/newsroom/singhealth's-it-system-target-of-cyberattack/",
    url: "https://www.moh.gov.sg/newsroom/singhealth's-it-system-target-of-cyberattack/",
  },
  'databroker-rev': {
    num: 36,
    year: '2025',
    title: 'UnitedHealth Group announces Optum insights made $18.8 billion in 2024',
    source: 'UnitedHealth Group',
    apaCitation:
      'Witty, A. & UnitedHealth Group. (2025). UnitedHealth Group reports 2024 results. https://www.unitedhealthgroup.com/content/dam/UHG/PDF/investors/2024/2025-16-01-uhg-reports-fourth-quarter-results.pdf',
    url: "https://www.moh.gov.sg/newsroom/singhealth's-it-system-target-of-cyberattack/",
  },
  '7t-prevention': {
    num: 37,
    year: '2018',
    title:
      'Singapore Ministry of Health announces data breach of 1.5 million patients including Prime Minister Loong',
    source: 'Singapore Ministry of Health',
    apaCitation:
      "SingHealth’s IT system target of cyberattack. (2018, July 20). Ministry of Health. https://www.moh.gov.sg/newsroom/singhealth's-it-system-target-of-cyberattack/",
    url: "https://www.moh.gov.sg/newsroom/singhealth's-it-system-target-of-cyberattack/",
  },
};
