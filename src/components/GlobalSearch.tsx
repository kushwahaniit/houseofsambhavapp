import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, ShoppingCart, Users, X, ArrowRight, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '@/src/firebase';
import { cn } from '@/src/lib/utils';

interface SearchResult {
  id: string;
  type: 'product' | 'order' | 'customer';
  title: string;
  subtitle: string;
  tab: string;
}

const GlobalSearch: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        performSearch();
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const performSearch = async () => {
    setIsSearching(true);
    setIsOpen(true);
    const term = searchTerm.toLowerCase();
    const allResults: SearchResult[] = [];

    try {
      // Search Products
      const productsSnap = await getDocs(query(collection(db, 'products'), limit(100)));
      productsSnap.docs.forEach(doc => {
        const data = doc.data();
        const name = (data.name || '').toLowerCase();
        const sku = (data.sku || '').toLowerCase();
        if (name.includes(term) || sku.includes(term)) {
          allResults.push({
            id: doc.id,
            type: 'product',
            title: data.name,
            subtitle: `SKU: ${data.sku} | ${data.category}`,
            tab: 'inventory'
          });
        }
      });

      // Search Orders
      const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100)));
      ordersSnap.docs.forEach(doc => {
        const data = doc.data();
        const orderId = doc.id.toLowerCase();
        const customerName = (data.customerName || '').toLowerCase();
        if (orderId.includes(term) || customerName.includes(term)) {
          allResults.push({
            id: doc.id,
            type: 'order',
            title: `Order #${doc.id.slice(-6).toUpperCase()}`,
            subtitle: `${data.customerName} | ${data.status}`,
            tab: 'orders'
          });
        }
      });

      // Search Customers
      const customersSnap = await getDocs(query(collection(db, 'customers'), limit(100)));
      customersSnap.docs.forEach(doc => {
        const data = doc.data();
        const name = (data.name || '').toLowerCase();
        const email = (data.email || '').toLowerCase();
        if (name.includes(term) || email.includes(term)) {
          allResults.push({
            id: doc.id,
            type: 'customer',
            title: data.name,
            subtitle: data.email,
            tab: 'customers'
          });
        }
      });

      setResults(allResults.slice(0, 15)); // Show top 15 results total
    } catch (error) {
      console.error("Global search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'product': return <Package size={16} className="text-blue-500" />;
      case 'order': return <ShoppingCart size={16} className="text-amber-500" />;
      case 'customer': return <Users size={16} className="text-emerald-500" />;
      default: return <Search size={16} />;
    }
  };

  return (
    <div className="relative w-64 lg:w-80" ref={searchRef}>
      <div className="flex items-center gap-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2 transition-all focus-within:ring-2 focus-within:ring-amber-500/50">
        {isSearching ? (
          <Loader2 size={18} className="text-amber-600 animate-spin" />
        ) : (
          <Search size={18} className="text-stone-400" />
        )}
        <input 
          type="text" 
          placeholder="Search anything..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchTerm.length >= 2 && setIsOpen(true)}
          className="bg-transparent border-none outline-none text-sm w-full dark:text-stone-100"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-stone-400 hover:text-stone-600">
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
          <div className="max-h-[400px] overflow-y-auto p-2">
            {results.length > 0 ? (
              <div className="space-y-1">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => {
                      onNavigate(result.tab);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0 group-hover:bg-white dark:group-hover:bg-stone-700 transition-colors">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-stone-900 dark:text-stone-50 truncate">{result.title}</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{result.subtitle}</p>
                    </div>
                    <ArrowRight size={14} className="text-stone-300 group-hover:text-amber-600 transition-colors" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Search size={20} className="text-stone-300" />
                </div>
                <p className="text-sm font-medium text-stone-900 dark:text-stone-50">No results found</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Try searching for products, orders, or customers.</p>
              </div>
            )}
          </div>
          <div className="p-3 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-100 dark:border-stone-800 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-center">
            Global Search
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
