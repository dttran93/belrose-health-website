"use strict";
// functions/src/utils/prompts.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFHIRConversionPrompt = getFHIRConversionPrompt;
exports.getImageAnalysisPrompt = getImageAnalysisPrompt;
exports.getBelroseFieldsPrompt = getBelroseFieldsPrompt;
exports.validatePromptLength = validatePromptLength;
exports.truncateText = truncateText;
exports.getDetailedNarrativePrompt = getDetailedNarrativePrompt;
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
  "summary": string (2-3 sentence summary of key findings, use up to approximately 500 characters, but shorter or a little longer is fine),
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
/**
 * Prompt for generating detailed narrative from FHIR data
 */
function getDetailedNarrativePrompt(fhirData, belroseFields, fileName, extractedText, originalText) {
    const extractedOrOriginalText = extractedText || originalText;
    return `
Your task is to create a detailed, human-readable narrative of this health record.

CONTENT TO SYNTHESIZE:
FHIR Data:
${JSON.stringify(fhirData, null, 2)}

${belroseFields
        ? `Basic Fields (already extracted):
      Visit Type: ${belroseFields.visitType || 'N/A'}
      Title: ${belroseFields.title || 'N/A'}
      Summary: ${belroseFields.summary || 'N/A'}
      Date: ${belroseFields.completedDate || 'N/A'}
      Provider: ${belroseFields.provider || 'N/A'}
      Institution: ${belroseFields.institution || 'N/A'}
      Patient: ${belroseFields.patient || 'N/A'}
    `
        : ''}

${fileName ? `Document Name: ${fileName}` : ''}

${extractedOrOriginalText
        ? `Additional Context (Original/Extracted Text):
${extractedOrOriginalText}

Use BOTH the FHIR data AND this text to ensure completeness. If there's information in this text that isn't in the FHIR data, make sure to include it in your narrative.`
        : ''}

GUIDELINES:

1. ADAPT TO CONTENT TYPE:
   - Simple records (prescriptions, routine labs, eyeglasses): Keep it concise (1-3 paragraphs)
   - Complex encounters (procedures, diagnoses, ER visits): Use detailed narrative with logical sections (3-6 paragraphs)
   - Use your judgment on what level of detail best serves the reader

2. ORGANIZE NATURALLY:
   - For encounters/visits, consider organizing by:
     * Reason for visit / Chief complaint
     * History and clinical findings
     * Assessment/diagnosis
     * Treatment plan and follow-up
   - For results/reports, focus on:
     * What was tested/done
     * Key findings and values
     * Clinical significance and interpretation
   - For prescriptions/orders, simply state:
     * What was prescribed/ordered
     * Dosage/specifications and instructions
     * Purpose/indication

3. WRITING STYLE:
   - Write in clear, professional prose - not bullet points or form fields
   - Be clear and concise, not overly wordy or verbose
   - Use medical terminology where appropriate, but explain complex terms in parentheses
   - Maintain clinical accuracy while being readable by patients
   - Use past tense for completed encounters ("The patient presented with...")
   - Use present tense for current states and findings ("Blood pressure is 120/80")
   - Avoid overly technical jargon unless necessary
   - Write as a coherent narrative, not a list of facts

4. COMPLETENESS AND ACCURACY:
   - Include all clinically significant information from the FHIR data
   - Reference specific values, measurements, and medications with details
   - If the original text contains important context missing from FHIR, incorporate it
   - Note any uncertainties, pending results, or unclear information
   - Include follow-up instructions and next steps if present
   - Do not infer or add any information that isn't clear from the record and information provided

5. OMIT:
   - Administrative metadata (system IDs, database identifiers)
   - Information already clearly stated in the basic fields (visitType, title, etc.)
   - Technical FHIR structure details irrelevant to the clinical story
   - Redundant statements

EXAMPLES OF DIFFERENT COMPLEXITY LEVELS:

[Simple Record - Eyeglasses Prescription]
"Eyeglasses prescription issued for correction of myopia and astigmatism. Right eye: -2.50 sphere, -0.75 cylinder at 180 degrees. Left eye: -2.25 sphere, -1.00 cylinder at 175 degrees. Pupillary distance measured at 63mm. Patient advised to use for full-time wear."

[Medium Record - Routine Lab Results]
"Routine laboratory testing was performed as part of an annual health screening. Complete blood count showed all values within normal ranges, with hemoglobin at 14.2 g/dL, white blood cell count at 7,200 cells/μL, and platelet count at 245,000/μL. Comprehensive metabolic panel revealed normal kidney and liver function. Fasting glucose was 92 mg/dL, indicating good glycemic control. Lipid panel showed total cholesterol of 185 mg/dL, LDL cholesterol of 110 mg/dL, HDL cholesterol of 55 mg/dL, and triglycerides of 100 mg/dL. All results are within normal limits and consistent with good overall health. No follow-up testing required at this time."

[Complex Record - Emergency Department Visit]
"The patient presented to the emergency department with acute chest pain radiating to the left arm, accompanied by shortness of breath and diaphoresis. Symptoms began approximately 2 hours prior to arrival while the patient was at rest, with pain rated 8 out of 10 in severity. The patient denied any recent trauma, illness, or similar prior episodes.

Initial assessment revealed blood pressure of 156/94 mmHg, heart rate of 102 beats per minute, respiratory rate of 20 breaths per minute, and oxygen saturation of 94% on room air. Electrocardiogram demonstrated ST-segment elevation in leads II, III, and aVF, consistent with acute inferior ST-elevation myocardial infarction (STEMI). Initial cardiac troponin I level was markedly elevated at 2.4 ng/mL, further confirming acute myocardial injury.

The patient was immediately given aspirin 325mg, clopidogrel 600mg loading dose, and sublingual nitroglycerin, which provided partial pain relief. The cardiology service was consulted emergently, and the patient was taken directly to the cardiac catheterization laboratory. Coronary angiography revealed 95% occlusion of the right coronary artery. Successful percutaneous coronary intervention with drug-eluting stent placement was performed to the culprit lesion.

Post-procedure, the patient was hemodynamically stable with complete resolution of chest pain. The patient was admitted to the cardiac care unit for continued monitoring and medical optimization. Medications initiated included dual antiplatelet therapy with aspirin and ticagrelor, high-intensity statin therapy with atorvastatin 80mg daily, beta-blocker with metoprolol, and ACE inhibitor with lisinopril. Cardiac rehabilitation referral was placed for outpatient follow-up. The patient was counseled on lifestyle modifications including smoking cessation, dietary changes, and the importance of medication adherence."

OUTPUT FORMAT:
Return ONLY the narrative text itself. Do not include any JSON formatting, markdown headers, or preamble. Write the narrative directly as prose that can be displayed to the user.

Generate the detailed narrative now:
  `.trim();
}
//# sourceMappingURL=prompts.js.map