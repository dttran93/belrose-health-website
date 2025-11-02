import { toast } from 'sonner';
import { FileObject } from '@/types/core';

/**
 * Centralizes copy/download actions
 */
export const useRecordFileActions = () => {
  /**
   * Copies the complete record JSON to clipboard
   */
  const handleCopyRecord = async (record: FileObject) => {
    try {
      // Create a clean, readable JSON string
      const jsonString = JSON.stringify(record, null, 2); // '2' adds nice indentation

      // Copy to clipboard
      await navigator.clipboard.writeText(jsonString);

      console.log('Record copied to clipboard');
      toast.success(`📋 Copied ${record.belroseFields?.title}`, {
        description: 'Complete record JSON copied to clipboard',
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to copy record:', error);
      toast.error('Failed to copy record', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        duration: 4000,
      });
    }
  };

  /**
   * Downloads the complete record as a JSON file
   */
  const handleDownloadRecord = (record: FileObject) => {
    try {
      // Create a clean, readable JSON string
      const jsonString = JSON.stringify(record, null, 2);

      // Create a Blob (a file-like object) from the JSON string
      const blob = new Blob([jsonString], { type: 'application/json' });

      // Create a temporary download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate a meaningful filename
      const fileName = `${record.belroseFields?.title || 'health-record'}_${record.id}.json`;
      link.download = fileName;

      // Trigger the download
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('Record downloaded successfully');
      toast.success(`📥 Downloaded ${record.belroseFields?.title}`, {
        description: 'Record saved as JSON file',
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to download record:', error);
      toast.error('Failed to download record', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        duration: 4000,
      });
    }
  };

  return {
    handleDownloadRecord,
    handleCopyRecord,
  };
};
