//src/features/ViewEditRecord/components/View/FilterTabs.tsx

/**
 * component for filter tabs on AllRecords.tsx component
 */

import { RecordFilterType } from '../../hooks/useUserRecords';

interface FilterTabsProps {
  filterType: RecordFilterType;
  onFilterChange: (type: RecordFilterType) => void;
  user: any;
  uniqueSubjects: string[];
  selectedSubjectId: string | undefined;
  setSelectedSubjectId: (id: string | undefined) => void;
  loadingProfiles: boolean;
  getDisplayName: (id: string) => string;
}

const FilterTabs: React.FC<FilterTabsProps> = ({
  filterType,
  onFilterChange,
  user,
  uniqueSubjects,
  selectedSubjectId,
  setSelectedSubjectId,
  loadingProfiles,
  getDisplayName,
}) => (
  <div className="bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div className="flex space-x-8">
          {(
            [
              { value: 'all', label: 'All Records' },
              { value: 'subject', label: 'Filter by Patient' },
              { value: 'uploaded', label: 'Uploaded by Me' },
              { value: 'owner', label: 'I Own' },
            ] as { value: RecordFilterType; label: string }[]
          ).map(tab => (
            <button
              key={tab.value}
              onClick={() => onFilterChange(tab.value)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                filterType === tab.value
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filterType === 'subject' && (
          <div className="py-2">
            <select
              value={selectedSubjectId || ''}
              onChange={e => setSelectedSubjectId(e.target.value || undefined)}
              disabled={loadingProfiles}
              className="bg-background block w-64 rounded-md border border-border shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50"
            >
              <option value="">
                {user?.uid && uniqueSubjects.includes(user.uid)
                  ? 'My Health Records'
                  : 'Select a patient...'}
              </option>
              {user?.uid && uniqueSubjects.includes(user.uid) && (
                <option value={user.uid}>{getDisplayName(user.uid)} (Me)</option>
              )}
              {uniqueSubjects
                .filter(id => id !== user?.uid)
                .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
                .map(subjectId => (
                  <option key={subjectId} value={subjectId}>
                    {getDisplayName(subjectId)}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>
    </div>
  </div>
);

export default FilterTabs;
