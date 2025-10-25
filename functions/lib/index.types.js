"use strict";
// functions/src/types/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudFunctionError = exports.NarrativeGenerationError = exports.DEFAULT_NARRATIVE_CONFIG = void 0;
exports.DEFAULT_NARRATIVE_CONFIG = {
    apiEndpoint: 'https://us-central1-belrose-757fe.cloudfunctions.net/createDetailedNarrative',
};
/**
 * Custom error class for narrative generation
 */
class NarrativeGenerationError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'NarrativeGenerationError';
    }
}
exports.NarrativeGenerationError = NarrativeGenerationError;
// ==================== ERROR TYPES ====================
class CloudFunctionError extends Error {
    constructor(message, code, statusCode = 500) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'CloudFunctionError';
    }
}
exports.CloudFunctionError = CloudFunctionError;
//# sourceMappingURL=index.types.js.map