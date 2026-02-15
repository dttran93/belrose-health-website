// src/hooks/useFileDrop.ts

/**
 * A custom React hook for handling file drop-and-drag interactions.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseFileDropOptions {
  onDrop: (files: File[]) => void;
  /** If true, attaches listeners to window for global drop detection. Default: true */
  global?: boolean;
}

interface UseFileDropReturn {
  isDragging: boolean;
  /** Props to spread on your drop target element (use if global: false) */
  dragHandlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

/**
 * Custom hook for handling file drag and drop
 *
 * @example
 * // Global drop zone (anywhere on page)
 * const { isDragging } = useFileDrop({
 *   onDrop: (files) => setPendingFiles(files),
 *   global: true
 * });
 *
 * @example
 * // Bounded drop zone (specific element)
 * const { isDragging, dragHandlers } = useFileDrop({
 *   onDrop: (files) => handleFiles(files),
 *   global: false
 * });
 * return <div {...dragHandlers}>Drop here</div>
 */
export function useFileDrop({ onDrop, global = true }: UseFileDropOptions): UseFileDropReturn {
  const [isDragging, setIsDragging] = useState(false);

  // Track drag enter/leave events to handle nested elements
  // Without this, dragging over child elements triggers dragLeave on parent
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: DragEvent | React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current++;

    // Only set dragging if files are being dragged
    if ('dataTransfer' in e && e.dataTransfer?.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent | React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current--;

    // Only clear dragging when we've left all nested elements
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent | React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent | React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(false);
      dragCounterRef.current = 0;

      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        onDrop(files);
      }
    },
    [onDrop]
  );

  // Global listeners (attached to window)
  useEffect(() => {
    if (!global) return;

    // Cast handlers to work with window.addEventListener
    const dragEnter = handleDragEnter as EventListener;
    const dragLeave = handleDragLeave as EventListener;
    const dragOver = handleDragOver as EventListener;
    const drop = handleDrop as EventListener;

    window.addEventListener('dragenter', dragEnter);
    window.addEventListener('dragleave', dragLeave);
    window.addEventListener('dragover', dragOver);
    window.addEventListener('drop', drop);

    return () => {
      window.removeEventListener('dragenter', dragEnter);
      window.removeEventListener('dragleave', dragLeave);
      window.removeEventListener('dragover', dragOver);
      window.removeEventListener('drop', drop);
    };
  }, [global, handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return {
    isDragging,
    dragHandlers: {
      onDragEnter: handleDragEnter as (e: React.DragEvent) => void,
      onDragLeave: handleDragLeave as (e: React.DragEvent) => void,
      onDragOver: handleDragOver as (e: React.DragEvent) => void,
      onDrop: handleDrop as (e: React.DragEvent) => void,
    },
  };
}
