import { ReactNode } from 'react';
import GB from 'country-flag-icons/react/3x2/GB';
import DE from 'country-flag-icons/react/3x2/DE';
import FR from 'country-flag-icons/react/3x2/FR';
import AU from 'country-flag-icons/react/3x2/AU';
import JP from 'country-flag-icons/react/3x2/JP';

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
          The UK's effort to centralise health records is one of the most expensive IT failures in
          history. It began in the early 2000s with NHS Connecting for Health — Prime Minister Tony
          Blair's vision for a "patient-led NHS" — and a budget of £6.2 billion that eventually
          ballooned to over £10 billion. The programme was scrapped in 2013, having achieved almost
          none of its core objectives.{' '}
        </p>{' '}
        <p className="text-left mb-4">
          What has followed is a revolving door of successor agencies and programmes — care.data,
          HSCIC, NHS Digital, NHSX, and many more — each inheriting the same structural problems and
          failing in turn. As of 2025, only 20% of NHS organisations are considered "digitally
          mature", large portions still use paper records, and public satisfaction with the NHS has
          fallen to its lowest point ever.
        </p>
        <p className="text-left mb-4">
          An independent review in 2024 concluded that the NHS "remains in the foothills of digital
          transformation" and that "the last decade was a missed opportunity."
        </p>
      </>
    ),
  },
  {
    flag: <DE className="w-6 h-4" />,
    name: 'Germany',
    content: <></>,
  },
  {
    flag: <FR className="w-6 h-4" />,
    name: 'France',
    content: <></>,
  },
  {
    flag: <AU className="w-6 h-4" />,
    name: 'Australia',
    content: <></>,
  },
  {
    flag: <JP className="w-6 h-4" />,
    name: 'Japan',
    content: <></>,
  },
];

export default countryData;
