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
  "summary": string (2-3 sentence summary of key findings, use up to approximately 400 characters, but shorter or a little longer is fine),
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

1. CHOOSE THE RIGHT FORMAT FOR EACH TYPE OF DATA:

   **Use STRUCTURED LISTS for:**
   - Medications/Prescriptions (drug, dose, route, frequency, indication)
   - Vision prescriptions (sphere, cylinder, axis for each eye)
   - Vital signs (BP, HR, temp, etc.)
   - Lab results with multiple values
   - Immunization details (vaccine, lot, route, site)
   - Allergies (allergen, reaction, severity)
   - Technical specifications or measurements
   
   **Use NARRATIVE for:**
   - Clinical context and reasoning
   - Patient history and symptoms
   - Physical examination findings
   - Assessment and clinical interpretation
   - Treatment plans and recommendations
   - Follow-up instructions

   **Use HYBRID (narrative intro + structured data) for:**
   - Complex procedures (narrative description, then structured details)
   - Lab results with clinical context (brief interpretation, then values)

2. FORMATTING STRUCTURED DATA:

   For medications, use this format:
   
   Medication: [Drug name]
   Dose: [Amount and unit]
   Route: [Administration method]
   Frequency: [How often]
   Indication: [Why prescribed]
   Duration: [If specified]

   For vision prescriptions, use this format:
   
   Right Eye (OD):
     Sphere (SPH): [value]
     Cylinder (CYL): [value]
     Axis: [degrees]°
     
   Left Eye (OS):
     Sphere (SPH): [value]
     Cylinder (CYL): [value]
     Axis: [degrees]°
     
   Additional: [PD, add power, prism, etc.]

   For vital signs, use this format:
   
   Blood Pressure: [value] mmHg
   Heart Rate: [value] bpm
   Temperature: [value]°F ([Celsius]°C)
   Respiratory Rate: [value] breaths/min
   O2 Saturation: [value]% [on room air/supplemental O2]

   For lab results, use this format:
   
   [Panel Name]:
     [Test]: [value] [unit] (normal: [range])
     [Test]: [value] [unit] (normal: [range])

3. ADAPT COMPLEXITY TO CONTENT:
   - Simple records (prescriptions, routine results): Brief intro + structured data
   - Medium complexity (procedures, visits): Balanced narrative and structure
   - Complex encounters (ER visits, surgeries): Detailed narrative with embedded structured sections

4. ORGANIZATION:
   
   For encounters/visits:
   - Start with narrative context (chief complaint, history)
   - Use structured format for vitals, labs, medications
   - Return to narrative for assessment, plan, follow-up
   
   For results/reports:
   - Brief narrative context (what was tested, why)
   - Structured presentation of values
   - Narrative interpretation and significance
   
   For prescriptions/orders:
   - Structured medication details
   - Brief narrative context if needed (indication, special instructions)

5. WRITING STYLE:
   - Use clear, professional language
   - Include medical terminology with plain-language explanations when helpful
   - Include normal ranges for lab values when available
   - Flag abnormal values or critical findings
   - Use consistent formatting within each structured section
   - Maintain clinical accuracy

6. COMPLETENESS:
   - Include all clinically significant information
   - Reference specific values and measurements
   - Note any uncertainties or pending results
   - Include follow-up instructions
   - Do not infer information not present in the source data

7. OMIT:
   - Administrative metadata (system IDs, database identifiers)
   - Redundant information already in basic fields
   - Technical FHIR structure details
   - Unnecessary repetition

EXAMPLES:

[Simple - Eyeglasses Prescription]
This prescription corrects myopia and astigmatism for both eyes.

Right Eye (OD):
  Sphere (SPH): -2.50
  Cylinder (CYL): -0.75
  Axis: 180°

Left Eye (OS):
  Sphere (SPH): -2.25
  Cylinder (CYL): -1.00
  Axis: 175°

Pupillary Distance (PD): 63mm

Recommended for full-time wear.

[Simple - Medication Prescription]
Medication: Lisinopril
Dose: 10mg
Route: Oral
Frequency: Once daily in the morning
Indication: Blood pressure management
Refills: 5 (90-day supply)

Take consistently at the same time each day. May cause dizziness initially. Contact provider if persistent cough develops.

[Medium - Routine Lab Results]
Routine laboratory testing was performed as part of annual health screening. All results are within normal limits and indicate good overall health.

Complete Blood Count:
  Hemoglobin: 14.2 g/dL (normal: 13.5-17.5)
  WBC: 7,200 cells/μL (normal: 4,000-11,000)
  Platelets: 245,000/μL (normal: 150,000-400,000)

Comprehensive Metabolic Panel:
  Glucose (fasting): 92 mg/dL (normal: 70-100)
  Creatinine: 0.9 mg/dL (normal: 0.6-1.2)
  ALT: 28 U/L (normal: 7-56)
  AST: 24 U/L (normal: 10-40)

Lipid Panel:
  Total Cholesterol: 185 mg/dL (normal: <200)
  LDL: 110 mg/dL (optimal: <100)
  HDL: 55 mg/dL (normal: >40)
  Triglycerides: 100 mg/dL (normal: <150)

The lipid panel shows well-controlled cholesterol levels. Continue current diet and exercise routine. No follow-up testing required at this time.

[Complex - Emergency Department Visit]
The patient presented to the emergency department with acute chest pain radiating to the left arm, accompanied by shortness of breath and diaphoresis. Symptoms began approximately 2 hours prior to arrival while at rest, with pain rated 8/10 in severity. No recent trauma, illness, or similar prior episodes were reported.

Initial Vital Signs:
  Blood Pressure: 156/94 mmHg
  Heart Rate: 102 bpm
  Respiratory Rate: 20 breaths/min
  Temperature: 98.4°F (36.9°C)
  O2 Saturation: 94% on room air

Electrocardiogram demonstrated ST-segment elevation in leads II, III, and aVF, consistent with acute inferior ST-elevation myocardial infarction (STEMI). Initial cardiac biomarkers were significantly elevated:

Cardiac Labs:
  Troponin I: 2.4 ng/mL (normal: <0.04) - CRITICAL
  CK-MB: 45 U/L (normal: <5) - ELEVATED

Immediate Treatment:
  Medication: Aspirin
  Dose: 325mg
  Route: Oral (chewed)
  
  Medication: Clopidogrel
  Dose: 600mg loading dose
  Route: Oral
  
  Medication: Nitroglycerin
  Dose: 0.4mg
  Route: Sublingual
  
The medications provided partial pain relief. The cardiology service was consulted emergently, and the patient was taken directly to the cardiac catheterization laboratory.

Cardiac Catheterization Findings:
  Culprit Vessel: Right coronary artery (RCA)
  Stenosis: 95% occlusion
  Intervention: Drug-eluting stent placement
  Result: Successful revascularization, TIMI 3 flow restored

Post-procedure, the patient was hemodynamically stable with complete resolution of chest pain. The patient was admitted to the cardiac care unit for continued monitoring.

Discharge Medications:
  1. Aspirin 81mg - Once daily, indefinitely
  2. Ticagrelor 90mg - Twice daily, minimum 12 months
  3. Atorvastatin 80mg - Once daily at bedtime
  4. Metoprolol succinate 50mg - Once daily
  5. Lisinopril 10mg - Once daily

Follow-up Plan:
- Cardiology appointment in 1 week
- Cardiac rehabilitation referral placed
- Lifestyle counseling provided: smoking cessation, dietary modifications, medication adherence
- Return to ED immediately for recurrent chest pain, shortness of breath, or other concerning symptoms

OUTPUT FORMAT:
Return the complete presentation as formatted above. Use clear section breaks, consistent indentation for structured data, and maintain professional medical documentation standards. Do not include JSON formatting, excessive markdown, or unnecessary preamble.

Generate the detailed presentation now:
  `.trim();
}
//# sourceMappingURL=prompts.js.map