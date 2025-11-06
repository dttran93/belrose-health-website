import React, { useState } from 'react';
import { Calendar, User, Stethoscope, Building2, FileText, Clock } from 'lucide-react';
import { BelroseFields } from '@/types/core';
import { formatTimestamp } from '@/utils/dataFormattingUtils';

interface BelroseRecordProps {
  Data: BelroseFields | undefined;
  editable?: boolean;
  onDataEdited?: (hasChanges: boolean) => void;
  onDataChange?: (updatedData: any) => void;
}

export const BelroseRecord: React.FC<BelroseRecordProps> = ({
  Data,
  editable = false,
  onDataChange,
}) => {
  const [editedData, setEditedData] = useState(Data || {});

  // Update editedData when Data changes (important for when switching between records)
  React.useEffect(() => {
    if (Data) {
      setEditedData(Data);
    }
  }, [Data]);

  // Notify parent of changes as they happen
  const updateField = (field: keyof BelroseFields, value: string) => {
    const newData = { ...editedData, [field]: value };
    setEditedData(newData);
    if (onDataChange) {
      onDataChange(newData);
    }
  };

  if (!Data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <FileText className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg">No record data available</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            {editable ? (
              <input
                type="text"
                value={editedData.visitType || ''}
                onChange={e => updateField('visitType', e.target.value)}
                className="text-base bg-background font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                placeholder="Visit Type..."
              />
            ) : (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary">
                {Data.visitType}
              </span>
            )}
          </div>
          {editable ? (
            <input
              type="text"
              value={editedData.title || ''}
              onChange={e => updateField('title', e.target.value)}
              className="text-base bg-background font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              placeholder="Enter record title..."
            />
          ) : (
            <h1 className="text-3xl font-bold text-gray-900">{Data.title}</h1>
          )}
        </div>
      </div>

      {/* Key Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date */}
        <div className="bg-chart-2/10 rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-foreground mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Date</span>
          </div>
          {editable ? (
            <input
              type="date"
              value={editedData.completedDate?.split('T')[0] || ''}
              onChange={e => updateField('completedDate', e.target.value)}
              className="text-base bg-background font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          ) : (
            <p className="text-base font-semibold text-gray-900">
              {formatTimestamp(Data.completedDate, 'date-short')}
            </p>
          )}
        </div>

        {/* Patient */}
        <div className="bg-chart-3/10 rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-foreground mb-2">
            <User className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Patient</span>
          </div>
          {editable ? (
            <input
              type="text"
              value={editedData.patient || ''}
              onChange={e => updateField('patient', e.target.value)}
              className="text-base bg-background font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              placeholder="Patient name..."
            />
          ) : (
            <p className="text-base font-semibold text-gray-900">{Data.patient}</p>
          )}
        </div>

        {/* Provider */}
        <div className="bg-chart-1/10 rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-foreground mb-2">
            <Stethoscope className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Provider</span>
          </div>
          {editable ? (
            <input
              type="text"
              value={editedData.provider || ''}
              onChange={e => updateField('provider', e.target.value)}
              className="text-base bg-background font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              placeholder="Provider name..."
            />
          ) : (
            <p className="text-base font-semibold text-gray-900">{Data.provider}</p>
          )}
        </div>

        {/* Institution */}
        <div className="bg-chart-5/10 rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-foreground mb-2">
            <Building2 className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Facility</span>
          </div>
          {editable ? (
            <input
              type="text"
              value={editedData.institution || ''}
              onChange={e => updateField('institution', e.target.value)}
              className="text-base bg-background font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              placeholder="Institution name..."
            />
          ) : (
            <p className="text-base font-semibold text-gray-900">{Data.institution}</p>
          )}
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-chart-4/10 rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Quick Summary
        </h2>
        {editable ? (
          <textarea
            value={editedData.summary || ''}
            onChange={e => updateField('summary', e.target.value)}
            rows={5}
            className="text-base bg-background text-gray-900 border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            placeholder="Enter a brief summary..."
          />
        ) : (
          <p className="text-gray-700 text-left leading-relaxed text-base">{Data.summary}</p>
        )}
      </div>

      {/* Detailed Narrative Section */}
      {Data.detailedNarrative && (
        <div className="bg-chart-4/10 rounded-xl border border-gray-200 p-6">
          {/* Header */}
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Detailed Clinical Record
          </h2>

          {/* Content */}
          <div>
            {editable ? (
              <textarea
                value={editedData.detailedNarrative || ''}
                onChange={e => updateField('detailedNarrative', e.target.value)}
                rows={16}
                className="text-base bg-background text-gray-900 border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                placeholder="Enter detailed narrative..."
              />
            ) : (
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-800 text-left leading-relaxed whitespace-pre-wrap">
                  {Data.detailedNarrative}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BelroseRecord;
