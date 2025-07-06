// MobileHeader.jsx
import { Menu, Bot } from "lucide-react";

function MobileHeader({ user, onMenuToggle, onLogout, onToggleAI, isAIOpen }) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-bold text-left">Belrose</h2>
            <p className="text-xs text-gray-500">Medical Records</p>
          </div>
        </div>
      </div>
      
      {/* Mobile Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleAI}
          className={`
            p-2 rounded-lg
            ${isAIOpen ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}
          `}
        >
          <Bot className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

export default MobileHeader;