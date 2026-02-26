//src/components/site/Company/ui/FlagSelector.tsx

import { useState } from 'react';
import { CountryEntry } from '../data/countryData';

interface FlagSelectorProps {
  countries: CountryEntry[];
}

const FlagSelector: React.FC<FlagSelectorProps> = ({ countries }) => {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div>
      {/* Flag buttons */}
      <div className="flex flex-wrap gap-2 mb-4 justify-between">
        {countries.map((country, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={`flex flex-grow items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all duration-150
              ${
                selected === i
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-white'
              }`}
          >
            <div className="flex-shrink-0">{country.flag}</div>
            <span className="text-[13px]">{country.name}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div>{selected !== null ? countries[selected]?.content : null}</div>
    </div>
  );
};

export default FlagSelector;
