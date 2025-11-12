"use strict";
// functions/src/types/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudFunctionError = void 0;
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