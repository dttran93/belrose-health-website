import { PanelLeft, ArrowLeftToLine, ArrowRightToLine } from "lucide-react";
import UserMenuButton from "@/components/ui/UserMenuButton";
import NavItem from "../site/ui/NavItem";

function DesktopSidebar({ isCollapsed, onToggle, user, onLogout, healthRecords, healthCategories, onSettings, onHelp }) {
  return (
    <div className={`
      bg-primary text-white flex flex-col 
      transition-all duration-300 h-full
      ${isCollapsed ? 'w-20' : 'w-64'}
    `}>
      {/* Header */}
      <div className="p-4">
        <div className={`flex justify-between items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          {!isCollapsed && (
            <div className="flex flex-col text-left min-w-0">
              <h2 className="font-bold text-lg">Belrose</h2>
              <p className="text-xs text-gray-400">Medical Records</p>
            </div>
          )}
        
        {/* Toggle Button */}
        <div className="p-4 relative">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center py-2 rounded-lg group relative"
          >
            <PanelLeft className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
            
            {/* Hover tooltip - positioned directly over the PanelLeft icon */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
              {isCollapsed ? (
                <ArrowRightToLine className="w-5 h-5 text-white bg-primary" />
              ) : (
                <ArrowLeftToLine className="w-5 h-5 text-white bg-primary" />
              )}
            </div>
          </button>
        </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Health Records Section */}
        <div>
          {!isCollapsed && (
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-gray-400">
              Health Records
            </h3>
          )}
          <div className="space-y-1">
            {healthRecords.map((item) => (
              <NavItem key={item.title} item={item} isCollapsed={isCollapsed} />
            ))}
          </div>
        </div>

        {/* Health Categories Section */}
        <div>
          {!isCollapsed && (
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-gray-400">
              Health Categories
            </h3>
          )}
          <div className="space-y-1">
            {healthCategories.map((item) => (
              <NavItem key={item.title} item={item} isCollapsed={isCollapsed} />
            ))}
          </div>
        </div>
      </div>

      {/* User Info & Toggle */}
      <div className="">
        <UserMenuButton 
          user={user} 
          isCollapsed={isCollapsed} 
          onLogout={onLogout}
          onSettings={onSettings}
          onHelp={onHelp}
        />
      </div>
    </div>
  )
}

export default DesktopSidebar;