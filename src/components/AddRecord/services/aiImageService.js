export class AiImageService {
  constructor() {
    this.apiUrl = 'https://us-central1-belrose-757fe.cloudfunctions.net/analyzeImageWithAI';
  }

  /**
   * Convert file to base64 for AI Vision API
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]; // Remove data:image/jpeg;base64, prefix
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get media type for API
   */
  getMediaType(fileType) {
    const mimeTypeMap = {
      'image/jpeg': 'image/jpeg',
      'image/jpg': 'image/jpeg', 
      'image/png': 'image/png',
      'image/gif': 'image/gif',
      'image/webp': 'image/webp'
    };
    return mimeTypeMap[fileType] || 'image/jpeg';
  }

  /**
   * Analyze image with AI Vision for medical content detection and text extraction
   */
  async analyzeImage(file, analysisType = 'full') {
    try {
      const base64Image = await this.fileToBase64(file);
      const mediaType = this.getMediaType(file.type);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: {
            base64: base64Image,
            mediaType: mediaType
          },
          fileName: file.name,
          fileType: file.type,
          analysisType: analysisType // 'detection', 'extraction', 'full'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('AI Vision analysis error:', error);
      throw new Error(`Failed to analyze image: ${error.message}`);
    }
  }

  /**
   * Extract text from image using AI Vision
   */
  async extractTextFromImage(file) {
    try {
      const result = await this.analyzeImage(file, 'extraction');
      return result.extractedText || '';
    } catch (error) {
      console.error('Error extracting text with AI Vision:', error);
      // Fallback to Tesseract if AI fails
      throw error;
    }
  }

  /**
   * Detect if image contains medical content
   */
  async detectMedicalContent(file) {
    try {
      const result = await this.analyzeImage(file, 'detection');
      return {
        isMedical: result.isMedical,
        confidence: result.confidence,
        documentType: result.documentType,
        reasoning: result.reasoning,
        suggestion: result.suggestion
      };
    } catch (error) {
      console.error('Error detecting medical content:', error);
      throw error;
    }
  }

  /**
   * Full analysis: detection + text extraction + classification
   */
  async analyzeImageFull(file) {
    try {
      const result = await this.analyzeImage(file, 'full');
      return {
        // Medical detection
        isMedical: result.isMedical,
        confidence: result.confidence,
        documentType: result.documentType,
        reasoning: result.reasoning,
        suggestion: result.suggestion,
        
        // Text extraction
        extractedText: result.extractedText,
        
        // Additional insights
        medicalSpecialty: result.medicalSpecialty,
        structuredData: result.structuredData, // Any structured medical data found
        
        // Quality assessment
        imageQuality: result.imageQuality,
        readabilityScore: result.readabilityScore
      };
    } catch (error) {
      console.error('Error in full image analysis:', error);
      throw error;
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
}

// Export singleton instance
export const aiImageService = new AiImageService();