//src/features/AddRecord/components/FHIRValidation.tsx

/**
 * This component shows different UI statuses based on how FHIR conversion went
 * Used just in case the AI comes back with a non-FHIR format
 * UI components for displaying FHIR conversion results and validation status.
 *
 * ValidationStatus — renders a colour-coded badge showing whether the AI-generated
 * FHIR passed structural validation (valid / warnings / errors).
 *
 * This appears after the file has uploaded and in the expanded details dropdown
 * EnhancedFHIRResults — full results panel: resource type, entry count, contained
 * resource types, validation badge, and a collapsible raw JSON view.
 */

import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import type { ValidationIssue, FHIRWithValidation } from '../services/fhirConversionService.type';
import type { BundleResource } from '@/types/fhir';
import type { LucideIcon } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationStatusProps {
  fhirData: FHIRWithValidation | null;
  className?: string;
}

interface StatusConfig {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  message: string;
}

export interface FHIRResult {
  success: boolean;
  error?: string;
  fhirData?: FHIRWithValidation;
}

export interface EnhancedFHIRResultsProps {
  fhirResult: FHIRResult;
}

// ============================================================================
// COMPONENTS
// ============================================================================

export const ValidationStatus: React.FC<ValidationStatusProps> = ({ fhirData, className = '' }) => {
  const validation = fhirData?._validation;

  if (!validation) return null;

  const getStatusConfig = (): StatusConfig => {
    if (validation.isValid && !validation.hasWarnings) {
      return {
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        message: 'Valid FHIR Resource',
      };
    }
    if (validation.isValid && validation.hasWarnings) {
      return {
        icon: AlertTriangle,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        message: `Valid FHIR with ${validation.warnings.length} warning${validation.warnings.length > 1 ? 's' : ''}`,
      };
    }
    if (validation.hasErrors) {
      return {
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        message: `Invalid FHIR - ${validation.errors.length} error${validation.errors.length > 1 ? 's' : ''}`,
      };
    }
    return {
      icon: Info,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      message: 'Validation status unknown',
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={`p-3 rounded border ${config.bgColor} ${config.borderColor} ${className}`}>
      <div className="flex items-start space-x-2">
        <Icon className={`w-4 h-4 mt-0.5 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${config.color}`}>{config.message}</p>

          {(validation.hasErrors || validation.hasWarnings) && (
            <div className="mt-2 space-y-1">
              {validation.errors?.map((error: ValidationIssue, index: number) => (
                <div key={`error-${index}`} className="text-xs text-red-600">
                  <span className="font-medium">Error:</span> {error.message}
                  {error.location && <span className="text-red-500"> (at {error.location})</span>}
                </div>
              ))}
              {validation.warnings?.map((warning: ValidationIssue, index: number) => (
                <div key={`warning-${index}`} className="text-xs text-yellow-600">
                  <span className="font-medium">Warning:</span> {warning.message}
                  {warning.location && (
                    <span className="text-yellow-500"> (at {warning.location})</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-1 text-xs text-gray-500">
            Validated at {new Date(validation.validatedAt).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export const EnhancedFHIRResults: React.FC<EnhancedFHIRResultsProps> = ({ fhirResult }) => {
  if (!fhirResult.success) {
    return (
      <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
        <strong>FHIR Conversion Error:</strong> {fhirResult.error}
      </div>
    );
  }

  const { fhirData } = fhirResult;

  if (!fhirData) {
    return (
      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-200">
        No FHIR data available
      </div>
    );
  }

  // Narrow to BundleResource to safely access entry
  const bundle =
    fhirData.resourceType === 'Bundle' ? (fhirData as unknown as BundleResource) : null;
  const entries = bundle?.entry ?? [];
  const resourceTypes = [...new Set(entries.map(e => e.resource.resourceType))];

  return (
    <div className="space-y-3">
      <div className="bg-purple-50 p-3 rounded text-sm border border-purple-200">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium">Resource Type:</span> {fhirData.resourceType}
          </div>
          <div>
            <span className="font-medium">Entries:</span> {entries.length}
          </div>
        </div>
        {entries.length > 0 && (
          <div className="mt-2">
            <span className="font-medium">Contains:</span> {resourceTypes.join(', ')}
          </div>
        )}
      </div>

      <ValidationStatus fhirData={fhirData} />

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
          View Raw FHIR JSON
        </summary>
        <div className="mt-2 bg-white p-3 rounded text-xs text-gray-700 max-h-64 overflow-y-auto border">
          <pre className="whitespace-pre-wrap">{JSON.stringify(fhirData, null, 2)}</pre>
        </div>
      </details>
    </div>
  );
};
