"use strict";
// functions/src/types/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_IMAGE_TYPES = exports.CloudFunctionError = void 0;
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
//types/api.types.ts
// Types shared between frontend and backend, usually representing API contract
/**
 * ============================================================================
 * IMAGE ANALYSIS API
 * ============================================================================
 */
exports.SUPPORTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
];
//# sourceMappingURL=index.types.js.map