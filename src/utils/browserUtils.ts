// src/utils/browserUtils.ts
// Utils used throughout project for browser actions like copy, scroll, download, print, etc.

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    // Optionally show a toast or quick alert
    console.log('Copied to clipboard:', text);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};
