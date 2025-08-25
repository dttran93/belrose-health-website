import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  VersionDiff,
  VersionDiffViewerProps
} from '../services/versionControlService.types';

export const VersionDiffViewer: React.FC<VersionDiffViewerProps> = ({ diff, onClose }) => {
  const renderValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'string') return value;
    return String(value);
  };

  const getFieldDescription = (path: string): string => {
    // Convert field paths to more user-friendly descriptions
    if (path.includes('fhirData')) {
      if (path.includes('entry')) {
        const match = path.match(/entry\[(\d+)\]\.resource\.(\w+)/);
        if (match) {
          const resourceType = match[2] === 'resourceType' ? 'Resource Type' : match[2];
          return `FHIR Resource ${match[1]} - ${resourceType}`;
        }
        return path.replace('fhirData.', 'FHIR: ');
      }
      return path.replace('fhirData.', 'FHIR: ');
    }
    if (path.includes('belroseFields')) {
      return path.replace('belroseFields.', '').replace(/([A-Z])/g, ' $1').toLowerCase();
    }
    if (path === 'extractedText') return 'Extracted Text';
    if (path === 'originalText') return 'Original Text';
    return path;
  };

  const truncateValue = (value: string, maxLength: number = 200): string => {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + '...';
  };

  return (
    <div className="bg-white border rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div>
          <h3 className="font-semibold text-lg">Version Comparison</h3>
          <p className="text-sm text-gray-600 mt-1">{diff.summary}</p>
          <p className="text-xs text-gray-500">
            {new Date(diff.timestamp).toLocaleString()}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Changes */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {diff.changes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No changes detected between these versions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {diff.changes.map((change, index) => (
              <div 
                key={index}
                className={`border rounded-lg ${
                  change.operation === 'create' ? 'border-green-200 bg-green-50' :
                  change.operation === 'update' ? 'border-blue-200 bg-blue-50' :
                  'border-red-200 bg-red-50'
                }`}
              >
                <div className="p-3">
                  {/* Change Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        change.operation === 'create' ? 'bg-green-100 text-green-800' :
                        change.operation === 'update' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {change.operation.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium">
                        {getFieldDescription(change.path)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">
                      {change.path}
                    </span>
                  </div>

                  {/* Change Content */}
                  {change.operation === 'update' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                          Before:
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                          <pre className="text-xs text-red-800 whitespace-pre-wrap overflow-x-auto">
                            {truncateValue(renderValue(change.oldValue))}
                          </pre>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          After:
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded p-2">
                          <pre className="text-xs text-green-800 whitespace-pre-wrap overflow-x-auto">
                            {truncateValue(renderValue(change.newValue))}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {change.operation === 'create' && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        Added:
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded p-2">
                        <pre className="text-xs text-green-800 whitespace-pre-wrap overflow-x-auto">
                          {truncateValue(renderValue(change.newValue))}
                        </pre>
                      </div>
                    </div>
                  )}

                  {change.operation === 'delete' && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                        Removed:
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <pre className="text-xs text-red-800 whitespace-pre-wrap overflow-x-auto">
                          {truncateValue(renderValue(change.oldValue))}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {change.description && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-600">{change.description}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};