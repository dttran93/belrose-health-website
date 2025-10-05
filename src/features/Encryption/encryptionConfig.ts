// src/features/Encryption/config/encryptionConfig.ts

export const ENCRYPTION_CONFIG = {
  // ==================== FEATURE FLAG ====================
  // Set to false during development, true for production
  enabled: false, // ← START WITH THIS FALSE!

  // ==================== ENCRYPTION SETTINGS ====================
  algorithm: 'AES-GCM' as const,
  keyLength: 256,
  ivLength: 12, // 96 bits for GCM

  // PBKDF2 settings for user key derivation
  pbkdf2: {
    iterations: 100000,
    hash: 'SHA-256' as const,
  },

  // ==================== DEVELOPMENT SETTINGS ====================
  dev: {
    logEncryption: true, // Log encryption operations
    logDecryption: true, // Log decryption operations
    measurePerformance: true, // Measure encryption/decryption time
    allowPlaintext: true, // Allow storing plaintext when disabled
  },

  // ==================== WHAT TO ENCRYPT ====================
  encryptComponents: {
    fileName: true, //Encrypt file name
    file: true, // Encrypt original uploaded file
    extractedText: true, // Encrypt extracted text
    originalText: true, // Encrypt original text
    fhirData: true, // Encrypt FHIR data
    belroseFields: true, // Encrypt Belrose fields
    customData: true, //encrypt custom data
  },
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if encryption is enabled
 */
export function isEncryptionEnabled(): boolean {
  return ENCRYPTION_CONFIG.enabled;
}

/**
 * Check if a specific component should be encrypted
 */
export function shouldEncryptComponent(
  component: keyof typeof ENCRYPTION_CONFIG.encryptComponents
): boolean {
  return ENCRYPTION_CONFIG.enabled && ENCRYPTION_CONFIG.encryptComponents[component];
}

/**
 * Log encryption operation (only in dev mode)
 */
export function logEncryption(message: string, data?: any): void {
  if (ENCRYPTION_CONFIG.dev.logEncryption) {
    console.log(`🔒 [ENCRYPTION] ${message}`, data || '');
  }
}

/**
 * Log decryption operation (only in dev mode)
 */
export function logDecryption(message: string, data?: any): void {
  if (ENCRYPTION_CONFIG.dev.logDecryption) {
    console.log(`🔓 [DECRYPTION] ${message}`, data || '');
  }
}

/**
 * Measure performance of an operation
 */
export async function measurePerformance<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  if (!ENCRYPTION_CONFIG.dev.measurePerformance) {
    return await fn();
  }

  const start = performance.now();
  const result = await fn();
  const end = performance.now();

  console.log(`⏱️ [PERFORMANCE] ${operation} took ${(end - start).toFixed(2)}ms`);

  return result;
}
