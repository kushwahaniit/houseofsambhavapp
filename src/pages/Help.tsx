import React, { useState } from 'react';
import { 
  HelpCircle, 
  Book, 
  Shield, 
  UserCheck, 
  ShoppingCart, 
  Package,
  MessageCircle,
  ExternalLink,
  ArrowRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Help: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const sections = [
    {
      title: 'Getting Started',
      icon: Book,
      items: [
        'How to add your first product',
        'Managing your store profile',
        'Setting up staff accounts',
      ]
    },
    {
      title: 'Inventory & Sales',
      icon: Package,
      items: [
        'Bulk stock updates',
        'Category management',
        'Tracking low stock alerts',
      ]
    },
    {
      title: 'Roles & Permissions',
      icon: Shield,
      items: [
        'Super Admin vs Staff capabilities',
        'Security best practices',
        'Resetting passwords',
      ]
    }
  ];

  const helpContent: Record<string, string> = {
    'How to add your first product': 'To add a product, go to the Inventory tab and click the "Add Product" button. Fill in the details like name, category, price, and stock levels.',
    'Managing your store profile': 'Store profile settings can be accessed by Super Admins in the Settings tab. You can update the brand name, contact info, and logo.',
    'Setting up staff accounts': 'Super Admins can create staff accounts from the Settings > Users section. Staff members have limited access to orders and customers.',
    'Bulk stock updates': 'You can update stock levels individually in the Inventory tab. Bulk upload features are coming soon in the next update.',
    'Category management': 'Categories are predefined (Jewelry, Lehenga, Kurti, Suit). If you need custom categories, please contact technical support.',
    'Tracking low stock alerts': 'The Dashboard displays a "Low Stock Items" card. Items with less than 10 units in stock will trigger an alert.',
    'Generating invoices': 'Invoices are automatically generated when an order is marked as "Delivered". You can view and print them from the Orders detail view.',
    'Super Admin vs Staff capabilities': 'Super Admins have full access including Inventory management and Settings. Staff can manage Orders and Customers.',
    'Security best practices': 'Always use strong passwords and never share your login credentials. Log out of the system when using shared devices.',
    'Resetting passwords': 'If you forget your password, use the "Forgot Password" link on the Google Sign-in page to reset your Google account credentials.',
  };

  const handleContactSupport = () => {
    window.location.href = 'mailto:support@houseofsambhav.com?subject=Technical Support Request';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 max-w-3xl">
        <div className="w-12 h-12 bg-white dark:bg-stone-800 rounded-2xl flex items-center justify-center shadow-sm border border-stone-100 dark:border-stone-800 overflow-hidden shrink-0">
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
        <div>
          <h2 className="text-3xl font-serif font-bold text-stone-900 dark:text-stone-50 mb-2">Help Center</h2>
          <p className="text-stone-500 dark:text-stone-400 text-lg">Everything you need to know about managing House of Sambhav with this platform.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {sections.map((section, idx) => (
          <div key={idx} className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-amber-50 rounded-2xl text-amber-700">
                <section.icon size={24} />
              </div>
              <h3 className="text-xl font-bold text-stone-900">{section.title}</h3>
            </div>
            <ul className="space-y-4">
              {section.items.map((item, i) => (
                <li 
                  key={i} 
                  onClick={() => setSelectedItem(item)}
                  className="flex items-center justify-between group cursor-pointer"
                >
                  <span className="text-stone-600 group-hover:text-amber-700 transition-colors">{item}</span>
                  <ArrowRight size={16} className="text-stone-300 group-hover:text-amber-700 group-hover:translate-x-1 transition-all" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="bg-stone-900 text-white p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
            <MessageCircle size={32} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-1">Need technical support?</h3>
            <p className="text-stone-400">Our team is available 24/7 for critical issues.</p>
          </div>
        </div>
        <button 
          onClick={handleContactSupport}
          className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
        >
          <span>Contact Support</span>
          <ExternalLink size={18} />
        </button>
      </div>

      {/* Help Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-serif font-bold text-stone-900">{selectedItem}</h3>
                  <button 
                    onClick={() => setSelectedItem(null)}
                    className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
                  >
                    <X size={24} className="text-stone-400" />
                  </button>
                </div>
                <div className="prose prose-stone max-w-none">
                  <p className="text-stone-600 leading-relaxed text-lg">
                    {helpContent[selectedItem] || "Content for this help item is being updated. Please check back soon or contact support for immediate assistance."}
                  </p>
                </div>
                <div className="mt-10 pt-6 border-t border-stone-100 flex justify-end">
                  <button 
                    onClick={() => setSelectedItem(null)}
                    className="px-6 py-2 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Help;
