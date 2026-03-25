/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  ClipboardList, 
  Users, 
  LogOut, 
  ChevronDown,
  Activity
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  to: string;
  active?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, to, active }) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-6 py-4 transition-all duration-200",
      active 
        ? "bg-[#FF6321] text-white shadow-lg shadow-[#FF6321]/20 rounded-r-xl mr-4" 
        : "text-gray-400 hover:text-white hover:bg-white/5"
    )}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </Link>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1E293B] text-white flex flex-col">
        <div className="p-6 flex items-center gap-2 mb-8">
          <div className="bg-[#FF6321] p-1.5 rounded-lg">
            <Activity size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#FF6321]">邻动体适能</h1>
        </div>

        <nav className="flex-1 space-y-1">
          <SidebarItem 
            icon={BookOpen} 
            label="课程管理" 
            to="/courses" 
            active={location.pathname.startsWith('/courses')} 
          />
          <SidebarItem 
            icon={ClipboardList} 
            label="订单管理" 
            to="/orders" 
            active={location.pathname.startsWith('/orders')} 
          />
          <SidebarItem 
            icon={Users} 
            label="账号管理" 
            to="/accounts" 
            active={location.pathname.startsWith('/accounts')} 
          />
        </nav>

        <div className="p-4 mt-auto border-t border-white/10">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-6 py-4 text-gray-400 hover:text-white w-full transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">退出登录</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-end px-8">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">Admin</p>
              <p className="text-xs text-gray-500">Super Admin</p>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-100 group-hover:border-[#FF6321] transition-colors">
              <img 
                src="https://picsum.photos/seed/admin/100/100" 
                alt="Avatar" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <ChevronDown size={16} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
