import { useState } from 'react';

function ResizeHandle({ onResize }) {
  const [isResizing, setIsResizing] = useState(false)

  const handleMouseDown = (e) => {
    e.preventDefault()
    setIsResizing(true)
    let lastX = e.clientX 

    const handleMouseMove = (e) => {
      const currentX = e.clientX
      const deltaX = lastX - currentX
      onResize(deltaX)
      lastX = currentX 
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      className={`
        w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors
        ${isResizing ? 'bg-blue-500' : ''}
      `}
      onMouseDown={handleMouseDown}
    />
  )
}

export default ResizeHandle;