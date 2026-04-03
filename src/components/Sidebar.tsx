import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings, 
  Menu, 
  X,
  LogOut,
  Bell,
  Search,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { auth } from '@/src/firebase';
import { signOut } from 'firebase/auth';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  userRole: string;
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, setIsOpen, userRole, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'store_manager', 'staff'] },
    { id: 'inventory', label: 'Inventory', icon: Package, roles: ['super_admin', 'store_manager', 'staff'] },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, roles: ['super_admin', 'store_manager', 'staff'] },
    { id: 'customers', label: 'Customers', icon: Users, roles: ['super_admin', 'store_manager', 'staff'] },
    { id: 'help', label: 'Help Center', icon: HelpCircle, roles: ['super_admin', 'store_manager', 'staff'] },
    { id: 'settings', label: 'Accounts', icon: Settings, roles: ['super_admin'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(userRole));

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-[280px] bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 z-50 transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:block",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white dark:bg-stone-800 rounded-xl flex items-center justify-center shadow-sm border border-stone-100 dark:border-stone-700 overflow-hidden">
                <img 
                  src="/logo.png" 
                  alt="House of Sambhav Logo" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://picsum.photos/seed/houseofsambhav/200/200";
                  }}
                />
              </div>
              <h1 className="hidden lg:block text-xl font-serif font-bold text-stone-900 dark:text-stone-50 leading-tight">
                House of <br />
                <span className="text-amber-700 dark:text-amber-500">Sambhav</span>
              </h1>
            </div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 text-stone-500 dark:text-stone-400">
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 1024) setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                  activeTab === item.id 
                    ? "bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 font-medium" 
                    : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100"
                )}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
                {activeTab === item.id && (
                  <motion.div 
                    layoutId="active-pill"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-700 dark:bg-amber-500"
                  />
                )}
              </button>
            ))}
          </nav>

          <div className="pt-6 border-t border-stone-100 dark:border-stone-800">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-stone-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
