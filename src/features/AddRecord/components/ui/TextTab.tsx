import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import type { FHIRWithValidation } from '../../services/fhirConversionService.type';
import { VirtualFileInput } from '@/types/core';
import { VirtualFileResult } from '../CombinedUploadFHIR.type';

interface TextTabProps {
  convertTextToFHIR?: (text: string) => Promise<FHIRWithValidation>;
  addFhirAsVirtualFile: (
    fhirData: FHIRWithValidation,
    options?: VirtualFileInput & { autoUpload?: boolean }
  ) => Promise<VirtualFileResult>;
}

const TextTab: React.FC<TextTabProps> = ({ convertTextToFHIR, addFhirAsVirtualFile }) => {
  const [plainText, setPlainText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!plainText.trim()) return;

    setSubmitting(true);
    try {
      let fhirData: FHIRWithValidation;

      if (convertTextToFHIR) {
        fhirData = await convertTextToFHIR(plainText);
      } else {
        // Fallback: wrap the text in a minimal FHIR Bundle
        fhirData = {
          resourceType: 'Bundle',
          id: crypto.randomUUID(),
          type: 'collection',
          entry: [
            {
              resource: {
                resourceType: 'DocumentReference',
                id: crypto.randomUUID(),
                status: 'current',
                content: [{ attachment: { contentType: 'text/plain', data: btoa(plainText) } }],
                description: 'Medical note',
                date: new Date().toISOString(),
              },
            },
          ],
          _validation: {
            isValid: true,
            hasErrors: false,
            hasWarnings: false,
            errors: [],
            warnings: [],
            info: [],
            validatedAt: new Date().toISOString(),
            validatorVersion: '1.0.0',
          },
        };
      }

      await addFhirAsVirtualFile(fhirData, {
        fileName: `Medical Note - ${new Date().toLocaleDateString()}`,
        sourceType: 'Plain Text Submission',
        originalText: plainText.trim(),
        autoUpload: true,
      });

      toast.success('Medical note saved successfully!', {
        description: 'Your note has been converted to FHIR and saved to your health record',
        duration: 4000,
      });

      setPlainText('');
    } catch (error) {
      console.error('Error converting text to FHIR:', error);
      toast.error(
        `Failed to save medical note: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          duration: 6000,
        }
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Medical Note or Description
        </label>
        <textarea
          value={plainText}
          onChange={e => setPlainText(e.target.value)}
          placeholder={`Describe what happened during the medical visit...\n\nExamples:\n• "Had routine checkup with Dr. Smith. Blood pressure was 120/80. Everything looks normal."\n• "Visited urgent care for sore throat. Prescribed amoxicillin 500mg, take twice daily for 10 days."\n• "Follow-up appointment for diabetes. HbA1c improved to 7.2%. Continue current medication."\n• "Annual physical exam completed. All vitals within normal range. Recommended yearly mammogram."`}
          className="w-full bg-background min-h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-none focus:ring-1 focus:ring-complement-1 resize-none"
          disabled={submitting}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Your text will be automatically converted to medical FHIR format and saved.
        </p>
        <Button
          onClick={handleSubmit}
          disabled={!plainText.trim() || submitting}
          className={`px-6 py-2 rounded-lg font-medium ${
            !plainText.trim() || submitting ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : ''
          }`}
        >
          {submitting ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Converting...</span>
            </div>
          ) : (
            'Save Medical Note'
          )}
        </Button>
      </div>
    </div>
  );
};

export default TextTab;
