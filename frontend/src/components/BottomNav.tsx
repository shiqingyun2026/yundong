import { Link, useLocation } from 'react-router-dom';
import { Home, User } from '@/src/components/icons';
import { cn } from '@/src/lib/utils';

export function BottomNav() {
  const location = useLocation();
  
  const navItems = [
    { label: '首页', icon: Home, path: '/' },
    { label: '我的', icon: User, path: '/my-group-buys' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-8 pb-8 pt-3 bg-white/80 backdrop-blur-md rounded-t-xl shadow-[0px_-12px_32px_rgba(45,47,47,0.06)] border-t border-zinc-200/15">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center transition-all duration-200",
              isActive 
                ? "text-primary font-bold scale-110" 
                : "text-on-surface-variant opacity-60 hover:opacity-100"
            )}
          >
            <Icon className={cn("w-6 h-6 mb-1", isActive && "fill-current")} />
            <span className="text-[10px] font-medium uppercase tracking-wider">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
