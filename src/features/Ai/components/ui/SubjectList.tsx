// src/features/AIChat/components/SubjectList.tsx

import React from 'react';
import { User, Check } from 'lucide-react';

interface SubjectListProps {
  subjects: SubjectInfo[];
  selectedSubjectId?: string | null;
  currentUserId: string;
  onSelectSubject: (subjectId: string, isMyRecords: boolean) => void;
}

export interface SubjectInfo {
  id: string;
  name: string;
  firstName: string;
  recordCount: number;
  isCurrentUser: boolean;
}

export function SubjectList({
  subjects,
  selectedSubjectId,
  currentUserId,
  onSelectSubject,
}: SubjectListProps) {
  const myRecords = subjects.find(s => s.isCurrentUser);
  const otherSubjects = subjects.filter(s => !s.isCurrentUser);

  return (
    <div className="space-y-1">
      {/* My Records - Always first */}
      {myRecords && (
        <button
          onClick={() => onSelectSubject(myRecords.id, true)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors ${
            selectedSubjectId === myRecords.id
              ? 'bg-blue-50 border border-blue-200'
              : 'border border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                selectedSubjectId === myRecords.id ? 'bg-blue-100' : 'bg-gray-100'
              }`}
            >
              <User
                className={`w-4 h-4 ${
                  selectedSubjectId === myRecords.id ? 'text-blue-600' : 'text-gray-600'
                }`}
              />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-gray-900">My Records</div>
              <div className="text-xs text-gray-500">
                {myRecords.recordCount} record{myRecords.recordCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          {selectedSubjectId === myRecords.id && (
            <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
          )}
        </button>
      )}

      {/* Other Subjects */}
      {otherSubjects.length > 0 && (
        <>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Other People's Records
          </div>
          {otherSubjects.map(subject => (
            <button
              key={subject.id}
              onClick={() => onSelectSubject(subject.id, false)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors ${
                selectedSubjectId === subject.id
                  ? 'bg-purple-50 border border-purple-200'
                  : 'border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    selectedSubjectId === subject.id ? 'bg-purple-100' : 'bg-gray-100'
                  }`}
                >
                  <User
                    className={`w-4 h-4 ${
                      selectedSubjectId === subject.id ? 'text-purple-600' : 'text-gray-600'
                    }`}
                  />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-900">{subject.name}</div>
                  <div className="text-xs text-gray-500">
                    {subject.recordCount} record{subject.recordCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              {selectedSubjectId === subject.id && (
                <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />
              )}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
