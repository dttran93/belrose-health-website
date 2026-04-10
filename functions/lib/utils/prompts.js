"use strict";
// functions/src/utils/prompts.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFHIRConversionPrompt = getFHIRConversionPrompt;
exports.getImageAnalysisPrompt = getImageAnalysisPrompt;
exports.getBelroseFieldsPrompt = getBelroseFieldsPrompt;
exports.getRefinementAnalyzePrompt = getRefinementAnalyzePrompt;
exports.getRefinementRefinePrompt = getRefinementRefinePrompt;
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
4. Follow FHIR R4 specification
5. Return only valid JSON, no additional text
6. PATIENT PRIVACY:
   - All FHIR resources that reference the patient should use subject/patient references 
     (e.g. "subject": {"reference": "Patient/patient-1"}) — this is correct FHIR structure
   - The Patient resource MAY contain: name, DOB, gender, identifier
   - All other resources MUST NOT contain: patient name, home address, social security 
     number, phone number, email, or any other directly identifying information in 
     free-text fields (text.div, note, comment, description fields etc.)
   - Use "the patient" in any narrative text instead of the patient's name
   - Provider names in Practitioner resources are acceptable

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
function getBelroseFieldsPrompt(fhirData, fileName, extractedText, originalText, contextText) {
    //extracted is extracted from file, original is submitted as plaintext or JSON
    const extractedOrOriginalText = extractedText || originalText;
    return `
You are analyzing health data. Your task is to extract the key information and generate a human readable, comprehensive narrative.

${fileName ? `Document Name: ${fileName}` : ''}
${extractedOrOriginalText
        ? `PRIMARY SOURCE - the Original Document/Text: ${extractedOrOriginalText}`
        : ''}
${contextText ? `UPLOADER CONTEXT - Additional notes provided by the uploader: ${contextText}` : ''}

SUPPLEMENTARY — Structured FHIR Data (use for coded values, standard identifiers):
${JSON.stringify(fhirData, null, 2)}

Extract and return ONLY a JSON object with this exact structure:
{
  "visitType": string (e.g., "Lab Results", "Doctor Visit", "Prescription", "Medical Imaging"),
  "title": string (concise title for this record),
  "summary": string (2-3 sentence summary of key findings, use up to approximately 400 characters, but shorter or a little longer is fine),
  "completedDate": string ("No Date" if not found),
  "provider": string (doctor/provider name, or "Healthcare Provider" if not found),
  "institution": string (facility name, or "Medical Center" if not found),
  "patient": string (patient name, or "Patient" if not found),
  "detailedNarrative": string (comprehensive human-readable narrative of the full record — see formatting rules below)
}

Rules:
- Use information from the extracted text or original text and context text, use FHIR data for structured values like codes and dates
- Keep the summary concise and focused on key medical information
- Return ONLY valid JSON, no additional text. Include markdown formatting only in the detailedNarrative if at all 
- DO NOT include identifying information like name or home address in any field. Except for the patient's name in the patient field
- When necessary refer to the patient as "the patient" or "the subject"

detailedNarrative formatting rules:
- Use STRUCTURED LISTS for: medications (drug/dose/route/frequency/indication), vitals, lab results, allergies, immunizations
- Use NARRATIVE PROSE for: clinical context, symptoms, physical exam findings, assessment, treatment plans, follow-up
- Use HYBRID (narrative intro + structured data) for: complex procedures, lab results with clinical context
- For medications use format: "Medication: [name] | Dose: [amount] | Route: [method] | Frequency: [how often] | Indication: [why]"
- Be comprehensive — include all clinically significant information from the record
- DO NOT hallucinate or infer any information not present in the source data
- DO NOT include identifying information anywhere except the patient section. When necessary refer to "the patient" or "the subject" or similar terms. `.trim();
}
function getRefinementAnalyzePrompt(input) {
    const { fhirData, belroseFields, extractedText, originalText, contextText, isSubjectSelf, hasSubjects, reviewStatus, } = input;
    const primaryText = extractedText || originalText;
    const subjectPronoun = isSubjectSelf ? 'the user' : 'the patient';
    const reviewSummary = reviewStatus ? buildReviewSummary(reviewStatus) : 'Review Status Missing';
    return `
You are a medical data quality specialist reviewing a health record on behalf of Belrose Health.
Belrose standardizes health records for future use by researchers, insurers, and clinicians.
Your job is to make this record as complete, accurate, and buyer-ready as possible.

Review the record across four categories and generate targeted questions where needed.

${primaryText
        ? `PRIMARY SOURCE — Original document text:
${primaryText}`
        : ''}

${contextText
        ? `UPLOADER CONTEXT — Notes provided by the uploader:
${contextText}`
        : ''}

STRUCTURED DATA — Belrose Fields:
${JSON.stringify(belroseFields, null, 2)}

STRUCTURED DATA — FHIR Bundle:
${JSON.stringify(fhirData, null, 2)}

SUBJECT: This record is about ${subjectPronoun}. Address questions using 
${isSubjectSelf ? '"you"' : '"the patient"'}.

CURRENT REVIEW STATUS:
${reviewSummary}

════════════════════════════════════════
REVIEW CATEGORIES
════════════════════════════════════════

1. CONTRADICTIONS AND GAPS
   - Compare the original text document text against FHIR, Belrose Fields, and Subject data
   - Flag obvious contradictions (e.g. different provider names, different subject names, conflicting dates)
   - Flag resolvable gaps where the answer could be inferred from context (e.g. in the original data, but not in the FHIR data)
   - Do NOT flag fields that are simply unknown with no way to resolve them
   - field: 'fhir' or 'belroseFields' depending on what needs correcting

2. PII OUTSIDE PATIENT RESOURCE
   - Scan all FHIR resources OTHER than the Patient resource and belroseFields OTHER than belroseFields.patient
    for names, dates of birth, addresses, NHS/insurance numbers, or other identifying information
   - If found, ask the user to confirm whether it is clinically necessary or can be removed
   - Be specific about where you found it (e.g. "Found in Encounter.text on [date]")
   - field: 'fhir' or 'belroseFields'

3. RECORD SPLITTING
   - Check if the FHIR Bundle contains multiple FHIR resources, (Encounter, Observation, 
    EpisodeOfCare, AdverseEvent, Condition etc.) with significantly different dates (many weeks/months apart)
   - If so, suggest splitting into separate records — one per encounter period
   - type: 'confirm', field: 'split'

4. METADATA NUDGES (always include if applicable)
    - SUBJECTS: If hasSubjects is ${hasSubjects ?? false} (false means no subject 
      has been linked), ask the user to confirm they want to link a subject:
      question: "No subject has been linked to this record. Would you like to add one? 
      The subject is the Belrose platform's ultimate indicator of who the record is about."
    - type: 'confirm', field: 'metadata'
      Only include this question if hasSubjects is false.

   - CREDIBILITY REVIEW: isSubjectSelf is ${isSubjectSelf}. Only show this nudge 
     if isSubjectSelf is false (i.e. the user is not the subject of the record — they
     are a provider or third party who can objectively assess it). Use the review status
     to determine the right nudge:
     
     * No review at all → 
        "You have not recorded your official review of this record. Determining the 
        credibility of data is vital for future healthcare providers and users of this 
        data. If possible, please provide a verification or dispute for the record."
     
     * Has stale verification → 
        "Your verification was made against an older version of this record. 
        Would you like to review it to reflect the current content?"
     
     * Has stale dispute → 
        "Your dispute was raised against an older version of this record. 
        Would you like to review whether it still applies?"
     
      * Has stale reaction → 
        "Your reaction was to a dispute against an older version of this record. 
        Would you like to review whether it still applies?"
        
     * Has active current review (verificationIsCurrentHash or disputeIsCurrentHash 
        or reactionIsCurrentHash is true) → do not show this nudge
     
     type: 'confirm', field: 'metadata'

════════════════════════════════════════
OUTPUT RULES
════════════════════════════════════════
- Generate a unique id for each question: "q1", "q2" etc.
- For 'choice' questions always include "Other / I'm not sure" as the last option
- Questions from categories 1-3 are data quality questions — only include if you found 
  a genuine issue. Questions from category 4 are always included if applicable.
- Return ONLY a JSON object, no markdown:

{
  "status": "needs_clarification" | "complete",
  "questions": [
    {
      "id": string,
      "type": "choice" | "text" | "confirm",
      "field": "fhir" | "belroseFields" | "split" | "metadata",
      "question": string,
      "options": string[] | undefined,
      "context": string | undefined
    }
  ],
  "updatedFhirData": null,
  "updatedBelroseFields": null
}

Return status 'complete' if the only questions are metadata nudges and there are no 
data quality issues. The UI handles metadata questions separately.
Return status 'needs_clarification' if there are any category 1, 2, or 3 questions.
Always return null for updatedFhirData and updatedBelroseFields on this turn.
  `.trim();
}
function getRefinementRefinePrompt(input) {
    const { fhirData, belroseFields, extractedText, originalText, contextText, isSubjectSelf } = input;
    const primaryText = extractedText || originalText;
    const subjectPronoun = isSubjectSelf ? 'the user' : 'the patient';
    return `
You are a medical data quality specialist. You previously reviewed a health record and asked 
the uploader some clarifying questions. They have now answered your questions.

Your job is to apply their answers to produce corrected versions of the structured data.
Only change fields that are directly affected by the answers — do not alter anything else.

${primaryText
        ? `PRIMARY SOURCE — Original document text:
${primaryText}`
        : ''}

${contextText
        ? `UPLOADER CONTEXT — Notes provided by the uploader:
${contextText}`
        : ''}

CURRENT Belrose Fields:
${JSON.stringify(belroseFields, null, 2)}

CURRENT FHIR Bundle:
${JSON.stringify(fhirData, null, 2)}

SUBJECT: This record is about ${subjectPronoun}.

The conversation history and the uploader's answers will follow. Once you have read them,
return the corrected record data.

Return ONLY a JSON object with this exact structure:
{
  "status": "complete",
  "questions": [],
  "updatedFhirData": { ...complete corrected FHIR bundle... },
  "updatedBelroseFields": { ...complete corrected belrose fields... }
}

RULES:
- Always return the COMPLETE fhirData and belroseFields objects, not just the changed fields
- Only change what the answers specifically address
- Do NOT hallucinate or infer beyond what the answers explicitly state
- Return ONLY valid JSON, no markdown
  `.trim();
}
// ── Helper ────────────────────────────────────────────────────────────────────
/**
 * Converts RecordReviewStatus into a readable summary string for the prompt.
 * Keeps the raw object out of the prompt — structured objects can confuse
 * the AI when mixed with natural language instructions.
 */
function buildReviewSummary(reviewStatus) {
    const lines = [];
    if (!reviewStatus.hasAnyActiveReview) {
        lines.push('- No credibility review (verification, dispute, or reaction) has been recorded.');
    }
    else {
        if (reviewStatus.hasVerification) {
            const staleness = reviewStatus.verificationIsCurrentHash
                ? '(current hash ✓)'
                : '(stale — against an older version ⚠️)';
            lines.push(`- Has active verification ${staleness}, level: ${reviewStatus.verificationLevel}`);
        }
        if (reviewStatus.hasDispute) {
            const staleness = reviewStatus.disputeIsCurrentHash
                ? '(current hash ✓)'
                : '(stale — against an older version ⚠️)';
            lines.push(`- Has active dispute ${staleness}, severity: ${reviewStatus.disputeSeverity}`);
        }
        if (reviewStatus.hasReaction) {
            const staleness = reviewStatus.reactionIsCurrentHash
                ? '(current hash ✓)'
                : '(stale — against an older version ⚠️)';
            const type = reviewStatus.reactionSupportsDispute ? 'supports' : 'opposes';
            lines.push(`- Has active reaction to a dispute ${staleness}, ${type} the dispute`);
        }
    }
    if (reviewStatus.hasStaleReview) {
        lines.push('- ⚠️ At least one credibility review is stale (made against an older version).');
    }
    if (reviewStatus.currentHashReviewed) {
        lines.push('- ✓ At least one active credibility review applies to the current record version.');
    }
    return lines.join('\n');
}
//# sourceMappingURL=prompts.js.map