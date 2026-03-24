// src/utils/browserUtils.ts
// Utils used throughout project for browser actions like copy, scroll, download, print, etc.

import { toast } from 'sonner';

// Copy to clipboard helper with toast notification
export const copyToClipboard = async (text: string, label: string = 'Text'): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  } catch (err) {
    console.error('Failed to copy:', err);
    toast.error('Failed to copy to clipboard');
  }
};
