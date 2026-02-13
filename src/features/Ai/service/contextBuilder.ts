// src/features/Ai/services/contextBuilder.ts

/**
 * CONTEXT BUILDER
 *
 * Builder pattern for creating ContextCollections.
 * Three categories of context to build:
 *
 * 1. Belrose Health Records
 * 2. File Attachments (any format of non-image file doc/pdf etc.)
 * 3. Pasted Text (large chunk of pasted text, similar to how Claude looks)
 * 4. Video Attachment
 * 5. Image Attachment
 */

import { Timestamp } from 'firebase/firestore';
import { FileObject } from '@/types/core';

//===========================================================================
// TYPES
//===========================================================================

export interface BaseContextItem {
  id: string;
  type: 'health-record' | 'file' | 'pasted-text' | 'video' | 'image';
  addedAt: Timestamp;
}

export interface HealthRecordContext extends BaseContextItem {
  type: 'health-record';
  fileObject: FileObject;
}

export interface FileAttachmentContext extends BaseContextItem {
  type: 'file';
  fileName: string;
  mimeType: string;
  size: number;
  url?: string;
  extractedText?: string;
  pageCount?: number;
  hasOcr?: boolean;
}

export interface PastedTextContext extends BaseContextItem {
  type: 'pasted-text';
  title?: string;
  content: string;
}

export interface VideoAttachmentContext extends BaseContextItem {
  type: 'video';
  url?: string;
  duration: number;
  mimeType: string;
  hasAudio?: boolean;
  fps?: number;
}

export interface ImageAttachmentContext extends BaseContextItem {
  type: 'image';
  fileName: string;
  mimeType: string;
  size: number;
  url?: string;
  extractedText?: string;
  dimensions?: { width: number; height: number };
  visualDescription?: string;
  detailLevel?: 'low' | 'medium' | 'high';
}

export type ContextItem =
  | HealthRecordContext
  | FileAttachmentContext
  | PastedTextContext
  | VideoAttachmentContext
  | ImageAttachmentContext;

export interface ContextCollection {
  items: ContextItem[];
  totalItems: number;
  lastUpdated: Timestamp;
}

//===========================================================================
// BUILDER
//===========================================================================

export class ContextBuilder {
  private items: ContextItem[] = [];

  /**
   * Add a health record to the context
   */
  addHealthRecord(record: FileObject): this {
    this.items.push({
      id: `record-${record.id}`,
      type: 'health-record',
      fileObject: record,
      addedAt: Timestamp.now(),
    });
    return this;
  }

  /**
   * Add multiple health records at once
   */
  addHealthRecords(records: FileObject[]): this {
    records.forEach(r => this.addHealthRecord(r));
    return this;
  }

  /**
   * Add a file attachment
   */
  addFileAttachment(
    fileName: string,
    options: {
      mimeType?: string;
      size?: number;
      url?: string;
      extractedText?: string;
      pageCount?: number;
      hasOcr?: boolean;
    }
  ): this {
    this.items.push({
      id: `file-${crypto.randomUUID()}`,
      type: 'file',
      fileName,
      mimeType: options.mimeType ?? 'application/octet-stream',
      size: options.size ?? 0,
      ...options,
      addedAt: Timestamp.now(),
    });
    return this;
  }

  /**
   * Add pasted text
   */
  addPastedText(content: string, title?: string): this {
    this.items.push({
      id: `text-${crypto.randomUUID()}`,
      type: 'pasted-text',
      title,
      content,
      addedAt: Timestamp.now(),
    });
    return this;
  }

  addVideoAttachment(
    url: string,
    duration: number,
    options: {
      mimeType?: string;
      hasAudio?: boolean;
      fps?: number;
    }
  ): this {
    this.items.push({
      id: `video-${crypto.randomUUID()}`,
      type: 'video',
      url,
      duration,
      mimeType: options.mimeType ?? 'video/mp4',
      ...options,
      addedAt: Timestamp.now(),
    });
    return this;
  }

  /**
   * Add an image attachment
   */
  addImageAttachment(
    fileName: string,
    options: {
      mimeType?: string;
      size?: number;
      url?: string;
      extractedText?: string;
      dimensions?: { width: number; height: number };
      visualDescription?: string;
      detailLevel?: 'low' | 'medium' | 'high';
    }
  ): this {
    this.items.push({
      id: `image-${crypto.randomUUID()}`,
      type: 'image',
      fileName,
      mimeType: options.mimeType ?? 'image/jpeg',
      size: options.size ?? 0,
      detailLevel: options.detailLevel ?? 'medium',
      ...options,
      addedAt: Timestamp.now(),
    });
    return this;
  }

  /**
   * Add an existing context item
   */
  addItem(item: ContextItem): this {
    this.items.push(item);
    return this;
  }

  /**
   * Add multiple existing items
   */
  addItems(items: ContextItem[]): this {
    this.items.push(...items);
    return this;
  }

  /**
   * Build the final ContextCollection
   */
  build(): ContextCollection {
    return {
      items: this.items,
      totalItems: this.items.length,
      lastUpdated: Timestamp.now(),
    };
  }

  /**
   * Get the current items (without building)
   */
  getItems(): ContextItem[] {
    return [...this.items];
  }

  /**
   * Clear all items
   */
  clear(): this {
    this.items = [];
    return this;
  }
}
