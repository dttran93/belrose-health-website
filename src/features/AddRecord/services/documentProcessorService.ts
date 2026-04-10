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

      if (
        file.type === 'application/pdf' &&
        (!extractedText || extractedText.trim().split(/\s+/).length < 50)
      ) {
        console.log(
          `⚠️ PDF has little/no text (${extractedText?.length || 0} chars), attempting vision OCR...`
        );
        try {
          extractedText = await extractScannedPDF(file);
          console.log(
            `✅ Vision OCR extracted ${extractedText?.length || 0} chars from scanned PDF`
          );
        } catch (ocrError: any) {
          console.warn(`⚠️ Vision OCR fallback failed:`, ocrError.message);
          // Keep whatever pdf.js returned, even if empty
        }
      }
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

async function extractScannedPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let allText = '';
  const maxPages = 10;
  const pagesToProcess = Math.min(pdf.numPages, maxPages);

  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport, canvas }).promise;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas blob failed'))), 'image/png');
      });

      const imageFile = new File([blob], `page-${pageNum}.png`, { type: 'image/png' });
      const visionResult = await aiImageService.extractTextFromImage(imageFile);

      if (visionResult.text?.trim()) {
        allText += `\n[Page ${pageNum}]\n${visionResult.text}\n`;
      }
    } catch (pageError) {
      console.warn(`Failed to OCR page ${pageNum}:`, pageError);
    }
  }

  if (pdf.numPages > maxPages) {
    allText += `\n[Note: Only first ${maxPages} of ${pdf.numPages} pages were processed]\n`;
  }

  return allText.trim();
}

export default { processDocument };
