import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export const ValidationStatus = ({ fhirData, className = '' }) => {
  const validation = fhirData?._validation;
  
  if (!validation) return null;

  const getStatusConfig = () => {
    if (validation.isValid && !validation.hasWarnings) {
      return {
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        message: 'Valid FHIR Resource'
      };
    }
    
    if (validation.isValid && validation.hasWarnings) {
      return {
        icon: AlertTriangle,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        message: `Valid FHIR with ${validation.warnings.length} warning${validation.warnings.length > 1 ? 's' : ''}`
      };
    }
    
    if (validation.hasErrors) {
      return {
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        message: `Invalid FHIR - ${validation.errors.length} error${validation.errors.length > 1 ? 's' : ''}`
      };
    }
    
    return {
      icon: Info,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      message: 'Validation status unknown'
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={`p-3 rounded border ${config.bgColor} ${config.borderColor} ${className}`}>
      <div className="flex items-start space-x-2">
        <Icon className={`w-4 h-4 mt-0.5 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${config.color}`}>
            {config.message}
          </p>
          
          {/* Show validation details */}
          {(validation.hasErrors || validation.hasWarnings) && (
            <div className="mt-2 space-y-1">
              {validation.errors?.map((error, index) => (
                <div key={`error-${index}`} className="text-xs text-red-600">
                  <span className="font-medium">Error:</span> {error.message}
                  {error.location && <span className="text-red-500"> (at {error.location})</span>}
                </div>
              ))}
              
              {validation.warnings?.map((warning, index) => (
                <div key={`warning-${index}`} className="text-xs text-yellow-600">
                  <span className="font-medium">Warning:</span> {warning.message}
                  {warning.location && <span className="text-yellow-500"> (at {warning.location})</span>}
                </div>
              ))}
            </div>
          )}
          
          {/* Validation metadata */}
          <div className="mt-1 text-xs text-gray-500">
            Validated at {new Date(validation.validatedAt).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced FHIR Results display for your CombinedUploadFHIR component
export const EnhancedFHIRResults = ({ fhirResult }) => {
  if (!fhirResult.success) {
    return (
      <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
        <strong>FHIR Conversion Error:</strong> {fhirResult.error}
      </div>
    );
  }

  const { fhirData } = fhirResult;

  return (
    <div className="space-y-3">
      {/* FHIR Summary */}
      <div className="bg-purple-50 p-3 rounded text-sm border border-purple-200">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium">Resource Type:</span> {fhirData.resourceType}
          </div>
          <div>
            <span className="font-medium">Entries:</span> {fhirData.entry?.length || 0}
          </div>
        </div>
        {fhirData.entry && fhirData.entry.length > 0 && (
          <div className="mt-2">
            <span className="font-medium">Contains:</span>{' '}
            {[...new Set(fhirData.entry.map(e => e.resource?.resourceType))].join(', ')}
          </div>
        )}
      </div>

      {/* NEW: Validation Status */}
      <ValidationStatus fhirData={fhirData} />

      {/* Full FHIR JSON (collapsible) */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
          View Raw FHIR JSON
        </summary>
        <div className="mt-2 bg-white p-3 rounded text-xs text-gray-700 max-h-64 overflow-y-auto border">
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(fhirData, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
};

// Updated status icon for your file list to show validation status
export const getEnhancedStatusIcon = (fileItem, fhirResult) => {
  // Your existing status icons for processing states
  switch (fileItem.status) {
    case 'extracting':
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    case 'analyzing_image':
      return <Eye className="w-4 h-4 animate-pulse text-purple-500" />;
    case 'detecting_medical':
      return <Loader2 className="w-4 h-4 animate-spin text-orange-500" />;
    case 'medical_detected':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'non_medical_detected':
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    case 'converting':
      return <Loader2 className="w-4 h-4 animate-spin text-purple-500" />;
    case 'completed':
      // NEW: Show validation status for completed files
      if (fhirResult?.success && fhirResult.fhirData?._validation) {
        const validation = fhirResult.fhirData._validation;
        if (validation.isValid && !validation.hasWarnings) {
          return <CheckCircle className="w-4 h-4 text-green-500" />;
        } else if (validation.isValid && validation.hasWarnings) {
          return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
        } else if (validation.hasErrors) {
          return <AlertCircle className="w-4 h-4 text-red-500" />;
        }
      }
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'extraction_error':
    case 'detection_error':
    case 'fhir_error':
    case 'processing_error':
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return null;
  }
};

// Enhanced status text that includes validation info
export const getEnhancedStatusText = (fileItem, fhirResult) => {
  // Your existing status text for processing states
  const baseStatus = getStatusText(fileItem.status); // Your existing function
  
  // Add validation info for completed files
  if (fileItem.status === 'completed' && fhirResult?.success && fhirResult.fhirData?._validation) {
    const validation = fhirResult.fhirData._validation;
    if (validation.isValid && !validation.hasWarnings) {
      return baseStatus + ' • Valid FHIR';
    } else if (validation.isValid && validation.hasWarnings) {
      return baseStatus + ` • Valid FHIR (${validation.warnings.length} warnings)`;
    } else if (validation.hasErrors) {
      return baseStatus + ` • Invalid FHIR (${validation.errors.length} errors)`;
    }
  }
  
  return baseStatus;
};