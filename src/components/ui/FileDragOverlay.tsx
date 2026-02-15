//src/components/ui/FileDragOverlay.tsx

/**
 * FileDragOverlay Component - Displays a visual overlay when files are being dragged over the page
 */

interface FileDragOverlayProps {
  isDragging: boolean;
  /** Custom title text. Default: "Drop files to attach" */
  title?: string;
  /** Custom subtitle text. Default: "Images, videos, PDFs, and documents supported" */
  subtitle?: string;
}

/**
 * Visual overlay that appears when files are being dragged over the page
 *
 * @example
 * const { isDragging } = useFileDrop({ onDrop: handleFiles });
 *
 * return (
 *   <>
 *     <FileDragOverlay isDragging={isDragging} />
 *     <YourContent />
 *   </>
 * );
 */
export function FileDragOverlay({
  isDragging,
  title = 'Drop files to attach',
  subtitle = 'Images, videos, PDFs, and documents supported',
}: FileDragOverlayProps) {
  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 bg-blue-500/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
      <div className="bg-white rounded-2xl shadow-2xl p-12 border-2 border-blue-500 border-dashed">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-1">{title}</h3>
            <p className="text-sm text-gray-600">{subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
