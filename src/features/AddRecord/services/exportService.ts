import type {
  ProcessedFile,
  DeduplicationStats,
  FileExportData,
  ExportSummary,
  ExportData,
  BasicExportStats
} from './exportService.type';

export class ExportService {
  /**
   * Generate structured export data from processed files and metadata
   */
  generateExportData(
    processedFiles: ProcessedFile[],
    fhirData: Map<string, any>,
    firestoreData: Map<string, any>,
    deduplicationStats: DeduplicationStats
  ): ExportData {
    return {
      exportedAt: new Date().toISOString(),
      summary: {
        totalFiles: processedFiles.length,
        totalWords: processedFiles.reduce((sum, f) => sum + (f.wordCount || 0), 0),
        fhirConversions: fhirData.size,
        savedToFirestore: firestoreData.size,
        deduplicationInfo: deduplicationStats
      },
      files: processedFiles.map((file): FileExportData => ({
        fileName: file.name,
        fileId: file.id,
        fileHash: file.fileHash,
        extractedText: file.extractedText,
        wordCount: file.wordCount,
        fhirData: fhirData.get(file.id),
        firestoreInfo: firestoreData.get(file.id)
      }))
    };
  }

  /**
   * Download data as JSON file
   */
  downloadData(data: ExportData | any, filename: string): void {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      
      // Temporarily add to DOM, click, then remove
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up the object URL
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download data:', error);
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download data as CSV file (alternative export format)
   */
  downloadAsCSV(data: ExportData, filename: string): void {
    try {
      // Convert files data to CSV format
      const csvHeaders = [
        'File Name',
        'File ID', 
        'File Hash',
        'Word Count',
        'Has FHIR Data',
        'Saved to Firestore'
      ];

      const csvRows = data.files.map((file): string => {
        return [
          `"${file.fileName}"`,
          `"${file.fileId}"`,
          `"${file.fileHash || ''}"`,
          file.wordCount?.toString() || '0',
          file.fhirData ? 'Yes' : 'No',
          file.firestoreInfo ? 'Yes' : 'No'
        ].join(',');
      });

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download CSV:', error);
      throw new Error(`CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get export statistics without downloading
   */
  getExportStats(
    processedFiles: ProcessedFile[],
    fhirData: Map<string, any>,
    firestoreData: Map<string, any>
  ): BasicExportStats {
    return {
      totalFiles: processedFiles.length,
      totalWords: processedFiles.reduce((sum, f) => sum + (f.wordCount || 0), 0),
      fhirConversions: fhirData.size,
      savedToFirestore: firestoreData.size
    };
  }
}

// Export singleton instance for convenience
export const exportService = new ExportService();