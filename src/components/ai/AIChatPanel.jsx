import { useState, useEffect, useRef } from 'react';
import { X, Bot, Send, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

function AIChatPanel({ isOpen, onToggle, width, onWidthChange, isFullscreen, onFullscreenToggle }) {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you with your medical records today?'
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(scrollToBottom, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!prompt.trim() || isLoading) return

    const userMessage = { role: 'user', content: prompt }
    setMessages(prev => [...prev, userMessage])
    setPrompt('')
    setIsLoading(true)

    // Simulate AI response (replace with actual AI integration)
    setTimeout(() => {
      const aiResponse = {
        role: 'assistant',
        content: `I understand you're asking about: "${prompt}". This is a simulated response. In a real implementation, this would connect to your AI service to analyze medical data and provide insights.`
      }
      setMessages(prev => [...prev, aiResponse])
      setIsLoading(false)
    }, 1000)
  }

  if (!isOpen) return null

  return (
    <div 
      className={`
        ${isFullscreen 
          ? 'fixed inset-0 z-50 bg-white' 
          : 'flex flex-col border-l border-gray-200 bg-white'
        }
      `}
      style={!isFullscreen ? { width: `${width}px` } : {}}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">AI Assistant</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onFullscreenToggle}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
            title="Close AI panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`
                max-w-[80%] p-3 rounded-lg
                ${message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
                }
              `}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <p className="text-sm text-gray-600">Thinking...</p>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask about patient data, medications, trends..."
            className="flex-1 bg-background px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          AI assistant to help analyze your medical data and answer questions.
        </p>
      </div>
    </div>
  )
}

export default AIChatPanel