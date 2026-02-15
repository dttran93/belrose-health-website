// src/features/Ai/services/contextFormatter.ts

import {
  ContextCollection,
  FileAttachmentContext,
  HealthRecordContext,
  ImageAttachmentContext,
  PastedTextContext,
  VideoAttachmentContext,
} from './contextBuilder';

/**
 * CONTEXT FORMATTER - With FileObject Support
 *
 * Formats health data for AI, optionally including metadata
 * when the AI needs to answer questions about permissions, sharing, etc.
 */

export interface FormattedContext {
  text: string;
  mediaParts: MediaPart[];
}

export interface MediaPart {
  type: 'image' | 'video';
  url: string;
  mimeType: string;
  metadata?: any;
}

export class ContextFormatter {
  /**
   * Main entry point: Formats context into a multimodal-ready object
   */
  static formatForAI(
    collection: ContextCollection,
    includeMetadata: boolean = false
  ): FormattedContext {
    console.log('🔍 ContextFormatter received:', {
      totalItems: collection.items.length,
      itemTypes: collection.items.map(i => i.type),
      images: collection.items
        .filter(i => i.type === 'image')
        .map(img => ({
          id: img.id,
          hasUrl: !!(img as any).url,
          urlPreview: (img as any).url?.substring(0, 50),
        })),
    });

    if (!collection || collection.items.length === 0) {
      return { text: '', mediaParts: [] };
    }

    const textSections: string[] = [];
    const mediaParts: MediaPart[] = [];

    // Step 1. Add a Context Manifest at the Top, essentially an inventory of attachments
    textSections.push(this.formatManifest(collection));

    // 2. Group items for collection-level formatting
    const healthRecords = collection.items.filter(
      (i): i is HealthRecordContext => i.type === 'health-record'
    );
    const files = collection.items.filter((i): i is FileAttachmentContext => i.type === 'file');
    const texts = collection.items.filter((i): i is PastedTextContext => i.type === 'pasted-text');
    const images = collection.items.filter((i): i is ImageAttachmentContext => i.type === 'image');
    const videos = collection.items.filter((i): i is VideoAttachmentContext => i.type === 'video');

    // Step 3: Format Collections
    if (healthRecords.length > 0) {
      textSections.push(this.formatHealthRecords(healthRecords, includeMetadata));
    }

    if (files.length > 0) {
      textSections.push(this.formatFileAttachments(files));
    }

    if (texts.length > 0) {
      textSections.push(this.formatPastedTexts(texts));
    }

    // 4. Format Multimodal Metadata & Populate Media Parts
    if (images.length > 0) {
      textSections.push(this.formatAllImageMetadata(images));
      images.forEach(img => {
        if (img.url) mediaParts.push({ type: 'image', url: img.url, mimeType: img.mimeType });
      });
    }

    if (videos.length > 0) {
      textSections.push(this.formatAllVideoMetadata(videos));
      videos.forEach(vid => {
        if (vid.url) mediaParts.push({ type: 'video', url: vid.url, mimeType: vid.mimeType });
      });
    }

    return {
      text: textSections.join('\n\n---\n\n'),
      mediaParts,
    };
  }

  // =======================================================================
  // Formatting Helpers
  // =======================================================================

  // =============== HEALTH RECORDS ===============

  private static formatHealthRecords(
    records: HealthRecordContext[],
    includeMetadata: boolean
  ): string {
    const lines = [
      `<HEALTH_RECORDS_COLLECTION count="${records.length}">`,
      `  <INSTRUCTION>The following are structured medical records. Use the titles for citations.</INSTRUCTION>`,
    ];

    records.forEach(record => {
      lines.push(this.formatHealthRecord(record, includeMetadata));
    });

    lines.push(`</HEALTH_RECORDS_COLLECTION>`);
    return lines.join('\n');
  }

  private static formatHealthRecord(record: HealthRecordContext, includeMetadata: boolean): string {
    const data = record.fileObject;
    const lines: string[] = [];

    console.log('Formatting record:', {
      id: record.id,
      hasBelroseFields: !!data.belroseFields,
      hasEncryptedBelroseFields: !!data.encryptedBelroseFields,
      hasFhirData: !!data.fhirData,
      hasEncryptedFhirData: !!data.encryptedFhirData,
    });

    // 1. Opening tag with ID for easy referencing
    lines.push(`<HEALTH_RECORD id="${record.id}">`);

    // 2. Belrose Summary Fields (The "Quick Look" for AI)
    if (data.belroseFields) {
      lines.push('  <SUMMARY>');
      lines.push(`    <TITLE>${data.belroseFields.title || 'Untitled'}</TITLE>`);
      lines.push(`    <VISIT_TYPE>${data.belroseFields.visitType}</VISIT_TYPE>`);
      lines.push(`    <DATE>${data.belroseFields.completedDate}</DATE>`);
      lines.push(`    <PROVIDER>${data.belroseFields.provider}</PROVIDER>`);
      lines.push(`    <INSTITUTION>${data.belroseFields.institution}</INSTITUTION>`);
      lines.push(`    <OVERVIEW>${data.belroseFields.summary}</OVERVIEW>`);
      lines.push('  </SUMMARY>');
    }

    // 3. Metadata & Permissions (Only if requested)
    if (includeMetadata) {
      lines.push('  <METADATA>');
      if (data.uploadedBy) lines.push(`    <UPLOADED_BY>${data.uploadedBy}</UPLOADED_BY>`);
      if (data.owners?.length) lines.push(`    <OWNERS>${data.owners.join(', ')}</OWNERS>`);
      if (data.viewers?.length) lines.push(`    <VIEWERS>${data.viewers.join(', ')}</VIEWERS>`);
      if (data.uploadedAt)
        lines.push(`    <UPLOADED_DATE>${data.uploadedAt.toDate().toISOString()}</UPLOADED_DATE>`);
      if (data.credibility)
        lines.push(`    <CREDIBILITY_SCORE>${data.credibility.score}/1000</CREDIBILITY_SCORE>`);
      lines.push('  </METADATA>');
    }

    // 4. Narrative / Free Text
    const narrative =
      data.belroseFields?.detailedNarrative || data.originalText || data.extractedText;
    if (narrative) {
      lines.push('  <NARRATIVE_CONTENT>');
      lines.push(narrative);
      lines.push('  </NARRATIVE_CONTENT>');
    }

    // 5. Structured FHIR Data (Crucial for clinical accuracy)
    if (data.fhirData?.entry && data.fhirData.entry.length > 0) {
      lines.push('  <STRUCTURED_FHIR_JSON>');
      lines.push(JSON.stringify(data.fhirData, null, 2));
      lines.push('  </STRUCTURED_FHIR_JSON>');
    }

    lines.push(`</HEALTH_RECORD>`);

    return lines.join('\n');
  }

  // =============== FILES ===============

  private static formatFileAttachment(file: FileAttachmentContext): string {
    return `<FILE_ATTACHMENT filename="${file.fileName}" type="${file.mimeType}">
        ${file.extractedText || 'Metadata only: Content not extractable.'}
        </FILE_ATTACHMENT>`;
  }

  private static formatFileAttachments(files: FileAttachmentContext[]): string {
    const lines = [
      `<FILE_ATTACHMENTS_COLLECTION count="${files.length}">`,
      `  <INSTRUCTION>The following are supplemental files. Use filenames for citations.</INSTRUCTION>`,
    ];

    files.forEach(file => {
      lines.push(this.formatFileAttachment(file));
    });

    lines.push(`</FILE_ATTACHMENTS_COLLECTION>`);
    return lines.join('\n');
  }

  // =============== PASTED TEXT ===============

  private static formatPastedText(text: PastedTextContext): string {
    return `<USER_PASTED_TEXT title="${text.title || 'Untitled'}">
        ${text.content}
        </USER_PASTED_TEXT>`;
  }

  /**
   * Plural Formatter for Pasted Text
   */
  private static formatPastedTexts(texts: PastedTextContext[]): string {
    const lines = [
      `<PASTED_TEXT_COLLECTION count="${texts.length}">`,
      `  <INSTRUCTION>The following blocks were pasted by the user. Treat as high-priority context.</INSTRUCTION>`,
    ];

    texts.forEach(text => {
      lines.push(this.formatPastedText(text));
    });

    lines.push(`</PASTED_TEXT_COLLECTION>`);
    return lines.join('\n');
  }

  // =============== IMAGES ===============

  private static formatImageMetadata(image: ImageAttachmentContext): string {
    return `<ATTACHED_IMAGE id="${image.id}">
        <FILENAME>${image.fileName}</FILENAME>
        <DESCRIPTION>${image.visualDescription || 'No description provided'}</DESCRIPTION>
        <OCR_TEXT>${image.extractedText || 'None'}</OCR_TEXT>
        <NOTE>Refer to the attached visual media part for this image.</NOTE>
        </ATTACHED_IMAGE>`;
  }

  private static formatAllImageMetadata(images: ImageAttachmentContext[]): string {
    const lines = [`<IMAGE_CONTEXT_COLLECTION count="${images.length}">`];
    images.forEach(img => lines.push(this.formatImageMetadata(img)));
    lines.push(`</IMAGE_CONTEXT_COLLECTION>`);
    return lines.join('\n');
  }

  // =============== VIDEO ===============

  private static formatVideoMetadata(video: VideoAttachmentContext): string {
    return `<ATTACHED_VIDEO id="${video.id}">
        <DURATION>${video.duration}s</DURATION>
        <FPS>${video.fps || 'unknown'}</FPS>
        <HAS_AUDIO>${video.hasAudio}</HAS_AUDIO>
        <NOTE>Refer to the attached visual media part for this video.</NOTE>
        </ATTACHED_VIDEO>`;
  }

  private static formatAllVideoMetadata(videos: VideoAttachmentContext[]): string {
    const lines = [`<VIDEO_CONTEXT_COLLECTION count="${videos.length}">`];
    videos.forEach(vid => lines.push(this.formatVideoMetadata(vid)));
    lines.push(`</VIDEO_CONTEXT_COLLECTION>`);
    return lines.join('\n');
  }

  // =============== CONTEXT MANIFEST ===============

  private static formatManifest(collection: ContextCollection): string {
    return `[CONTEXT_MANIFEST]
        Total Items: ${collection.totalItems}
        Last Updated: ${collection.lastUpdated.toDate().toISOString()}
        Breakdown: ${this.formatSummary(collection)}
        [/CONTEXT_MANIFEST]`;
  }
  static formatSummary(collection: ContextCollection): string {
    if (!collection || collection.items.length === 0) {
      return 'No context';
    }

    // 1. Map internal types to user-friendly labels
    const typeLabels: Record<string, string> = {
      'health-record': 'record',
      file: 'file',
      'pasted-text': 'text',
      image: 'image',
      video: 'video',
    };

    // 2. Count occurrences of each type
    const counts = collection.items.reduce(
      (acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // 3. Build the phrase parts (e.g., ["3 records", "1 image"])
    const parts = Object.entries(counts).map(([type, count]) => {
      // Use a fallback string immediately so the result is ALWAYS a string
      const label = typeLabels[type] ?? 'item';
      return `${count} ${label}${count > 1 ? 's' : ''}`;
    });
    // No .filter needed now because every map iteration returns a valid string

    // 4. Join with Oxford Comma logic
    if (parts.length === 0) return 'No context';

    // Explicitly grabbed these to satisfy typescript strictness
    const firstPart = parts[0] ?? '';
    if (parts.length === 1) return firstPart;

    const secondPart = parts[1] ?? '';
    if (parts.length === 2) return `${firstPart} and ${secondPart}`;

    const lastPart = parts[parts.length - 1] ?? '';
    return `${parts.slice(0, -1).join(', ')}, and ${lastPart}`;
  }
}
