// functions/src/types/index.ts

// ==================== ERROR TYPES ====================

export class CloudFunctionError extends Error {
  constructor(message: string, public code: string, public statusCode: number = 500) {
    super(message);
    this.name = 'CloudFunctionError';
  }
}

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'MISSING_DATA'
  | 'CLAUDE_API_ERROR'
  | 'PROCESSING_FAILED'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';