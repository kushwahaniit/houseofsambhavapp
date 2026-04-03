import React, { useState, useEffect } from 'react';
import { Search, Mail, Phone, Calendar, ArrowRight, UserPlus, X, Database, Trash2 } from 'lucide-react';
import { collection, onSnapshot, query, addDoc, serverTimestamp, orderBy, getDocs, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/src/firebase';
import { formatCurrency } from '@/src/lib/utils';
import { Customer } from '@/src/types';
import logo from '../assets/logo.png';

import { handleFirestoreError, OperationType } from '@/src/lib/utils';

interface CustomersProps {
  userRole: string;
}

const Customers: React.FC<CustomersProps> = ({ userRole }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const custs = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = data.createdAt?.toDate().toISOString().split('T')[0];
        
        // Fallback to lastOrder if createdAt is missing
        if (!createdAt && data.lastOrder && data.lastOrder !== 'Never') {
          createdAt = data.lastOrder;
        }
        
        return {
          id: doc.id,
          ...data,
          createdAt: createdAt || '2024-01-01'
        };
      }) as Customer[];
      setCustomers(custs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });
    return unsubscribe;
  }, []);

  const filteredCustomers = customers.filter(customer => 
    (customer.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (customer.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (customer.phone || '').includes(searchTerm)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && selectedCustomer) {
        await updateDoc(doc(db, 'customers', selectedCustomer.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'customers'), {
          ...formData,
          totalOrders: 0,
          totalSpent: 0,
          lastOrder: 'Never',
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setIsEditing(false);
      setFormData({ name: '', email: '', phone: '' });
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, 'customers');
    }
  };

  const handleEditClick = () => {
    if (selectedCustomer) {
      setFormData({
        name: selectedCustomer.name,
        email: selectedCustomer.email,
        phone: selectedCustomer.phone
      });
      setIsEditing(true);
      setIsModalOpen(true);
      setIsProfileOpen(false);
    }
  };

  const seedSampleCustomers = async () => {
    setIsSeeding(true);
    try {
      const { MOCK_CUSTOMERS } = await import('@/src/mockData');
      for (const cust of MOCK_CUSTOMERS) {
        const q = query(collection(db, 'customers'), where('email', '==', cust.email));
        const snap = await getDocs(q);
        if (snap.empty) {
          const { id, ...rest } = cust;
          await addDoc(collection(db, 'customers'), { ...rest, createdAt: serverTimestamp() });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers');
    } finally {
      setIsSeeding(false);
    }
  };

  const clearAllCustomers = async () => {
    if (!window.confirm('Are you sure you want to delete ALL customers? This action cannot be undone.')) return;
    setIsClearing(true);
    try {
      const snap = await getDocs(collection(db, 'customers'));
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'customers');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
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
            <h2 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-50">Customer Directory</h2>
            <p className="text-stone-500 dark:text-stone-400">Manage your customer relationships and loyalty.</p>
          </div>
        </div>
        <div className="flex gap-3">
          {userRole === 'super_admin' && (
            <div className="flex gap-2">
              <button 
                onClick={seedSampleCustomers}
                disabled={isSeeding || isClearing}
                className="flex items-center justify-center gap-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 px-4 py-2.5 rounded-xl font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
              >
                <Database size={18} />
                <span>{isSeeding ? 'Seeding...' : 'Seed Data'}</span>
              </button>
              <button 
                onClick={clearAllCustomers}
                disabled={isSeeding || isClearing}
                className="flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-4 py-2.5 rounded-xl font-medium hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-50"
                title="Delete all customer data"
              >
                <Trash2 size={18} />
                <span>{isClearing ? 'Clearing...' : 'Clear Data'}</span>
              </button>
            </div>
          )}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-amber-700 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-amber-800 transition-colors"
          >
            <UserPlus size={18} />
            <span>Add New Customer</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm transition-colors duration-300">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, email or phone..." 
            className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCustomers.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3 text-center py-20 bg-stone-50 dark:bg-stone-800/50 rounded-3xl border-2 border-dashed border-stone-200 dark:border-stone-700 transition-colors duration-300">
            <p className="text-stone-400 dark:text-stone-500">No customers found.</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div key={customer.id} className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-400 text-xl font-bold">
                  {customer.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 dark:text-stone-50 text-lg">{customer.name}</h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400">ID: {customer.id.substring(0, 8)}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                  <Mail size={16} className="text-stone-400 dark:text-stone-500" />
                  <span className="text-sm">{customer.email}</span>
                </div>
                <div className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                  <Phone size={16} className="text-stone-400 dark:text-stone-500" />
                  <span className="text-sm">{customer.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                  <Calendar size={16} className="text-stone-400 dark:text-stone-500" />
                  <span className="text-sm">Last order: {customer.lastOrder}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-stone-100 dark:border-stone-800">
                <div>
                  <p className="text-xs text-stone-400 dark:text-stone-500 uppercase font-bold tracking-wider mb-1">Total Orders</p>
                  <p className="font-bold text-stone-900 dark:text-stone-50">{customer.totalOrders}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 dark:text-stone-500 uppercase font-bold tracking-wider mb-1">Total Spent</p>
                  <p className="font-bold text-amber-700 dark:text-amber-500">{formatCurrency(customer.totalSpent)}</p>
                </div>
              </div>

              <button 
                onClick={() => {
                  setSelectedCustomer(customer);
                  setIsProfileOpen(true);
                }}
                className="w-full mt-6 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 font-medium hover:bg-stone-50 dark:hover:bg-stone-800 hover:border-stone-300 dark:hover:border-stone-600 transition-all"
              >
                <span>View Profile</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Customer Profile Modal */}
      {isProfileOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto transition-colors duration-300">
            <div className="relative h-32 bg-amber-700">
              <button 
                onClick={() => setIsProfileOpen(false)}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              <div className="absolute -bottom-12 left-8 w-24 h-24 rounded-3xl bg-white dark:bg-stone-800 p-1 shadow-xl">
                <div className="w-full h-full rounded-2xl bg-stone-100 dark:bg-stone-900 flex items-center justify-center text-stone-600 dark:text-stone-400 text-3xl font-bold">
                  {selectedCustomer.name.split(' ').map(n => n[0]).join('')}
                </div>
              </div>
            </div>
            
            <div className="pt-16 px-8 pb-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-stone-900 dark:text-stone-50">{selectedCustomer.name}</h3>
                  <p className="text-stone-500 dark:text-stone-400">Customer since {selectedCustomer.createdAt ? selectedCustomer.createdAt.split('-')[0] : 'Recently'}</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800">
                    <Mail size={20} />
                  </button>
                  <button className="p-2 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800">
                    <Phone size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl border border-stone-100 dark:border-stone-700">
                  <p className="text-xs text-stone-400 dark:text-stone-500 uppercase font-bold tracking-wider mb-1">Total Orders</p>
                  <p className="text-xl font-bold text-stone-900 dark:text-stone-50">{selectedCustomer.totalOrders}</p>
                </div>
                <div className="bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl border border-stone-100 dark:border-stone-700">
                  <p className="text-xs text-stone-400 dark:text-stone-500 uppercase font-bold tracking-wider mb-1">Total Spent</p>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-500">{formatCurrency(selectedCustomer.totalSpent)}</p>
                </div>
                <div className="bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl border border-stone-100 dark:border-stone-700">
                  <p className="text-xs text-stone-400 dark:text-stone-500 uppercase font-bold tracking-wider mb-1">Avg. Order</p>
                  <p className="text-xl font-bold text-stone-900 dark:text-stone-50">
                    {selectedCustomer.totalOrders > 0 
                      ? formatCurrency(selectedCustomer.totalSpent / selectedCustomer.totalOrders)
                      : formatCurrency(0)}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-stone-900 dark:text-stone-50">Contact Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl">
                    <Mail size={18} className="text-stone-400 dark:text-stone-500" />
                    <div>
                      <p className="text-[10px] text-stone-400 dark:text-stone-500 uppercase font-bold">Email</p>
                      <p className="text-sm text-stone-700 dark:text-stone-300">{selectedCustomer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl">
                    <Phone size={18} className="text-stone-400 dark:text-stone-500" />
                    <div>
                      <p className="text-[10px] text-stone-400 dark:text-stone-500 uppercase font-bold">Phone</p>
                      <p className="text-sm text-stone-700 dark:text-stone-300">{selectedCustomer.phone}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-4">
                <button 
                  onClick={handleEditClick}
                  className="flex-1 py-3 bg-amber-700 text-white rounded-xl font-bold hover:bg-amber-800 transition-all"
                >
                  Edit Details
                </button>
                <button 
                  onClick={() => setIsProfileOpen(false)}
                  className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-xl font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-md p-8 shadow-2xl my-auto transition-colors duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-stone-900 dark:text-stone-50 font-serif">
                {isEditing ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setIsEditing(false);
                  setFormData({ name: '', email: '', phone: '' });
                }} 
                className="p-2 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Full Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Email Address</label>
                <input 
                  required
                  type="email" 
                  className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Phone Number</label>
                <input 
                  required
                  type="tel" 
                  className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className="flex gap-4 pt-6">
                <button 
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setIsEditing(false);
                    setFormData({ name: '', email: '', phone: '' });
                  }}
                  className="flex-1 py-4 rounded-2xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 font-bold hover:bg-stone-50 dark:hover:bg-stone-800 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 rounded-2xl bg-amber-700 text-white font-bold hover:bg-amber-800 shadow-lg shadow-amber-700/20 transition-all"
                >
                  {isEditing ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
