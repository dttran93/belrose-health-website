// src/features/ViewEditRecord/components/Edit/AIEditPanel.tsx

/**
 * AI-assisted editing panel for the FHIR tab.
 * Shown only when editable === true.
 * User types a plain-English change request, AI applies it to the
 * FHIR data, and the result is surfaced in the editor above for review.
 * User still hits the normal Save button to commit — this doesn't bypass
 * the existing save/encrypt/hash flow.
 */

import React, { useState } from 'react';
import { Sparkles, Loader2, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileObject } from '@/types/core';
import { useRecordEdit } from '../hooks/useRecordEdit';

interface AIEditPanelProps {
  record: FileObject;
  onFhirDataChange: (updatedFhir: any) => void;
  onBelroseFieldsChange: (updatedFields: any) => void;
}

const AIEditPanel: React.FC<AIEditPanelProps> = ({
  record,
  onFhirDataChange,
  onBelroseFieldsChange,
}) => {
  const [inputValue, setInputValue] = useState('');

  const { isLoading, error, sendEditRequest, clearError } = useRecordEdit(
    record,
    (updatedFhir, updatedBelrose) => {
      if (updatedFhir) onFhirDataChange(updatedFhir);
      if (updatedBelrose) onBelroseFieldsChange(updatedBelrose);
    }
  );

  const handleSubmit = async () => {
    if (!inputValue.trim() || isLoading) return;
    await sendEditRequest(inputValue.trim());
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-600" />
        <p className="text-sm font-medium text-blue-900">AI-assisted editing</p>
      </div>

      <p className="text-xs text-blue-700">
        Describe what you want to change in plain English. The AI will update the FHIR data above —
        review the changes before saving.
      </p>

      {error && (
        <div
          className="flex items-center justify-between bg-red-50 border border-red-200 
                        rounded p-2 text-xs text-red-700"
        >
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={clearError}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='e.g. "Change the blood pressure to 120/80 mmHg" or "Remove the penicillin allergy"'
          disabled={isLoading}
          rows={2}
          className="flex-1 text-sm border border-blue-200 rounded-md p-2 bg-white 
                     resize-none focus:outline-none focus:border-blue-400 
                     disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!inputValue.trim() || isLoading}
          className="self-end shrink-0"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
        </Button>
      </div>

      <p className="text-xs text-blue-500">Press Enter to apply · Shift+Enter for new line</p>
    </div>
  );
};

export default AIEditPanel;
