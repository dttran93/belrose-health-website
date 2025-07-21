import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import Tesseract from 'tesseract.js';
import mammoth from 'mammoth';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Extract text from PDF files using PDF.js
 * @param {File} file - PDF file to extract text from
 * @returns {Promise<string>} Extracted text content
 */
async function extractPdfText(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + ' ';
    }

    return fullText.trim();
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Extract text from Word documents using mammoth
 * @param {File} file - Word document file
 * @returns {Promise<string>} Extracted text content
 */
async function extractWordText(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('Word document text extraction failed:', error);
    throw new Error(`Failed to extract text from Word document: ${error.message}`);
  }
}

/**
 * Extract text from plain text files
 * @param {File} file - Text file
 * @returns {Promise<string>} File content as text
 */
async function extractPlainText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (error) => {
      console.error('Plain text extraction failed:', error);
      reject(new Error(`Failed to read text file: ${error.message}`));
    };
    reader.readAsText(file);
  });
}

/**
 * OCR text extraction using Tesseract (fallback for images)
 * @param {File} file - Image file
 * @returns {Promise<string>} Extracted text from image
 */
async function extractImageTextOCR(file) {
  try {
    console.log('Using Tesseract OCR for image text extraction...');
    const tesseractResult = await Tesseract.recognize(file, 'eng', {
      logger: m => console.log('Tesseract:', m)
    });
    return tesseractResult.data.text;
  } catch (error) {
    console.error('Tesseract OCR failed:', error);
    throw new Error(`OCR text extraction failed: ${error.message}`);
  }
}

/**
 * Main text extraction method that routes to appropriate extraction function
 * @param {File} file - File to extract text from
 * @returns {Promise<string>} Extracted text content
 */
async function extractText(file) {
  try {
    switch (true) {
      case file.type === 'application/pdf':
        return await extractPdfText(file);

      case file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case file.type === 'application/msword':
        return await extractWordText(file);

      case file.type.startsWith('text/'):
        return await extractPlainText(file);

      case file.type.startsWith('image/'):
        return await extractImageTextOCR(file);

      default:
        throw new Error(`Unsupported file type: ${file.type}`);
    }
  } catch (error) {
    console.error(`Error extracting text from ${file.name}:`, error);
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Check if a file type is supported for text extraction
 * @param {string} fileType - MIME type of the file
 * @returns {boolean} Whether the file type is supported
 */
function isSupported(fileType) {
  const supportedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/csv',
    'text/tab-separated-values'
  ];

  return supportedTypes.includes(fileType) || 
         fileType.startsWith('text/') || 
         fileType.startsWith('image/');
}

/**
 * Get estimated processing time for different file types
 * @param {File} file - File to estimate processing time for
 * @returns {string} Estimated processing time description
 */
function getEstimatedProcessingTime(file) {
  if (file.type.startsWith('image/')) {
    return 'OCR processing may take 10-30 seconds';
  } else if (file.type === 'application/pdf' && file.size > 5 * 1024 * 1024) {
    return 'Large PDF processing may take 5-15 seconds';
  } else {
    return 'Processing typically takes 1-5 seconds';
  }
}

// Create a service object for cleaner usage
const TextExtractionService = {
  extractText,
  extractPdfText,
  extractWordText, 
  extractPlainText,
  extractImageTextOCR,
  isSupported,
  getEstimatedProcessingTime
};

// Export main function as default, others as named exports
export default TextExtractionService;

export {
  extractPdfText,
  extractWordText,
  extractPlainText,
  extractImageTextOCR,
  isSupported,
  getEstimatedProcessingTime
};