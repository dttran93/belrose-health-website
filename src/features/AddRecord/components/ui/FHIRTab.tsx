import React, { useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import {
  validateBasicFhirStructure,
  getValidationSummary,
  SimpleFHIRValidation,
} from '../../utils/fhirValidationUtils';
import type { FHIRWithValidation } from '../../services/fhirConversionService.type';
import { VirtualFileInput } from '@/types/core';
import { VirtualFileResult } from '../CombinedUploadFHIR.type';

interface FHIRTabProps {
  addFhirAsVirtualFile: (
    fhirData: FHIRWithValidation,
    options?: VirtualFileInput & { autoUpload?: boolean }
  ) => Promise<VirtualFileResult>;
}

const FHIRTab: React.FC<FHIRTabProps> = ({ addFhirAsVirtualFile }) => {
  const [fhirText, setFhirText] = useState('');
  const [contextText, setContextText] = useState('');
  const [validation, setValidation] = useState<SimpleFHIRValidation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFhirTextChange = (value: string) => {
    setFhirText(value);
    setValidation(value.trim() ? validateBasicFhirStructure(value) : null);
  };

  const handleSubmit = async () => {
    if (!fhirText.trim() || !validation?.valid) return;

    setSubmitting(true);
    try {
      const fhirData: FHIRWithValidation = JSON.parse(fhirText);

      await addFhirAsVirtualFile(fhirData, {
        fileName: `Manual FHIR Input - ${fhirData.resourceType}`,
        sourceType: 'Manual FHIR JSON Submission',
        originalText: fhirText.trim(),
        autoUpload: true,
        contextText: contextText.trim(),
      });

      toast.success('FHIR data uploaded successfully!', {
        description: 'Your FHIR data is now in your Comprehensive Health Record',
        duration: 4000,
      });

      setFhirText('');
      setContextText('');
      setValidation(null);
    } catch (error) {
      console.error('Error submitting FHIR data:', error);
      toast.error(
        `Failed to upload FHIR data: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      <div className="px-6 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Record Context (Optional)
        </label>
        <textarea
          value={contextText}
          onChange={e => setContextText(e.target.value)}
          placeholder={`Add any relevant context. For example:\n\n• "This file is from Dr. Smith and contains my X-ray after my right leg injury"\n• "This is my vaccination record from childhood"`}
          className="w-full bg-background min-h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-none focus:ring-1 focus:ring-complement-1 resize-none"
        />
      </div>

      <div className="px-6 pb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">FHIR JSON Data</label>
          <textarea
            value={fhirText}
            onChange={e => handleFhirTextChange(e.target.value)}
            placeholder={`Paste your FHIR JSON here...\n\nExample:\n{\n  "resourceType": "Bundle",\n  "type": "collection",\n  "entry": [\n    {\n      "resource": {\n        "resourceType": "Patient",\n        "name": [{"family": "Smith", "given": ["John"]}],\n        "birthDate": "1990-01-01"\n      }\n    }\n  ]\n}`}
            className="w-full h-64 px-3 py-2 bg-background border border-gray-300 rounded-md focus:outline-none focus:border-none focus:ring-1 focus:ring-complement-1 font-mono text-sm"
            disabled={submitting}
          />
        </div>

        {validation && (
          <div
            className={`p-3 rounded-lg border ${
              validation.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {validation.valid ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span
                className={`font-medium ${validation.valid ? 'text-green-800' : 'text-red-800'}`}
              >
                {getValidationSummary(validation)}
              </span>
            </div>

            {validation.error && <p className="text-red-700 text-sm mt-1">{validation.error}</p>}

            {validation.valid && (
              <div className="text-green-700 text-sm mt-1">
                Resource Type: {validation.resourceType}
                {validation.entryCount && <span> • {validation.entryCount} entries</span>}
                {validation.resourceTypes && validation.resourceTypes.length > 0 && (
                  <div className="mt-1">Contains: {validation.resourceTypes.join(', ')}</div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!validation?.valid || submitting}
            className={`px-6 py-2 rounded-lg font-medium ${
              !validation?.valid || submitting ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : ''
            }`}
          >
            {submitting ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Uploading...</span>
              </div>
            ) : (
              'Upload FHIR Data'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FHIRTab;
