import React, { useState, useEffect, useRef } from 'react';
import { Bell, Package, ShoppingCart, AlertTriangle, CheckCircle, X, ArrowRight, Clock } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/src/firebase';
import { cn } from '@/src/lib/utils';

interface Notification {
  id: string;
  type: 'low_stock' | 'new_order' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
  link?: string;
}

const NotificationCenter: React.FC<{ onNavigate: (tab: string) => void; userRole: string }> = ({ onNavigate, userRole }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = userRole === 'super_admin';

  useEffect(() => {
    const savedReadIds = localStorage.getItem('readNotifications');
    if (savedReadIds) {
      try {
        setReadIds(new Set(JSON.parse(savedReadIds)));
      } catch (e) {
        console.error('Error parsing read notifications', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('readNotifications', JSON.stringify(Array.from(readIds)));
  }, [readIds]);

  useEffect(() => {
    // 1. Listen for Low Stock Products
    const stockQuery = query(collection(db, 'products'), where('stock', '<', 5));
    const unsubscribeStock = onSnapshot(stockQuery, (snapshot) => {
      const lowStockNotifications: Notification[] = snapshot.docs.map(doc => ({
        id: `stock-${doc.id}-${doc.data().stock}`, 
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${doc.data().name} is running low (${doc.data().stock} left)`,
        time: 'Just now',
        read: false,
        link: 'inventory'
      }));
      
      setNotifications(prev => {
        const others = prev.filter(n => n.type !== 'low_stock');
        return [...lowStockNotifications, ...others].slice(0, 15);
      });
    });

    // 2. Listen for Recent Orders
    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const newOrderNotifications: Notification[] = snapshot.docs.map(doc => ({
        id: `order-${doc.id}`,
        type: 'new_order',
        title: 'New Order Received',
        message: `Order #${doc.id.slice(-6).toUpperCase()} from ${doc.data().customerName}`,
        time: 'Recent',
        read: false,
        link: 'orders'
      }));

      setNotifications(prev => {
        const others = prev.filter(n => n.type !== 'new_order');
        return [...newOrderNotifications, ...others].slice(0, 15);
      });
    });

    return () => {
      unsubscribeStock();
      unsubscribeOrders();
    };
  }, []);

  const displayNotifications = notifications.map(n => ({
    ...n,
    read: readIds.has(n.id)
  }));

  const unreadCount = displayNotifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setReadIds(prev => new Set(prev).add(id));
  };

  const clearAll = () => {
    const allIds = notifications.map(n => n.id);
    setReadIds(prev => {
      const next = new Set(prev);
      allIds.forEach(id => next.add(id));
      return next;
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return <AlertTriangle size={16} className="text-rose-500" />;
      case 'new_order': return <ShoppingCart size={16} className="text-amber-500" />;
      default: return <Bell size={16} className="text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors relative"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-600 rounded-full border-2 border-white dark:border-stone-900 animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
          <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-800/50">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-stone-900 dark:text-stone-50">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-black">
                  {unreadCount} New
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button 
                  onClick={clearAll}
                  className="text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-widest hover:underline"
                >
                  Clear All
                </button>
              )}
              <button 
                onClick={() => setIsOpen(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {displayNotifications.length > 0 ? (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {displayNotifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      markAsRead(n.id);
                      if (n.link) onNavigate(n.link);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-start gap-4 p-4 transition-colors text-left group relative",
                      n.read ? "opacity-60 grayscale-[0.5]" : "bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800"
                    )}
                  >
                    {!n.read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-600" />
                    )}
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      n.type === 'low_stock' ? "bg-rose-50 dark:bg-rose-900/20" : "bg-amber-50 dark:bg-amber-900/20"
                    )}>
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={cn("text-sm truncate", n.read ? "font-medium text-stone-500" : "font-bold text-stone-900 dark:text-stone-50")}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-stone-400 flex items-center gap-1">
                          <Clock size={10} />
                          {n.time}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">{n.message}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell size={24} className="text-stone-300" />
                </div>
                <p className="text-sm font-bold text-stone-900 dark:text-stone-50">All caught up!</p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">No new notifications at the moment.</p>
              </div>
            )}
          </div>

          <button 
            onClick={() => {
              onNavigate(isSuperAdmin ? 'dashboard' : 'inventory');
              setIsOpen(false);
            }}
            className="w-full p-4 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-100 dark:border-stone-800 text-[11px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-widest hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
          >
            {isSuperAdmin ? 'Go to Dashboard Overview' : 'View Inventory Stock'}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
