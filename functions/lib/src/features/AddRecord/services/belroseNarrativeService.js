"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NarrativeGenerationService = void 0;
exports.generateDetailedNarrative = generateDetailedNarrative;
exports.createNarrativeGenerationService = createNarrativeGenerationService;
const index_types_1 = require("../../../../functions/src/index.types");
// ==================== NARRATIVE GENERATION SERVICE ====================
/**
 * Service for generating detailed narratives from FHIR records
 */
class NarrativeGenerationService {
    constructor(config = {}) {
        this.config = Object.assign(Object.assign({}, index_types_1.DEFAULT_NARRATIVE_CONFIG), config);
    }
    /**
     * Main method to generate a detailed narrative
     */
    async generateNarrative(input) {
        console.log('📖 Starting detailed narrative generation...');
        // Validate input
        this.validateInput(input);
        // Call narrative generation
        const result = await this.performNarrativeGeneration(input);
        console.log('✅ Narrative generation completed successfully');
        return result;
    }
    /**
     * Call your Firebase Cloud Function for narrative generation
     */
    async performNarrativeGeneration(input) {
        console.log('🧠 Calling narrative generation service...');
        try {
            // Call your Firebase Cloud Function
            const response = await fetch(this.config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fhirData: input.fhirData,
                    belroseFields: input.belroseFields,
                    fileName: input.fileName,
                    extractedText: input.extractedText,
                    originalText: input.originalText,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Narrative API returned ${response.status}: ${errorText}`);
            }
            const result = await response.json();
            // Basic validation that we got a narrative
            if (!this.isValidResult(result)) {
                throw new Error('Narrative service returned invalid response format');
            }
            return result;
        }
        catch (error) {
            console.error('Narrative service call failed:', error);
            throw new index_types_1.NarrativeGenerationError('Narrative generation failed', error);
        }
    }
    /**
     * Basic validation of narrative result
     */
    isValidResult(result) {
        return result && typeof result === 'object' && typeof result.detailedNarrative === 'string';
    }
    /**
     * Validate input data
     */
    validateInput(input) {
        if (!input) {
            throw new index_types_1.NarrativeGenerationError('Input is required for narrative generation');
        }
        if (!input.fhirData) {
            throw new index_types_1.NarrativeGenerationError('FHIR data is required for narrative generation');
        }
        if (typeof input.fhirData !== 'object') {
            throw new index_types_1.NarrativeGenerationError('FHIR data must be a valid object');
        }
    }
}
exports.NarrativeGenerationService = NarrativeGenerationService;
// ==================== EXPORTED FUNCTIONS ====================
/**
 * Simple convenience function for generating a narrative
 */
async function generateDetailedNarrative(fhirData, options = {}) {
    const config = {};
    if (options.apiEndpoint) {
        config.apiEndpoint = options.apiEndpoint;
    }
    const service = new NarrativeGenerationService(config);
    return service.generateNarrative({
        fhirData,
        belroseFields: options.belroseFields,
        fileName: options.fileName,
        extractedText: options.extractedText,
        originalText: options.originalText,
    });
}
/**
 * Create a service instance
 */
function createNarrativeGenerationService(apiEndpoint) {
    return new NarrativeGenerationService({ apiEndpoint });
}
exports.default = NarrativeGenerationService;
//# sourceMappingURL=belroseNarrativeService.js.map