import { NavLink, useLocation } from 'react-router-dom';
import { navItems } from './Sidebar';

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-bottom">
      <div className="flex items-center overflow-x-auto overflow-y-hidden px-2 py-2 gap-2 scrollbar-hide snap-x">
        {navItems.map(item => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center min-w-[72px] h-14 rounded-xl snap-center transition-all ${
                isActive ? 'bg-slate-50' : ''
              }`}
            >
              <span className={`mb-1 ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] whitespace-nowrap px-1 ${isActive ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
      
      {/* Ensure scrollbar is hidden across browsers */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>
    </nav>
  );
}
