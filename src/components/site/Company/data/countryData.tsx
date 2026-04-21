import { ReactNode } from 'react';
import GB from 'country-flag-icons/react/3x2/GB';
import DE from 'country-flag-icons/react/3x2/DE';
import FR from 'country-flag-icons/react/3x2/FR';
import SE from 'country-flag-icons/react/3x2/SE';
import JP from 'country-flag-icons/react/3x2/JP';
import US from 'country-flag-icons/react/3x2/US';
import EE from 'country-flag-icons/react/3x2/EE';
import SG from 'country-flag-icons/react/3x2/SG';
import CitationLink from '../../Citations/CitationLink';

export interface CountryEntry {
  flag: ReactNode;
  name: string;
  content: ReactNode;
}

const countryData: CountryEntry[] = [
  {
    flag: <GB className="w-6 h-4" />,
    name: 'United Kingdom',
    content: (
      <>
        <p className="text-left mb-4">
          The UK's effort to centralize health records is one of the most expensive IT failures in
          history. In the early 2000s, Prime Minister Tony Blair announced NHS Connecting for
          Health, an effort to centralize the NHS' records with a budget that eventually ballooned
          to over £10 billion
          <CitationLink id="nhs-waste" />. The programme was scrapped in 2013, having achieved
          almost none of its core objectives.
        </p>
        <p className="text-left mb-4">
          What has followed is a revolving door of successor agencies and programmes: care.data,
          HSCIC, NHS Digital, NHSX, and many more, each inheriting the same structural problems and
          failing in turn. As of 2025, only 20% of NHS organisations are considered "digitally
          mature" with many still using paper records
          <CitationLink id="nhs-digital-maturity" /> and an independent review in 2024 concluded
          that the NHS "remains in the foothills of digital transformation" and that "the last
          decade was a missed opportunity"
          <CitationLink id="nhs-darzi" />.
        </p>
        <p className="text-left mb-4">
          With public satisfaction regarding the NHS at its lowest point ever
          <CitationLink id="nhs-satisfaction" />, the United Kingdom stands as a stark reminder of
          the potential of data failures to exacerbate or cascade into broader systemic problems.
        </p>
      </>
    ),
  },
  {
    flag: <DE className="w-6 h-4" />,
    name: 'Germany',
    content: (
      <>
        {' '}
        <p className="text-left mb-4">
          In 2002, the German government set an ambitious goal: a smart health card for every
          citizen by 2006, spearheaded by Gematik GmbH. For a decade the only thing Gematik
          succeeded in producing was a card that stored your name and insurance status, no records
          <CitationLink id="gematik-decade" />.
        </p>
        <p className="text-left mb-4">
          In 2016, the E-Health law was passed to force insurers to offer digital records by 2021.
          By 2023, the government realized record adoption was less than 1% and decided to make it
          an opt-out system. In 2025, Gematik launched their grand finale: the elektronische
          Patientenakte (ePa). Within 1 day of the launch, security consultants at Chaos Computer
          Club uncovered ePa vulnerabilities that allowed them to access millions of records
          <CitationLink id="gematik-hack-2025" />.
        </p>
        <p className="text-left mb-4">
          Although the vulnerabilities were patched and 73 million Germans now technically have a
          digital health record, the dream of comprehensive health records remains distant. With
          over a billion euros spent between running Gematik
          <CitationLink id="gematik-cost-bundestag" />, unnecessary hardware replacements
          <CitationLink id="gematik-cost-connectors" />, and general bureaucratic delay, Gematik has
          earned a reputation as the BER of Healthcare: a project that limped across the finish line
          not through innovation or demand, but through blunt legislation and attrition.
        </p>
      </>
    ),
  },
  {
    flag: <FR className="w-6 h-4" />,
    name: 'France',
    content: (
      <>
        {' '}
        <p className="text-left mb-4">
          The French have built one of the most powerful health databases in the world: the Système
          National des Données de Santé (SNDS). SNDS combines data from France's national insurer
          and hospitals to get longitudinal data across 99% of France's population. For example,
          SNDS contributed heavily to the world's response to the COVID-19 pandemic
          <CitationLink id="snds-covid19" />. However, SNDS has population data, very useful for
          public health research, but it can't tell your new doctor you are allergic to penicillin,
          that was the job of the Dossier Médical Personnel (DMP).
        </p>
        <p className="text-left mb-4">
          DMP has a familiar story arc: controversy, little usage, and massive public spending{' '}
          <CitationLink id="dmp-cost" />. By 2020, after 16 years, 3 rebrands, and hundreds of
          millions spent, only 9.3 million accounts (~15% of the country) had been opened, and the
          vast majority were inactive. A government-commissioned audit report remarked that DMP
          suffered from "a particularly abnormal and damaging absence of strategy"
          <CitationLink id="dmp-audit" />.
        </p>
        <p className="text-left mb-4">
          Mon Espace Santé (MES), as DMP is now known, fixed this by changing to an opt-out system
          creating 65 million DMP accounts virtually overnight. Further, the inactivity problem has
          improved, with over 420 million automated document uploads to the service. However, the
          practical usage gap remains, as of 2026, only around one third of accounts have been
          accessed even once
          <CitationLink id="mes-lassurance" />.
        </p>
      </>
    ),
  },
  {
    flag: <SE className="w-6 h-4" />,
    name: 'Sweden',
    content: (
      <>
        <p className="text-left mb-4">
          Sweden is frequently cited as proof that centralization of health records works. The
          country's patient portal, 1177.se, gives citizens access to their medical records through
          a service called Journalen. By many measures it is genuinely good; it's the #1 medical app
          in Sweden and has a satisfaction rating that is the envy of health ministries worldwide.
          The catch is that Sweden doesn't have one system, it has 21 of them.
        </p>
        <p className="text-left mb-4">
          Sweden's 21 autonomous regions each procures and operates its own EHR infrastructure. This
          led to the National Patient Summary (NPÖ), designed to bridge these regional silos.
          However, in practice it remains incomplete. As the World Health Organization's health
          systems monitor noted plainly, "the information shared through NPÖ is incomplete because
          not all health care providers are connected" <CitationLink id="sweden-who" />.
        </p>
        <p className="text-left mb-4">
          It is the patients who feel this directly. In a national survey of Journalen users,
          respondents described being forced to carry paper copies of their records across regional
          borders: "Now I have to deliver paper copies from one region to the other. Horrible..."
          <CitationLink id="sweden-journalen-usability" />. Sweden's achievement is real and has
          certainly improved delivery of care, but it is a system built for institutions, not
          patients. The moment a patient moves, travels, or requires care far from home, the cracks
          emerge.
        </p>
      </>
    ),
  },
  {
    flag: <JP className="w-6 h-4" />,
    name: 'Japan',
    content: (
      <>
        {' '}
        <p className="text-left mb-4">
          It is tempting to read centralization failures as a distinctly Western problem manifesting
          from an overemphasis on individualism, privacy, and skepticism. Japan with its universal
          healthcare, high institutional trust, and culture emphasizing civic compliance, tests that
          perspective. Observers might have expected Japan's efforts to link health records and the
          national ID system (the My Number card) to go smoothly.
        </p>
        <p className="text-left mb-4">
          Instead what happened was health insurance associations made over 8,000 linkage errors
          <CitationLink id="jp-errors" />. In 5 cases, patients found themselves viewing other
          people's prescriptions and medical expenses <CitationLink id="jp-errors2" />. The
          government correctly noted the error rate was just 0.01% across 82 million records. But
          for the Japanese public, this validated long-standing concerns around health data sharing
          and collection.
        </p>
        <p className="text-left mb-4">
          A 2023 nationwide survey of 20,000 Japanese adults found although 65% of adults were
          willing to share health data with healthcare providers, less than 30% were willing to do
          so with government agencies
          <CitationLink id="jp-survey" />. In a society routinely cited as a model of social
          harmony, not even a third of citizens trust the government to centralize their health
          data. The problem is not culture; it is the difficulty of execution and concentration of
          risk.
        </p>
      </>
    ),
  },
  {
    flag: <US className="w-6 h-4" />,
    name: 'United States',
    content: (
      <>
        {' '}
        <p className="text-left mb-4">
          The United States never attempted government centralization of health records. Instead it
          delegated the task to private markets. The result: a mix of private predatory market
          practices and public institutional data abuse.
        </p>
        <p className="text-left mb-4">
          A few private companies dominate the US health record space. Their strategy is that of a
          predatory oligopoly, embrace open standards enough to satisfy regulators, extend them with
          proprietary layers to create lock-in, and extinguish competition by making it
          prohibitively expensive to leave. The 21st Century CURES Act was required to force these
          companies to build interoperability APIs
          <CitationLink id="cures-act" />. Governments and businesses bicker while the patient,
          whose data is the center of all this, struggles for access.
        </p>
        <p className="text-left mb-4">
          Another risk of centralization reveals itself in the US's public insurance system.
          Medicare and Medicaid aggregate health data for over 100 million Americans for whom they
          pay for healthcare. 20 states are now grappling with this centralization as they sue the
          government for allegedly providing Medicaid data to immigration authorities amid a
          controversial immigration crackdown <CitationLink id="hhs-sued" />.
        </p>
        <p className="text-left mb-4">
          The United States serves as a cautionary tale for every person who may support
          centralization: you may trust the government or company holding your records today, but
          centralization is not easily undone. Your data will outlast any administration, board of
          directors, and promise of good intentions.
        </p>
      </>
    ),
  },
  {
    flag: <EE className="w-6 h-4" />,
    name: 'Estonia',
    content: (
      <>
        {' '}
        <p className="text-left mb-4">
          Estonia is the steelman case for record centralization. Its system works. Nearly 100% of
          residents have a digital health record from birth and 100% of prescriptions are processed
          digitally
          <CitationLink id="ehealth-factsheet" />. The Estonian Genome Centre at the University of
          Tartu operates one of the world's most productive population biobanks and has been used to
          advance personalized medicine <CitationLink id="estonia-biobank" />.
        </p>
        <p className="text-left mb-4">
          But this success requires context. Estonia is a country of 1.4 million people. In 1991,
          when Estonia was established following the dissolution of the Soviet Union, information
          technology was severely underdeveloped and so there were no legacy systems to contend with
          <CitationLink id="estonia-history" />. This small, blank slate was the perfect canvas for
          a comprehensive centralized health record system.
        </p>
        <p className="text-left mb-4">
          Estonia's success should not be diminished; it proves that when the conditions are right,
          centralized health infrastructure can unlock profound benefits. However, it does not prove
          those conditions can be easily replicated. For countries that are significantly larger,
          older, and more skeptical, Estonia is less an aspirational model than a reminder of a ship
          that has long since sailed.
        </p>
      </>
    ),
  },
  {
    flag: <SG className="w-6 h-4" />,
    name: 'Singapore',
    content: (
      <>
        <p className="text-left mb-4">
          Singapore launched the National Electronic Health Record (NEHR) in 2011. NEHR consolidates
          health data across Singapore's public providers into a single accessible record. It is
          well-funded, technically sound, and politically supported.
        </p>
        <p className="text-left mb-4">
          The only problem is 80% of primary care is delivered through the private sector
          <CitationLink id="sg-private" /> and as of 2026, the vast majority of private clinics do
          not contribute to NEHR. This prompted the Singaporean parliament to pass the Health
          Information Bill, mandating private clinics' participation by 2027. What is remarkable
          about the bill is that there is no opt out from contributing data to NEHR, providers must
          submit regardless of patient preference. Although patients will be able to place access
          restrictions, those restrictions can be overridden by doctors
          <CitationLink id="sg-hib" />. 2027 will be the first real test of whether legal coercion
          can overcome the privacy preferences of citizens.
        </p>
        <p className="text-left mb-4">
          But Singapore also illustrates another dark-side of centralization: catastrophic data
          breaches. In July 2018, Singapore's largest public healthcare group, SingHealth, was
          hacked. By the time the breach was contained, the records of 1.5 million patients,
          approximately 25% of the country's population, had been exposed
          <CitationLink id="sg-hack" />. When centralization succeeds, a target is placed on a
          massive concentration of sensitive data, attractive enough to draw nation-state-level
          attackers.
        </p>
      </>
    ),
  },
];

export default countryData;
