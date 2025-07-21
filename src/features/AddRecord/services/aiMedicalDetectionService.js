export class AIMedicalDetectionService {
  constructor() {
    this.apiUrl = 'https://us-central1-belrose-757fe.cloudfunctions.net/detectMedicalRecord';
  }

  /**
   * Use AI to detect if a document is medical-related
   * @param {string} extractedText - The text extracted from the document
   * @param {string} fileName - The original file name
   * @param {string} fileType - The file MIME type
   * @returns {Promise<Object>} - Detection result with confidence and classification
   */
  async detectMedicalRecord(extractedText, fileName = '', fileType = '') {
    try {
      // Handle edge cases
      if (!extractedText || extractedText.trim().length < 10) {
        return {
          isMedical: false,
          confidence: 0,
          documentType: 'unknown',
          reasoning: 'Insufficient text content for analysis',
          suggestion: 'Unable to extract sufficient text for analysis'
        };
      }

      // Check for obvious medical imaging files first
      if (this.isMedicalImageFile(fileName, fileType)) {
        return {
          isMedical: true,
          confidence: 0.95,
          documentType: 'medical_imaging',
          reasoning: 'Medical imaging file format detected',
          suggestion: 'This appears to be a medical imaging file'
        };
      }

      // Call AI detection API
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentText: extractedText,
          fileName,
          fileType
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('AI Medical detection error:', error);
      
      // Fallback to basic keyword detection if AI fails
      return this.fallbackDetection(extractedText);
    }
  }

  /**
   * Check if file is a medical imaging format
   */
  isMedicalImageFile(fileName, fileType) {
    const lowerFileName = fileName.toLowerCase();
    const lowerFileType = fileType.toLowerCase();
    
    const medicalExtensions = ['.dcm', '.dicom', '.nii', '.nii.gz', '.mha', '.mhd'];
    const hasMedialExtension = medicalExtensions.some(ext => lowerFileName.endsWith(ext));
    const isMedicalMimeType = lowerFileType.includes('dicom') || lowerFileType.includes('medical');
    
    return hasMedialExtension || isMedicalMimeType;
  }

  /**
   * Fallback detection using basic keywords if AI fails
   */
  fallbackDetection(text) {
    const medicalKeywords = [
      'patient', 'diagnosis', 'medication', 'prescription', 'doctor', 'physician',
      'hospital', 'clinic', 'medical', 'treatment', 'symptoms', 'blood pressure',
      'heart rate', 'lab results', 'radiology', 'pathology', 'vital signs',
      'allergies', 'chief complaint', 'history of present illness', 'physical exam',
      'assessment', 'plan', 'icd', 'cpt', 'dosage', 'mg', 'ml', 'units',
      'temperature', 'pulse', 'respiratory', 'oxygen saturation', 'bpm', 'pain', 'heart', 
      'injury', 'surgery', 'procedure', 'follow-up', 'referral', 'consultation', 'x-ray',
      'ct scan', 'mri', 'ultrasound', 'echocardiogram', 'blood test', 'urinalysis',
      'biopsy', 'imaging', 'diagnostic', 'treatment plan', 'discharge', 'admission',
    ];

    const lowerText = text.toLowerCase();
    
    const medicalMatches = medicalKeywords.filter(keyword => 
      lowerText.includes(keyword)
    ).length;

    // Focus only on positive medical indicators
    const isMedical = medicalMatches >= 2; // Need at least 2 medical terms
    const confidence = isMedical ? Math.min(medicalMatches / 8, 0.7) : 0.1;

    return {
      isMedical,
      confidence,
      documentType: isMedical ? 'medical_record' : 'unknown',
      reasoning: `Fallback keyword-based detection (AI service unavailable) - Found ${medicalMatches} medical terms`,
      suggestion: isMedical 
        ? `Appears to be medical-related based on ${medicalMatches} medical keywords found`
        : 'No sufficient medical terminology detected'
    };
  }
}

// Export singleton instance
export const aiMedicalDetectionService = new AIMedicalDetectionService();