import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, ExternalLink, MoreHorizontal, Plus, X, CheckCircle, Clock, Truck, Ban, Trash2, ShoppingBag, Database } from 'lucide-react';
import { collection, onSnapshot, query, addDoc, updateDoc, doc, serverTimestamp, orderBy, getDocs, where, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/src/firebase';
import { formatCurrency } from '@/src/lib/utils';
import { Order, Product, OrderItem } from '@/src/types';
import logo from '../assets/logo.png';

import { handleFirestoreError, OperationType } from '@/src/lib/utils';

interface OrdersProps {
  userRole: string;
}

const Orders: React.FC<OrdersProps> = ({ userRole }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    customerCity: '',
    customerPincode: '',
    customerState: '',
    status: 'Pending' as Order['status'],
    channel: 'Website' as Order['channel'],
    items: [] as OrderItem[]
  });

  const [currentItem, setCurrentItem] = useState({
    productId: '',
    quantity: 1
  });

  const canEdit = userRole === 'super_admin' || userRole === 'store_manager' || userRole === 'staff';

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0]
      })) as Order[];
      setOrders(ords);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    const prodQ = query(collection(db, 'products'), orderBy('name'));
    const unsubscribeProds = onSnapshot(prodQ, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(prods);
    });

    return () => {
      unsubscribe();
      unsubscribeProds();
    };
  }, []);

  const filteredOrders = orders.filter(order => {
    const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (order.id || '').toLowerCase().includes(searchLower) ||
      (order.customerName || '').toLowerCase().includes(searchLower) ||
      (order.customerEmail || '').toLowerCase().includes(searchLower);
    return matchesStatus && matchesSearch;
  });

  const addItemToOrder = () => {
    if (!currentItem.productId) {
      alert('Please select a product.');
      return;
    }
    
    const product = products.find(p => p.id === currentItem.productId);
    if (!product) return;

    const newItem: OrderItem = {
      productId: product.id,
      name: product.name,
      quantity: currentItem.quantity,
      price: product.price
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setCurrentItem({ productId: '', quantity: 1 });
  };

  const removeItemFromOrder = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const clearAllOrders = async () => {
    if (!window.confirm('Are you sure you want to delete ALL orders? This action cannot be undone.')) return;
    setIsClearing(true);
    try {
      const snap = await getDocs(collection(db, 'orders'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'orders');
    } finally {
      setIsClearing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.items.length === 0) {
      alert('Please add at least one item to the order.');
      return;
    }

    // Manual validation to prevent silent browser blocks
    if (!formData.customerName) {
      alert('Please enter Customer Name.');
      return;
    }
    if (!formData.customerEmail) {
      alert('Please enter Customer Email.');
      return;
    }
    if (!formData.customerPhone) {
      alert('Please enter Customer Mobile.');
      return;
    }
    
    if (formData.channel !== 'Offline') {
      if (!formData.customerAddress) {
        alert('Please enter Shipping Address.');
        return;
      }
      if (!formData.customerCity) {
        alert('Please enter City.');
        return;
      }
      if (!formData.customerState) {
        alert('Please enter State.');
        return;
      }
      if (!formData.customerPincode) {
        alert('Please enter Pincode.');
        return;
      }
    }

    try {
      const orderTotal = calculateTotal();
      const orderData = {
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        customerAddress: formData.customerAddress,
        customerCity: formData.customerCity,
        customerPincode: formData.customerPincode,
        customerState: formData.customerState,
        total: orderTotal,
        items: formData.items,
        status: formData.status,
        channel: formData.channel,
        date: serverTimestamp()
      };

      // 1. Create the order
      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      
      // 2. Shiprocket Integration
      if (formData.channel !== 'Offline') {
        try {
          // Remove serverTimestamp as it's not JSON serializable
          const { date, ...apiOrderData } = orderData;
          const response = await fetch('/api/shiprocket', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: orderRef.id,
              ...apiOrderData
            }),
          });
          
          let shiprocketResult;
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            shiprocketResult = await response.json();
          } else {
            const text = await response.text();
            shiprocketResult = { error: "Non-JSON response", details: text };
          }
          
          if (response.ok) {
            if (shiprocketResult.status_code === 1 || shiprocketResult.order_id) {
              alert('SUCCESS: Order created and synced with Shiprocket!\nShiprocket Order ID: ' + (shiprocketResult.order_id || shiprocketResult.data?.order_id));
            } else {
              alert('Order created locally. Shiprocket response: ' + (shiprocketResult.message || JSON.stringify(shiprocketResult)));
            }
          } else {
            // Handle error response
            const errorMsg = shiprocketResult.error || shiprocketResult.message || 'Unknown error';
            const details = shiprocketResult.details ? (typeof shiprocketResult.details === 'object' ? JSON.stringify(shiprocketResult.details, null, 2) : shiprocketResult.details) : 'No details';
            
            if (response.status === 422) {
              alert('SHIPROCKET VALIDATION FAILED (422):\n\n' + errorMsg + '\n\nDetails:\n' + details + '\n\nCommon issues: Invalid Pincode, missing Pickup Location, or address too short.');
            } else {
              alert('SHIPROCKET SYNC FAILED (' + response.status + '):\n\n' + errorMsg + '\n\nDetails:\n' + details);
            }
          }
        } catch (srError: any) {
          console.error('Shiprocket Sync Error:', srError);
          alert('Order created in local DB but failed to sync with Shiprocket.\n\nError: ' + (srError.message || 'Network error or server crash') + '\n\nPlease check if Shiprocket credentials are set in AI Studio Secrets.');
        }
      }
      // 2. Create a billing record automatically
      await addDoc(collection(db, 'billing'), {
        orderId: orderRef.id,
        amount: orderTotal,
        paymentMethod: 'Pending',
        status: 'Pending',
        processedBy: 'System',
        timestamp: serverTimestamp()
      });

      // 3. Sync with customers collection
      const customerEmail = formData.customerEmail;
      const customerPhone = formData.customerPhone;
      
      if (customerEmail || customerPhone) {
        let q;
        if (customerEmail) {
          q = query(collection(db, 'customers'), where('email', '==', customerEmail));
        } else {
          q = query(collection(db, 'customers'), where('phone', '==', customerPhone));
        }
        
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Update existing customer
          const customerDoc = querySnapshot.docs[0];
          const currentData = customerDoc.data() as any;
          await updateDoc(doc(db, 'customers', customerDoc.id), {
            totalOrders: (currentData.totalOrders || 0) + 1,
            totalSpent: (currentData.totalSpent || 0) + orderTotal,
            lastOrder: new Date().toISOString().split('T')[0],
            phone: currentData.phone === 'N/A' ? customerPhone : currentData.phone,
            email: currentData.email || customerEmail,
            updatedAt: serverTimestamp()
          });
        } else {
          // Create new customer
          await addDoc(collection(db, 'customers'), {
            name: formData.customerName,
            email: customerEmail || '',
            phone: customerPhone || 'N/A',
            totalOrders: 1,
            totalSpent: orderTotal,
            lastOrder: new Date().toISOString().split('T')[0],
            createdAt: serverTimestamp()
          });
        }
      }

      setIsModalOpen(false);
      setFormData({ 
        customerName: '', 
        customerEmail: '', 
        customerPhone: '', 
        customerAddress: '',
        customerCity: '',
        customerPincode: '',
        customerState: '',
        items: [], 
        status: 'Pending', 
        channel: 'Website' 
      });
    } catch (error) {
      console.error('Order Creation Error:', error);
      alert('Failed to create order: ' + (error instanceof Error ? error.message : String(error)));
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    }
  };

  const updateStatus = async (id: string, newStatus: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Delivered': return <CheckCircle size={14} />;
      case 'Shipped': return <Truck size={14} />;
      case 'Cancelled': return <Ban size={14} />;
      default: return <Clock size={14} />;
    }
  };

  const handlePrint = () => {
    console.log('Opening print window...');
    const content = document.getElementById('printable-invoice');
    if (!content) {
      console.error('Printable invoice content not found');
      return;
    }

    // Open a new window
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      console.error('Failed to open print window. Popups might be blocked.');
      // Fallback to standard window.print()
      window.print();
      return;
    }

    // Get all styles from the current document
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(s => s.outerHTML)
      .join('');

    // Write the content to the new window
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${selectedOrder?.id}</title>
          ${styles}
          <style>
            @import "tailwindcss";
            body { background: white !important; padding: 40px !important; margin: 0 !important; }
            .no-print { display: none !important; }
            .print\\:block { display: block !important; }
            #printable-invoice { width: 100% !important; max-width: none !important; box-shadow: none !important; border: none !important; position: static !important; }
          </style>
        </head>
        <body>
          <div id="printable-invoice">
            ${content.innerHTML}
          </div>
          <script>
            // Wait for images and styles to load
            window.onload = () => {
              setTimeout(() => {
                window.print();
                // Optional: close the window after printing
                // window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white dark:bg-stone-800 rounded-2xl flex items-center justify-center shadow-sm border border-stone-100 dark:border-stone-700 overflow-hidden shrink-0">
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
            <h2 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-50">Order Management</h2>
            <p className="text-stone-500 dark:text-stone-400">Track and manage customer orders across all channels.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center justify-center gap-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 px-4 py-2.5 rounded-xl font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
            <Download size={18} />
            <span>Export</span>
          </button>
          {userRole === 'super_admin' && (
            <button 
              onClick={clearAllOrders}
              disabled={isClearing}
              className="flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-4 py-2.5 rounded-xl font-medium hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-50"
              title="Delete all order data"
            >
              <Trash2 size={18} />
              <span>{isClearing ? 'Clearing...' : 'Clear Data'}</span>
            </button>
          )}
          <button 
            onClick={async () => {
              try {
                const res = await fetch('/api/health');
                const data = await res.json();
                alert('BACKEND STATUS: ' + data.status + '\nTimestamp: ' + data.timestamp + '\nEnv: ' + (data.environment || 'Local Server'));
              } catch (err) {
                alert('BACKEND ERROR: ' + (err instanceof Error ? err.message : String(err)));
              }
            }}
            className="flex items-center justify-center gap-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 px-4 py-2.5 rounded-xl font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            title="Test connection to backend API"
          >
            <Database size={18} />
            <span>Test API</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-amber-700 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-amber-800 transition-colors"
          >
            <Plus size={18} />
            <span>New Order</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden transition-colors duration-300">
        <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by Order ID or Customer..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            {['All', 'Pending', 'Shipped', 'Delivered', 'Cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  statusFilter === status 
                    ? 'bg-amber-700 text-white' 
                    : 'bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider font-bold">
                <th className="px-6 py-4">Order ID</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Channel</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-stone-400 dark:text-stone-600">No orders found.</td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-sm text-stone-600 dark:text-stone-400">{order.id.substring(0, 8)}</td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-stone-900 dark:text-stone-50">{order.customerName}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-500 dark:text-stone-400">{order.date}</td>
                    <td className="px-6 py-4 font-bold text-stone-900 dark:text-stone-50">{formatCurrency(order.total)}</td>
                    <td className="px-6 py-4 text-sm text-stone-600 dark:text-stone-400">
                      <span className="px-2 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-medium">{order.channel}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600 dark:text-stone-400">
                      <div className="flex flex-col">
                        <span className="font-medium">{Array.isArray(order.items) ? order.items.length : 0} items</span>
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 truncate max-w-[150px]">
                          {Array.isArray(order.items) ? order.items.map(i => i.name).join(', ') : 'No items'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${
                          order.status === 'Delivered' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                          order.status === 'Shipped' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                          order.status === 'Cancelled' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' :
                          'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        }`}>
                          {getStatusIcon(order.status)}
                          {order.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select 
                          className="text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1 outline-none dark:text-stone-100"
                          value={order.status}
                          onChange={(e) => updateStatus(order.id, e.target.value as Order['status'])}
                        >
                          <option>Pending</option>
                          <option>Shipped</option>
                          <option>Delivered</option>
                          <option>Cancelled</option>
                        </select>
                        <button 
                          onClick={() => setSelectedOrder(order)}
                          className="p-2 text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                        >
                          <ExternalLink size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl my-auto transition-colors duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-stone-900 dark:text-stone-50 font-serif">Create New Order</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Customer Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                  value={formData.customerName}
                  onChange={e => setFormData({...formData, customerName: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Customer Email</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                    value={formData.customerEmail}
                    onChange={e => setFormData({...formData, customerEmail: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Customer Mobile</label>
                  <input 
                    type="tel" 
                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                    value={formData.customerPhone}
                    onChange={e => setFormData({...formData, customerPhone: e.target.value})}
                  />
                </div>
              </div>

              {formData.channel !== 'Offline' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Shipping Address</label>
                    <textarea 
                      className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                      rows={2}
                      value={formData.customerAddress}
                      onChange={e => setFormData({...formData, customerAddress: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">City</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm dark:text-stone-100"
                        value={formData.customerCity}
                        onChange={e => setFormData({...formData, customerCity: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">State</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm dark:text-stone-100"
                        value={formData.customerState}
                        onChange={e => setFormData({...formData, customerState: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Pincode</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm dark:text-stone-100"
                        value={formData.customerPincode}
                        onChange={e => setFormData({...formData, customerPincode: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl border border-stone-200 dark:border-stone-700">
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-50 mb-4 flex items-center gap-2">
                  <ShoppingBag size={16} />
                  Add Products
                </h4>
                <div className="flex gap-2 mb-4">
                  <select 
                    className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-sm outline-none dark:text-stone-100"
                    value={currentItem.productId}
                    onChange={e => setCurrentItem({...currentItem, productId: e.target.value})}
                  >
                    <option value="">Select Product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</option>
                    ))}
                  </select>
                  <input 
                    type="number" 
                    min="1"
                    className="w-20 px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-sm outline-none dark:text-stone-100"
                    value={currentItem.quantity}
                    onChange={e => setCurrentItem({...currentItem, quantity: parseInt(e.target.value)})}
                  />
                  <button 
                    type="button"
                    onClick={addItemToOrder}
                    className="bg-stone-900 dark:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-stone-800 dark:hover:bg-amber-800 whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white dark:bg-stone-800 p-2 rounded-lg border border-stone-100 dark:border-stone-700 text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium text-stone-900 dark:text-stone-50">{item.name}</span>
                        <span className="text-xs text-stone-500 dark:text-stone-400">{item.quantity} x {formatCurrency(item.price)}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeItemFromOrder(idx)}
                        className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-1 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {formData.items.length === 0 && (
                    <p className="text-center text-stone-400 dark:text-stone-600 text-xs py-4 italic">No items added yet.</p>
                  )}
                </div>

                {formData.items.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-700 flex justify-between items-center">
                    <span className="text-sm font-bold text-stone-900 dark:text-stone-50">Total Amount:</span>
                    <span className="text-lg font-bold text-amber-700 dark:text-amber-500">{formatCurrency(calculateTotal())}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Status</label>
                  <select 
                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as Order['status']})}
                  >
                    <option>Pending</option>
                    <option>Shipped</option>
                    <option>Delivered</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Channel</label>
                  <select 
                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                    value={formData.channel}
                    onChange={e => setFormData({...formData, channel: e.target.value as Order['channel']})}
                  >
                    <option value="Website">Website</option>
                    <option value="Offline">Offline</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Whatsapp">Whatsapp</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 rounded-2xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 font-bold hover:bg-stone-50 dark:hover:bg-stone-800 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 rounded-2xl bg-amber-700 text-white font-bold hover:bg-amber-800 shadow-lg shadow-amber-700/20 transition-all"
                >
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm">
          <div id="printable-invoice" className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl my-auto transition-colors duration-300">
            <div className="flex items-center justify-between mb-8 no-print">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white dark:bg-stone-800 rounded-xl flex items-center justify-center shadow-sm border border-stone-100 dark:border-stone-700 overflow-hidden">
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
                  <h3 className="text-xl font-bold text-stone-900 dark:text-stone-50 font-serif leading-none">House of Sambhav</h3>
                  <p className="text-stone-500 dark:text-stone-400 font-mono text-[10px] mt-1">Order #{selectedOrder.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100">
                <X size={24} />
              </button>
            </div>

            {/* Print Header (Only visible when printing) */}
            <div className="hidden print:block mb-8 border-b border-stone-200 pb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-serif font-bold text-stone-900">INVOICE</h1>
                  <p className="text-stone-500 font-mono text-sm mt-1">#{selectedOrder.id}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-3 mb-1">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-stone-100 overflow-hidden">
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
                    <h2 className="text-xl font-serif font-bold text-amber-700">House of Sambhav</h2>
                  </div>
                  <p className="text-xs text-stone-500">Premium Ethnic Wear & Jewelry</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Customer</p>
                  <p className="text-lg font-bold text-stone-900 dark:text-stone-50">{selectedOrder.customerName}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{selectedOrder.customerEmail || 'No email provided'}</p>
                  {selectedOrder.customerPhone && (
                    <p className="text-sm text-stone-500 dark:text-stone-400">{selectedOrder.customerPhone}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Date</p>
                  <p className="text-stone-900 dark:text-stone-100">{selectedOrder.date}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Channel</p>
                  <p className="text-stone-900 dark:text-stone-100">{selectedOrder.channel}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Status</p>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full mt-1 ${
                    selectedOrder.status === 'Delivered' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                    selectedOrder.status === 'Shipped' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                    selectedOrder.status === 'Cancelled' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' :
                    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  }`}>
                    {getStatusIcon(selectedOrder.status)}
                    {selectedOrder.status}
                  </span>
                </div>
              </div>

              <div className="bg-stone-50 dark:bg-stone-800/50 p-6 rounded-2xl border border-stone-200 dark:border-stone-700">
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-50 mb-4 flex items-center gap-2">
                  <ShoppingBag size={16} />
                  Order Summary
                </h4>
                <div className="space-y-3">
                  {Array.isArray(selectedOrder.items) ? selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-stone-600 dark:text-stone-400">{item.name} <span className="text-stone-400 dark:text-stone-500">x{item.quantity}</span></span>
                      <span className="font-medium text-stone-900 dark:text-stone-50">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  )) : (
                    <p className="text-stone-500 dark:text-stone-400 text-sm italic">Legacy order with no item details.</p>
                  )}
                  <div className="pt-3 border-t border-stone-200 dark:border-stone-700 flex justify-between items-center">
                    <span className="font-bold text-stone-900 dark:text-stone-50">Total Paid</span>
                    <span className="text-xl font-bold text-amber-700 dark:text-amber-500">{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Signature and Footer Note (Only visible when printing) */}
            <div className="hidden print:block mt-12 pt-8 border-t border-stone-100">
              <div className="flex justify-between items-end">
                <div className="text-xs text-stone-400 italic">
                  This is an electronic invoice and doesn't need any signature.
                </div>
                <div className="text-center w-48">
                  <div className="border-b border-stone-400 mb-2"></div>
                  <p className="text-xs font-bold text-stone-600 uppercase tracking-widest">Physical Signature</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-4 no-print mt-8">
              <button 
                onClick={handlePrint}
                className="px-6 py-3 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-all"
              >
                Print Invoice
              </button>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="px-6 py-3 rounded-xl bg-stone-900 dark:bg-amber-700 text-white font-bold hover:bg-stone-800 dark:hover:bg-amber-800 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
