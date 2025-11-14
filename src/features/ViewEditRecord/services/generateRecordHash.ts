import { FileObject } from '@/types/core';

//These are the only lines that are hashed.
export type HashableFileContent = Pick<
  FileObject,
  | 'fileName'
  | 'extractedText'
  | 'originalText'
  | 'originalFileHash'
  | 'contextText'
  | 'fhirData'
  | 'belroseFields'
  | 'customData'
>;

export class RecordHashService {
  /**
   * Generate a hash of the medical record content
   */
  static async generateRecordHash(fileObject: HashableFileContent): Promise<string> {
    console.log('🔐 Starting complete record encryption...');
    console.log('  - FileName:', fileObject.fileName ? 'Yes' : 'No');
    console.log('  - Original File Hash:', fileObject.originalFileHash ? 'Yes' : 'No');
    console.log('  - ExtractedText:', fileObject.extractedText ? 'Yes' : 'No');
    console.log('  - OriginalText:', fileObject.originalText ? 'Yes' : 'No');
    console.log('  - contextText:', fileObject.contextText ? 'Yes' : 'No');
    console.log('  - FHIR:', fileObject.fhirData ? 'Yes' : 'No');
    console.log('  - BelroseFields:', fileObject.belroseFields ? 'Yes' : 'No');
    console.log('  - CustomData:', fileObject.customData ? 'Yes' : 'No');

    const hashableContent = {
      // Only Core content that affects record integrity
      fileName: fileObject.fileName || null,
      extractedText: fileObject.extractedText || null,
      originalText: fileObject.originalText || null,
      originalFileHash: fileObject.originalFileHash || null,
      contextText: fileObject.contextText || null,
      fhirData: fileObject.fhirData || null,
      belroseFields: fileObject.belroseFields || null,
      customData: fileObject.customData || null,
      // Exclude UI state, timestamps, processing status, etc.
      // as these don't affect the medical content integrity
    };

    // Sort keys to ensure consistent hashing
    const sortedContent = this.sortObjectKeys(hashableContent);
    const contentString = JSON.stringify(sortedContent);

    console.log('🧩 Hashing keys:', Object.keys(sortedContent));

    // Use Web Crypto API for proper cryptographic hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(contentString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }

  /**
   * Recursively sort object keys for consistent hashing
   */
  private static sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }

    const sortedObj: any = {};
    const sortedKeys = Object.keys(obj).sort();

    for (const key of sortedKeys) {
      sortedObj[key] = this.sortObjectKeys(obj[key]);
    }

    return sortedObj;
  }
}
