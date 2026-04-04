import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, ExternalLink, MoreHorizontal, Plus, X, CheckCircle, Clock, Truck, Ban, Trash2, ShoppingBag, Database } from 'lucide-react';
import { collection, onSnapshot, query, addDoc, updateDoc, doc, serverTimestamp, orderBy, getDocs, where, writeBatch, getDoc, increment } from 'firebase/firestore';
import { db } from '@/src/firebase';
import { formatCurrency } from '@/src/lib/utils';
import { Order, Product, OrderItem, Customer } from '@/src/types';
import logo from '../assets/logo.png';

import { handleFirestoreError, OperationType } from '@/src/lib/utils';

interface OrdersProps {
  userRole: string;
}

const Orders: React.FC<OrdersProps> = ({ userRole }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [timeFilter, setTimeFilter] = useState('All Time');
  const [showAll, setShowAll] = useState(false);
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
    items: [] as OrderItem[],
    discount: 0
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const custQ = query(collection(db, 'customers'), orderBy('name'));
    const unsubscribeCusts = onSnapshot(custQ, (snapshot) => {
      const custs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(custs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    return () => {
      unsubscribe();
      unsubscribeProds();
      unsubscribeCusts();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.customer-search-container')) {
        setShowCustomerList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOrders = orders.filter(order => {
    const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (order.id || '').toLowerCase().includes(searchLower) ||
      (order.customerName || '').toLowerCase().includes(searchLower) ||
      (order.customerEmail || '').toLowerCase().includes(searchLower);
    
    // Time filtering
    const orderDate = new Date(order.date);
    const now = new Date();
    // Normalize now to start of day for accurate comparison
    now.setHours(0, 0, 0, 0);
    let matchesTime = true;

    if (timeFilter === 'Last 7 Days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      matchesTime = orderDate >= sevenDaysAgo;
    } else if (timeFilter === 'Last 30 Days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      matchesTime = orderDate >= thirtyDaysAgo;
    } else if (timeFilter === 'Last Month') {
      const lastMonth = new Date();
      lastMonth.setMonth(now.getMonth() - 1);
      matchesTime = orderDate.getMonth() === lastMonth.getMonth() && orderDate.getFullYear() === lastMonth.getFullYear();
    }

    return matchesStatus && matchesSearch && matchesTime;
  });

  const displayOrders = showAll ? filteredOrders : filteredOrders.slice(0, 5);

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
      sku: product.sku,
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

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = (subtotal * (formData.discount || 0)) / 100;
    return subtotal - discountAmount;
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

  const selectCustomer = (customer: Customer) => {
    console.log('Selecting customer:', customer);
    setFormData(prev => ({
      ...prev,
      customerName: customer.name,
      customerEmail: customer.email || '',
      customerPhone: customer.phone || '',
      customerAddress: customer.address || '',
      customerCity: customer.city || '',
      customerState: customer.state || '',
      customerPincode: customer.pincode || ''
    }));
    setCustomerSearch(customer.name);
    setShowCustomerList(false);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

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
      const subtotal = calculateSubtotal();
      const orderTotal = calculateTotal();
      const isOffline = formData.channel === 'Offline';
      const orderData = {
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        customerAddress: isOffline ? '' : formData.customerAddress,
        customerCity: isOffline ? '' : formData.customerCity,
        customerPincode: isOffline ? '' : formData.customerPincode,
        customerState: isOffline ? '' : formData.customerState,
        subtotal: subtotal,
        discount: formData.discount,
        total: orderTotal,
        items: formData.items,
        status: formData.status,
        channel: formData.channel,
        date: serverTimestamp()
      };

      // 1. Prepare Batch
      const batch = writeBatch(db);

      // 2. Create the order
      const orderRef = doc(collection(db, 'orders'));
      batch.set(orderRef, orderData);

      // 3. Update Inventory (Only if not created as Cancelled)
      if (formData.status !== 'Cancelled') {
        for (const item of formData.items) {
          let productRef = null;
          if (item.productId) {
            const ref = doc(db, 'products', item.productId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
              productRef = ref;
            }
          }

          // Fallback to SKU if ID fails
          if (!productRef && item.sku) {
            const q = query(collection(db, 'products'), where('sku', '==', item.sku));
            const snap = await getDocs(q);
            if (!snap.empty) {
              productRef = snap.docs[0].ref;
            }
          }

          if (productRef) {
            batch.update(productRef, {
              stock: increment(-Number(item.quantity))
            });
          }
        }
      }

      // 4. Create a billing record
      const billingRef = doc(collection(db, 'billing'));
      batch.set(billingRef, {
        orderId: orderRef.id,
        amount: orderTotal,
        paymentMethod: 'Pending',
        status: 'Pending',
        processedBy: 'System',
        timestamp: serverTimestamp()
      });

      // 5. Sync with customers collection
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
          batch.update(doc(db, 'customers', customerDoc.id), {
            totalOrders: (currentData.totalOrders || 0) + 1,
            totalSpent: (currentData.totalSpent || 0) + orderTotal,
            lastOrder: new Date().toISOString().split('T')[0],
            phone: currentData.phone === 'N/A' ? customerPhone : currentData.phone,
            email: currentData.email || customerEmail,
            address: isOffline ? (currentData.address || '') : (formData.customerAddress || currentData.address || ''),
            city: isOffline ? (currentData.city || '') : (formData.customerCity || currentData.city || ''),
            state: isOffline ? (currentData.state || '') : (formData.customerState || currentData.state || ''),
            pincode: isOffline ? (currentData.pincode || '') : (formData.customerPincode || currentData.pincode || ''),
            updatedAt: serverTimestamp()
          });
        } else {
          // Create new customer
          const newCustomerRef = doc(collection(db, 'customers'));
          batch.set(newCustomerRef, {
            name: formData.customerName,
            email: customerEmail || '',
            phone: customerPhone || 'N/A',
            address: isOffline ? '' : (formData.customerAddress || ''),
            city: isOffline ? '' : (formData.customerCity || ''),
            state: isOffline ? '' : (formData.customerState || ''),
            pincode: isOffline ? '' : (formData.customerPincode || ''),
            totalOrders: 1,
            totalSpent: orderTotal,
            lastOrder: new Date().toISOString().split('T')[0],
            createdAt: serverTimestamp()
          });
        }
      }

      // 6. Commit Batch
      await batch.commit();
      
      // 7. Shiprocket Integration (Post-commit)
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

      setIsModalOpen(false);
      setCustomerSearch('');
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
        channel: 'Website',
        discount: 0
      });
    } catch (error) {
      console.error('Order Creation Error:', error);
      alert('Failed to create order: ' + (error instanceof Error ? error.message : String(error)));
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    }
  };

  const updateStatus = async (id: string, newStatus: Order['status']) => {
    try {
      console.log(`Attempting status update for order ${id}: ${newStatus}`);
      const orderRef = doc(db, 'orders', id);
      const orderSnap = await getDoc(orderRef);
      
      if (!orderSnap.exists()) {
        console.error(`Order ${id} not found`);
        return;
      }
      
      const orderData = orderSnap.data() as Order;
      const oldStatus = orderData.status;
      console.log(`Current status: ${oldStatus}, New status: ${newStatus}`);

      // If status hasn't changed, do nothing
      if (oldStatus === newStatus) {
        console.log('Status unchanged, skipping update');
        return;
      }

      const batch = writeBatch(db);

      // Inventory Logic:
      // 1. Moving from non-Cancelled to Cancelled: Return stock
      if (oldStatus !== 'Cancelled' && newStatus === 'Cancelled') {
        console.log('Returning stock to inventory...');
        if (Array.isArray(orderData.items)) {
          console.log(`Processing ${orderData.items.length} items for stock return`);
          for (const item of orderData.items) {
            let productRef = null;
            if (item.productId) {
              const ref = doc(db, 'products', item.productId);
              const snap = await getDoc(ref);
              if (snap.exists()) {
                productRef = ref;
              }
            }

            // Fallback to SKU if ID fails
            if (!productRef && item.sku) {
              console.log(`Product ID ${item.productId} not found. Attempting fallback to SKU: ${item.sku}`);
              const q = query(collection(db, 'products'), where('sku', '==', item.sku));
              const snap = await getDocs(q);
              if (!snap.empty) {
                productRef = snap.docs[0].ref;
                console.log(`Found product by SKU: ${item.sku}. New ID: ${productRef.id}`);
              }
            }

            if (productRef) {
              const qty = Number(item.quantity);
              console.log(`Returning ${qty} units for product ${item.name}`);
              batch.update(productRef, {
                stock: increment(qty)
              });
            } else {
              console.warn(`Product ${item.name} (ID: ${item.productId}, SKU: ${item.sku}) could not be found in inventory. Skipping stock return.`);
            }
          }
        } else {
          console.warn('Order items is not an array:', orderData.items);
        }
      } 
      // 2. Moving from Cancelled back to any active status: Deduct stock again
      else if (oldStatus === 'Cancelled' && newStatus !== 'Cancelled') {
        console.log('Re-deducting stock from inventory...');
        if (Array.isArray(orderData.items)) {
          console.log(`Processing ${orderData.items.length} items for stock deduction`);
          for (const item of orderData.items) {
            let productRef = null;
            if (item.productId) {
              const ref = doc(db, 'products', item.productId);
              const snap = await getDoc(ref);
              if (snap.exists()) {
                productRef = ref;
              }
            }

            // Fallback to SKU if ID fails
            if (!productRef && item.sku) {
              console.log(`Product ID ${item.productId} not found. Attempting fallback to SKU: ${item.sku}`);
              const q = query(collection(db, 'products'), where('sku', '==', item.sku));
              const snap = await getDocs(q);
              if (!snap.empty) {
                productRef = snap.docs[0].ref;
                console.log(`Found product by SKU: ${item.sku}. New ID: ${productRef.id}`);
              }
            }

            if (productRef) {
              const qty = Number(item.quantity);
              console.log(`Deducting ${qty} units for product ${item.name}`);
              batch.update(productRef, {
                stock: increment(-qty)
              });
            } else {
              console.warn(`Product ${item.name} (ID: ${item.productId}, SKU: ${item.sku}) could not be found in inventory. Skipping stock deduction.`);
            }
          }
        } else {
          console.warn('Order items is not an array:', orderData.items);
        }
      }

      // Update the order status
      batch.update(orderRef, { 
        status: newStatus,
        updatedAt: serverTimestamp() 
      });
      
      console.log('Committing batch update...');
      await batch.commit();
      console.log('Batch update successful');
    } catch (error) {
      console.error('Status Update Error:', error);
      alert('Failed to update status: ' + (error instanceof Error ? error.message : String(error)));
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
            <select 
              className="px-4 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-medium outline-none dark:text-stone-100"
              value={timeFilter}
              onChange={(e) => {
                setTimeFilter(e.target.value);
                setShowAll(false); // Reset showAll when filter changes
              }}
            >
              <option>All Time</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>Last Month</option>
            </select>
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
              {displayOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-stone-400 dark:text-stone-600">No orders found.</td>
                </tr>
              ) : (
                displayOrders.map((order) => (
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

        {!showAll && filteredOrders.length > 5 && (
          <div className="p-4 border-t border-stone-100 dark:border-stone-800 text-center">
            <button 
              onClick={() => setShowAll(true)}
              className="text-amber-700 dark:text-amber-500 font-bold hover:underline flex items-center justify-center gap-2 mx-auto"
            >
              <span>View All Transactions ({filteredOrders.length})</span>
              <ExternalLink size={14} />
            </button>
          </div>
        )}
        {showAll && filteredOrders.length > 5 && (
          <div className="p-4 border-t border-stone-100 dark:border-stone-800 text-center">
            <button 
              onClick={() => setShowAll(false)}
              className="text-stone-500 dark:text-stone-400 font-bold hover:underline"
            >
              Show Less
            </button>
          </div>
        )}
      </div>

      {/* New Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl my-auto transition-colors duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-stone-900 dark:text-stone-50 font-serif">Create New Order</h3>
              <button onClick={() => { setIsModalOpen(false); setCustomerSearch(''); }} className="p-2 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="relative customer-search-container">
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Search Existing Customer</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search by name, email or mobile..." 
                    className="w-full pl-10 pr-10 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerList(true);
                    }}
                    onFocus={() => setShowCustomerList(true)}
                  />
                  {customerSearch && (
                    <button 
                      type="button"
                      onClick={() => {
                        setCustomerSearch('');
                        setFormData({
                          ...formData,
                          customerName: '',
                          customerEmail: '',
                          customerPhone: '',
                          customerAddress: '',
                          customerCity: '',
                          customerState: '',
                          customerPincode: ''
                        });
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                {showCustomerList && customerSearch && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map(customer => (
                        <button
                          key={customer.id}
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800 border-b border-stone-100 dark:border-stone-800 last:border-0"
                          onClick={() => selectCustomer(customer)}
                        >
                          <p className="font-bold text-stone-900 dark:text-stone-50">{customer.name}</p>
                          <p className="text-xs text-stone-500">{customer.email} | {customer.phone}</p>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-stone-500">No customers found</div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
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
                  <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-stone-600 dark:text-stone-400">Subtotal:</span>
                      <span className="text-sm font-bold text-stone-900 dark:text-stone-50">{formatCurrency(calculateSubtotal())}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-stone-600 dark:text-stone-400">Discount (%):</span>
                        <input 
                          type="number" 
                          min="0"
                          max="25"
                          className="w-16 px-2 py-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs outline-none dark:text-stone-100"
                          value={formData.discount}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setFormData({...formData, discount: Math.min(25, Math.max(0, val))});
                          }}
                        />
                      </div>
                      <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                        -{formatCurrency((calculateSubtotal() * (formData.discount || 0)) / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-stone-100 dark:border-stone-800">
                      <span className="text-sm font-bold text-stone-900 dark:text-stone-50">Total Amount:</span>
                      <span className="text-lg font-bold text-amber-700 dark:text-amber-500">{formatCurrency(calculateTotal())}</span>
                    </div>
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
                  
                  {selectedOrder.discount && selectedOrder.discount > 0 ? (
                    <>
                      <div className="pt-3 border-t border-stone-200 dark:border-stone-700 flex justify-between text-sm">
                        <span className="text-stone-600 dark:text-stone-400">Subtotal</span>
                        <span className="font-medium text-stone-900 dark:text-stone-50">{formatCurrency(selectedOrder.subtotal || selectedOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-600 dark:text-stone-400">Discount ({selectedOrder.discount}%)</span>
                        <span className="font-medium text-rose-600 dark:text-rose-400">-{formatCurrency((selectedOrder.subtotal || selectedOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)) * selectedOrder.discount / 100)}</span>
                      </div>
                    </>
                  ) : null}

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
