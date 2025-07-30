export interface ProcessedFile {
  id: string;
  name: string;
  fileHash?: string;
  extractedText?: string;
  wordCount?: number;
  [key: string]: any; // Allow for additional properties
}

export interface DeduplicationStats {
  duplicatesFound: number;
  uniqueFiles: number;
  duplicatesByHash: Record<string, number>;
  [key: string]: any; // Allow for additional stats properties
}

export interface FileExportData {
  fileName: string;
  fileId: string;
  fileHash?: string;
  extractedText?: string;
  wordCount?: number;
  fhirData?: any;
  firestoreInfo?: any;
}

export interface ExportSummary {
  totalFiles: number;
  totalWords: number;
  fhirConversions: number;
  savedToFirestore: number;
  deduplicationInfo: DeduplicationStats;
}

export interface ExportData {
  exportedAt: string;
  summary: ExportSummary;
  files: FileExportData[];
}

export interface ExportOptions {
  includeExtractedText?: boolean;
  includeFhirData?: boolean;
  includeFirestoreInfo?: boolean;
  format?: 'json' | 'csv';
}

/**
 * CSV export configuration
 */
export interface CSVExportConfig {
  headers: string[];
  delimiter: string;
  includeHeaders: boolean;
}

/**
 * Export statistics without deduplication info
 */
export type BasicExportStats = Pick<ExportSummary, 'totalFiles' | 'totalWords' | 'fhirConversions' | 'savedToFirestore'>;