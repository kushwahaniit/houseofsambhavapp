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
import logo from '../assets/logo.png';

const Help: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const sections = [
    {
      title: 'Getting Started',
      icon: Book,
      items: [
        'How to login and account selection',
        'Navigating the Dashboard',
        'Understanding User Roles',
      ]
    },
    {
      title: 'Inventory Management',
      icon: Package,
      items: [
        'Adding and editing products',
        'Bulk upload using CSV',
        'SKU generation and stock alerts',
      ]
    },
    {
      title: 'Order Management',
      icon: ShoppingCart,
      items: [
        'Creating a new order',
        'Applying discounts',
        'Shiprocket integration and tracking',
        'Cancelling and returning stock',
      ]
    },
    {
      title: 'Security & Settings',
      icon: Shield,
      items: [
        'Two-Factor Authentication (2FA)',
        'Managing staff permissions',
        'Dark mode and UI preferences',
      ]
    }
  ];

  const helpContent: Record<string, string> = {
    'How to login and account selection': 'When you launch the app, you will be prompted to sign in with Google. We have disabled automatic login to ensure you can always "select_account" if you have multiple Google accounts. Your session will persist only for the duration of your browser session for enhanced security. Note: Only pre-authorized accounts can log in.',
    'Navigating the Dashboard': 'The Dashboard provides a high-level overview of your business. You can see total sales, order counts, and inventory status. Note: The Dashboard is restricted to Super Admins only.',
    'Understanding User Roles': 'The app uses Role-Based Access Control (RBAC). Super Admins have full access to everything. Store Managers can manage inventory and orders. Staff members can create and track orders but cannot access administrative settings or the Dashboard.',
    'Adding and editing products': 'Go to the Inventory tab. Click "Add New Product" to create a single item. You can upload an image (max 2MB), set a category, price, and initial stock. To edit, hover over a product card and click the Edit icon.',
    'Bulk upload using CSV': 'In the Inventory tab, click "Template" to download a sample CSV. Fill it with your product data and use the "Bulk Upload" button to import hundreds of items at once. Ensure your SKU values are unique.',
    'SKU generation and stock alerts': 'When adding a product, you can use the "Auto-Generate" button next to the SKU field to create a unique identifier based on the category and timestamp. Products with less than 5 units in stock will be highlighted in red.',
    'Creating a new order': 'In the Orders tab, click "New Order". Select products from the dropdown, set the quantity, and add customer details. For non-offline orders, shipping details are required for Shiprocket sync.',
    'Applying discounts': 'During order creation, you can apply a manual discount of up to 25%. The subtotal and final total will update automatically. This discount is also reflected in the generated invoice.',
    'Shiprocket integration and tracking': 'Orders created with a channel other than "Offline" are automatically synced to Shiprocket. You will receive a Shiprocket Order ID upon successful sync. If sync fails, ensure your credentials are set in the app secrets.',
    'Cancelling and returning stock': 'If you change an order status to "Cancelled", the system automatically returns the items to your inventory stock. If you reinstate a cancelled order, the stock is re-deducted.',
    'Two-Factor Authentication (2FA)': 'Enhance your account security by enabling 2FA in the Settings tab. You will need an authenticator app (like Google Authenticator) to scan the QR code. Once enabled, you will be prompted for a 6-digit code upon every login.',
    'Managing staff permissions': 'Super Admins can manage other users in the Settings > Users section. You can assign roles (Super Admin, Store Manager, Staff) or delete accounts. New accounts must be created by a Super Admin; self-registration is disabled.',
    'Dark mode and UI preferences': 'The app supports both Light and Dark modes. You can toggle this using the sun/moon icon in the top header. Your preference is saved locally to your browser.',
  };

  const handleContactSupport = () => {
    window.location.href = 'mailto:support@houseofsambhav.com?subject=Technical Support Request';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 max-w-3xl">
        <div className="w-12 h-12 bg-white dark:bg-stone-800 rounded-2xl flex items-center justify-center shadow-sm border border-stone-100 dark:border-stone-800 overflow-hidden shrink-0">
          <img 
            src={logo} 
            alt="House of Sambhav Logo" 
            className="w-full h-full object-contain p-1"
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
