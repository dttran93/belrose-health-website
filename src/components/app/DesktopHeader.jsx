import { Bot, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from '@/components/ui/Button';

function DesktopHeader({ user, onLogout, onToggleAI, isAIOpen }) {
  return (
    <header className="bg-background shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">
          Belrose Comprehensive Health Record Dashboard
        </h1>
        <div className="flex items-center space-x-4">
          <Button
            onClick={onToggleAI}
            variant="outline"
            className={`
              px-4 py-2 rounded-md text-sm flex items-center gap-2
              ${isAIOpen ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
            `}
          >
            <Bot className="w-4 h-4" />
            AI Assistant
            {isAIOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </header>
  )
}

export default DesktopHeader