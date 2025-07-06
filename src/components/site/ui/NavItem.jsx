import { NavLink, useLocation } from "react-router-dom";

function NavItem({ item, isCollapsed, onClick }) {
  const location = useLocation()
  const isActive = location.pathname === item.url
  
  return (
    <NavLink
      to={item.url}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
        ${isActive 
          ? 'bg-border text-white font-medium' 
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }
        ${isCollapsed ? 'justify-center px-2' : 'justify-start'}
      `}
    >
      <item.icon className="w-5 h-5 flex-shrink-0" />
      {!isCollapsed && <span className="text-sm">{item.title}</span>}
    </NavLink>
  )
}

export default NavItem;