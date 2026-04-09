// src/features/AddRecord/services/documentProcessorService.ts

/**
 * Part of the useRecordProcessing pipeline — handles the text extraction step for uploaded files only.
 * Virtual files (typed text, direct FHIR input) bypass this entirely.
 *
 * Routes based on file type:
 * - Images (jpg, png etc.) → aiImageService (AI Vision), with Tesseract OCR as fallback
 * - Documents (PDF, Word, txt) → textExtractionService (pdf.js / mammoth / FileReader)
 *
 * Returns extracted text + basic file metadata. Everything else in the pipeline
 * (FHIR conversion, AI analysis, encryption) happens downstream in useRecordProcessing.
 */

import { aiImageService } from './aiImageService';
import TextExtractionService from './textExtractionService';
import Tesseract from 'tesseract.js';
import { ProcessingResult } from './shared.types';

export async function processDocument(file: File): Promise<ProcessingResult> {
  console.log(`Processing document: ${file.name} (${file.type})`);

  try {
    let extractedText: string | null = null;

    if (file.type.startsWith('image/')) {
      // Try AI vision first, fall back to Tesseract OCR
      try {
        const visionResult = await aiImageService.extractTextFromImage(file);
        if (visionResult.success && visionResult.text) {
          extractedText = visionResult.text;
        } else {
          throw new Error(visionResult.error || 'AI vision returned no text');
        }
      } catch (visionError: any) {
        console.warn(`⚠️ AI Vision failed, falling back to Tesseract:`, visionError.message);
        const tesseractResult = await Tesseract.recognize(file, 'eng');
        extractedText = tesseractResult.data.text || null;
      }
    } else {
      extractedText = await TextExtractionService.extractText(file);
    }

    return {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      extractedText,
      wordCount: extractedText ? extractedText.trim().split(/\s+/).length : 0,
      success: true,
      error: null,
    };
  } catch (error: any) {
    console.error(`Document processing failed for ${file.name}:`, error);
    return {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      extractedText: null,
      wordCount: 0,
      success: false,
      error: error.message,
    };
  }
}

export default { processDocument };
