"use strict";
// functions/src/utils/prompts.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFHIRConversionPrompt = getFHIRConversionPrompt;
exports.getImageAnalysisPrompt = getImageAnalysisPrompt;
exports.getBelroseFieldsPrompt = getBelroseFieldsPrompt;
exports.validatePromptLength = validatePromptLength;
exports.truncateText = truncateText;
/**
 * AI Prompts
 */
/**
 * Prompt for converting medical documents to FHIR format
 */
function getFHIRConversionPrompt(documentText) {
    return `
You are a medical data specialist. Convert the following medical document into a valid FHIR (Fast Healthcare Interoperability Resources) R4 format JSON.

Document Content:
${documentText}

Requirements:
1. Create appropriate FHIR resources (Patient, Observation, Condition, MedicationStatement, etc.)
2. Use proper FHIR resource structure and data types
3. Include all relevant medical information from the document
4. Preserve any patient identifiers, dates, and provider information found in the original document
5. Follow FHIR R4 specification
6. Return only valid JSON, no additional text

Return the result as a FHIR Bundle resource containing all relevant resources.
  `.trim();
}
/**
 * Prompts for image analysis based on analysis type
 */
function getImageAnalysisPrompt(analysisType) {
    switch (analysisType) {
        case 'detection':
            return getImageDetectionPrompt();
        case 'extraction':
            return getImageExtractionPrompt();
        case 'full':
        default:
            return getFullImageAnalysisPrompt();
    }
}
/**
 * Prompt for detecting if an image contains medical information
 */
function getImageDetectionPrompt() {
    return `
Analyze this image to determine if it contains medical information or is a medical document.

Return a JSON response with this structure:
{
  "isMedical": boolean,
  "confidence": number (0-1),
  "documentType": string (e.g., "lab report", "prescription", "medical imaging", "not medical"),
  "suggestion": string (brief description of what was detected)
}

Only return the JSON, no additional text.
  `.trim();
}
/**
 * Prompt for extracting text from an image
 */
function getImageExtractionPrompt() {
    return `
Extract ALL text content from this image. Include:
- All visible text, numbers, labels, and headers
- Preserve formatting where possible
- Include any handwritten text if legible
- Note any medical terminology, measurements, or values

Return a JSON response with this structure:
{
  "extractedText": string (all text found in the image),
  "isMedical": boolean,
  "confidence": number (0-1),
  "documentType": string,
  "suggestion": string
}

Only return the JSON, no additional text.
  `.trim();
}
/**
 * Prompt for comprehensive image analysis
 */
function getFullImageAnalysisPrompt() {
    return `
Perform a comprehensive analysis of this medical image/document.

Analyze and provide:
1. Whether this is a medical document or image
2. Type of medical document (if applicable)
3. All visible text content
4. Key medical information (diagnoses, medications, measurements, dates, etc.)
5. Overall confidence in the analysis

Return a JSON response with this structure:
{
  "isMedical": boolean,
  "confidence": number (0-1),
  "documentType": string,
  "extractedText": string,
  "keyFindings": string[],
  "suggestion": string
}

Only return the JSON, no additional text.
  `.trim();
}
/**
 * Prompt for processing BelroseFields
 */
function getBelroseFieldsPrompt(fhirData, fileName, analysis, extractedText, originalText) {
    const today = new Date().toISOString().split('T')[0];
    //extracted is extracted from file, original is submitted as plaintext or JSON
    const extractedOrOriginalText = extractedText || originalText;
    return `
Analyze this FHIR healthcare data and extract key information for display.

FHIR Data:
${JSON.stringify(fhirData, null, 2)}

${fileName ? `Document Name: ${fileName}` : ''}
${analysis ? `Previous Analysis: ${JSON.stringify(analysis)}` : ''}
${extractedOrOriginalText
        ? `The FHIR conversion above was created from extracted or original Text. 
Use both the FHIR data AND this extracted or original text to ensure you don't miss any important details: 
${extractedOrOriginalText} 

If there's information in the extracted or original text that isn't in the FHIR data, 
make sure to include it in your summary and extracted fields`
        : ''}

Extract and return ONLY a JSON object with this exact structure:
{
  "visitType": string (e.g., "Lab Results", "Doctor Visit", "Prescription", "Medical Imaging"),
  "title": string (concise title for this record),
  "summary": string (2-3 sentence summary of key findings),
  "completedDate": string (YYYY-MM-DD format, or "${today}" if not found),
  "provider": string (doctor/provider name, or "Healthcare Provider" if not found),
  "institution": string (facility name, or "Medical Center" if not found),
  "patient": string (patient name, or "Patient" if not found)
}

Rules:
- Use information from the FHIR data first
- Fall back to the previous analysis if FHIR data lacks information
- Use today's date (${today}) if no date is found
- Keep the summary concise and focused on key medical information
- Return ONLY valid JSON, no markdown formatting or additional text

Return the JSON object now:
  `.trim();
}
/**
 * Validation: Ensure prompt doesn't exceed token limits
 * This is a helper function to prevent accidentally creating prompts that are too long
 */
function validatePromptLength(prompt, maxTokens = 100000) {
    // Rough estimate: 1 token ≈ 4 characters
    const estimatedTokens = prompt.length / 4;
    if (estimatedTokens > maxTokens) {
        console.warn(`⚠️ Prompt may exceed token limit. Estimated: ${Math.round(estimatedTokens)} tokens`);
    }
}
/**
 * Helper to truncate long text while preserving important information
 * Useful when document text is too long for the API
 */
function truncateText(text, maxLength = 50000) {
    if (text.length <= maxLength) {
        return text;
    }
    const truncated = text.substring(0, maxLength);
    console.warn(`⚠️ Text truncated from ${text.length} to ${maxLength} characters`);
    return truncated + '\n\n[Text truncated due to length...]';
}
//# sourceMappingURL=prompts.js.map