import React, { useState } from 'react';

// Props interface
interface ResizeHandleProps {
  onResize: (deltaX: number) => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResize }) => {
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsResizing(true);
    let lastX = e.clientX;

    const handleMouseMove = (e: MouseEvent): void => {
      const currentX = e.clientX;
      const deltaX = lastX - currentX;
      onResize(deltaX);
      lastX = currentX;
    };

    const handleMouseUp = (): void => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className={`
        w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors
        ${isResizing ? 'bg-blue-500' : ''}
      `}
      onMouseDown={handleMouseDown}
    />
  );
};

export default ResizeHandle;