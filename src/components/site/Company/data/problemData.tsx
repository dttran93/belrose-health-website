import CitationLink from '../../Citations/CitationLink';
import FlagSelector from '../ui/FlagSelector';
import { ProblemCard } from '../ui/ProblemCard';
import countryData from './countryData';

const problemData: ProblemCard[] = [
  {
    num: '01',
    title: 'Records are siloed across providers, cities, and countries',
    body: (
      <>
        Your GP holds one fragment. The hospital holds another. The specialist across town holds a
        third. When you move, immigrate, or simply see a new doctor, your history goes dark. The
        current system is a patchwork of hardcopy records and siloed servers — often in conflicting
        formats that cannot be merged. The failure to coordinate care costs the US upwards of $80
        billion annually <CitationLink id="waste-in-US-healthcare" />.
      </>
    ),
    highlight: (
      <>
        At its worst, this has led directly to the death of patients{' '}
        <CitationLink id="darnell-smith" />
      </>
    ),
  },
  {
    num: '02',
    title: 'Without complete records, the promise of HealthTech will never be realized',
    body: (
      <>
        The history of medicine is littered with interventions that showed great promise in
        controlled settings, only to fail in the real world <CitationLink id="nice-rwe" />. Next
        generation health interventions will need real-world evidence alongside trial data to
        satisfy regulators <CitationLink id="icer-rwe" />. But real-world evidence requires
        real-world records. That infrastructure does not yet exist.
      </>
    ),
    highlight: (
      <>
        In 2024, the FDA established the CDER Center for Real-World Evidence Innovation to address
        the "volume and complexity of regulatory and policy issues related to real-world data" (i.e.
        fragmentation, silos, and inaccessibility of data ) <CitationLink id="ccri-fda" />.
      </>
    ),
  },
  {
    num: '03',
    title: 'Centralization has failed everywhere it has been tried',
    body: (
      <>
        Virtually every developed nation's government and scores of private businesses
        <CitationLink id="google-health" />
        <CitationLink id="ms-healthvault" /> have failed at some sort of health record
        centralization effort. The problem is not technical. It is structural: centralized systems
        require patients to trust governments and corporations with their most intimate data. That
        trust has been repeatedly broken
        <CitationLink id="cambridge-analytica" />
        <CitationLink id="nsa-snowden" />
        <CitationLink id="nhs-hack-2025" />.
      </>
    ),
    highlight: (
      <>
        These are not stories of lazy governments or poor execution. Brilliant citizens tried
        seriously and failed seriously. The lesson is not that they did it wrong. It is that
        centralization itself is the wrong approach.{' '}
        <div className="mt-4">
          <FlagSelector countries={countryData} />
        </div>
      </>
    ),
  },
];

export default problemData;
