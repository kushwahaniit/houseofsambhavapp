import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Package, 
  IndianRupee,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Database,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { collection, onSnapshot, query, limit, orderBy, addDoc, serverTimestamp, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/src/firebase';
import { formatCurrency, handleFirestoreError, OperationType } from '@/src/lib/utils';
import { Order, Product, SalesData } from '@/src/types';
import { MOCK_PRODUCTS, MOCK_ORDERS, MOCK_CUSTOMERS } from '@/src/mockData';
import logo from '../assets/logo.png';
import Dropdown from '../components/Dropdown';

interface DashboardProps {
  userRole: string;
}

const Dashboard: React.FC<DashboardProps> = ({ userRole }) => {
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDatabaseEmpty, setIsDatabaseEmpty] = useState(true);
  const [timeRange, setTimeRange] = useState('Last 7 Days');
  const [stats, setStats] = useState([
    { label: 'Total Revenue', value: '₹0', icon: IndianRupee, trend: '+0%', isUp: true },
    { label: 'Total Orders', value: '0', icon: TrendingUp, trend: '+0%', isUp: true },
    { label: 'Active Customers', value: '0', icon: Users, trend: '+0%', isUp: true },
    { label: 'Low Stock Items', value: '0', icon: Package, trend: 'Stable', isUp: true },
  ]);

  const [salesData, setSalesData] = useState<SalesData[]>([
    { name: 'Mon', sales: 0 },
    { name: 'Tue', sales: 0 },
    { name: 'Wed', sales: 0 },
    { name: 'Thu', sales: 0 },
    { name: 'Fri', sales: 0 },
    { name: 'Sat', sales: 0 },
    { name: 'Sun', sales: 0 },
  ]);
  const [channelData, setChannelData] = useState<{ name: string, value: number }[]>([]);

  useEffect(() => {
    // Fetch recent orders
    const ordersQ = query(collection(db, 'orders'), orderBy('date', 'desc'), limit(5));
    const unsubscribeOrders = onSnapshot(ordersQ, (snapshot) => {
      const ords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate().toISOString().split('T')[0] || 'Just now'
      })) as Order[];
      setRecentOrders(ords);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    // Fetch all orders for stats
    const allOrdersQ = query(collection(db, 'orders'));
    const unsubscribeAllOrders = onSnapshot(allOrdersQ, (snapshot) => {
      const totalRevenue = snapshot.docs.reduce((acc, doc) => acc + (doc.data().total || 0), 0);
      const totalOrders = snapshot.size;
      
      setStats(prev => [
        { ...prev[0], value: formatCurrency(totalRevenue) },
        { ...prev[1], value: totalOrders.toString() },
        prev[2],
        prev[3]
      ]);

      // Mock sales data distribution for chart based on real total
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const mockSales = days.map(day => ({
        name: day,
        sales: Math.floor((totalRevenue / 7) * (0.5 + Math.random()))
      }));
      setSalesData(mockSales);

      // Calculate channel distribution
      const channels: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const channel = doc.data().channel || 'Unknown';
        channels[channel] = (channels[channel] || 0) + (doc.data().total || 0);
      });
      const cData = Object.entries(channels).map(([name, value]) => ({ name, value }));
      setChannelData(cData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    // Fetch low stock items
    const productsQ = query(collection(db, 'products'));
    const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
      const lowStock = snapshot.docs.filter(doc => doc.data().stock < 5).length;
      setStats(prev => [
        prev[0],
        prev[1],
        prev[2],
        { ...prev[3], value: lowStock.toString(), trend: lowStock > 5 ? 'Critical' : 'Stable', isUp: lowStock <= 5 }
      ]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    // Fetch customers
    const customersQ = query(collection(db, 'customers'));
    const unsubscribeCustomers = onSnapshot(customersQ, (snapshot) => {
      setStats(prev => [
        prev[0],
        prev[1],
        { ...prev[2], value: snapshot.size.toString() },
        prev[3]
      ]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    // Check if database is empty
    const unsubscribeEmptyCheck = onSnapshot(query(collection(db, 'products')), (prodSnap) => {
      onSnapshot(query(collection(db, 'orders')), (orderSnap) => {
        onSnapshot(query(collection(db, 'customers')), (custSnap) => {
          setIsDatabaseEmpty(prodSnap.empty && orderSnap.empty && custSnap.empty);
        });
      });
    });

    return () => {
      unsubscribeOrders();
      unsubscribeAllOrders();
      unsubscribeProducts();
      unsubscribeCustomers();
      unsubscribeEmptyCheck();
    };
  }, []);

  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [seedStatus, setSeedStatus] = useState<'idle' | 'seeding' | 'success' | 'error'>('idle');

  const exportReport = () => {
    const csvRows = [];
    // Header
    csvRows.push(['Metric', 'Value'].join(','));
    // Stats
    stats.forEach(stat => {
      csvRows.push([stat.label, stat.value.replace(/₹|,/g, '')].join(','));
    });
    // Recent Orders
    csvRows.push(['\nRecent Orders']);
    csvRows.push(['Order ID', 'Customer', 'Date', 'Total', 'Channel', 'Status'].join(','));
    recentOrders.forEach(order => {
      csvRows.push([order.id, order.customerName, order.date, order.total, order.channel, order.status].join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `HouseOfSambhav_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteData = async () => {
    setIsDeleting(true);
    try {
      const collections = ['products', 'orders', 'customers'];
      for (const collName of collections) {
        const snap = await getDocs(collection(db, collName));
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      setSeedStatus('idle');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'all');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const seedData = async () => {
    setSeedStatus('seeding');
    setIsSeeding(true);
    try {
      // Check if data already exists to avoid duplicates
      const prodSnap = await getDocs(collection(db, 'products'));
      if (prodSnap.size === 0) {
        for (const prod of MOCK_PRODUCTS) {
          const { id, ...rest } = prod;
          await addDoc(collection(db, 'products'), { ...rest, updatedAt: serverTimestamp() });
        }
      }

      const custSnap = await getDocs(collection(db, 'customers'));
      if (custSnap.size === 0) {
        for (const cust of MOCK_CUSTOMERS) {
          const { id, ...rest } = cust;
          await addDoc(collection(db, 'customers'), { ...rest, createdAt: serverTimestamp() });
        }
      }

      const orderSnap = await getDocs(collection(db, 'orders'));
      if (orderSnap.size === 0) {
        for (const order of MOCK_ORDERS) {
          const { id, ...rest } = order;
          await addDoc(collection(db, 'orders'), { ...rest, date: serverTimestamp() });
        }
      }
      setSeedStatus('success');
      setTimeout(() => setSeedStatus('idle'), 3000);
    } catch (error) {
      console.error('Seeding error:', error);
      setSeedStatus('error');
      setTimeout(() => setSeedStatus('idle'), 3000);
    } finally {
      setIsSeeding(false);
      setShowSeedConfirm(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            <h2 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-50">Dashboard Overview</h2>
            <p className="text-stone-500 dark:text-stone-400">Welcome back! Here's what's happening with House of Sambhav today.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100 shadow-sm"
          >
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>This Month</option>
          </select>

          <Dropdown 
            label="Actions"
            icon={ChevronDown}
            variant="primary"
            items={[
              {
                label: 'Export Report',
                icon: Download,
                onClick: exportReport
              },
              ...(userRole === 'super_admin' ? [
                isDatabaseEmpty ? {
                  label: seedStatus === 'seeding' ? 'Seeding...' : 'Seed Sample Data',
                  icon: Database,
                  onClick: () => setShowSeedConfirm(true),
                  disabled: isSeeding || seedStatus === 'success'
                } : {
                  label: isDeleting ? 'Deleting...' : 'Clear All Data',
                  icon: Trash2,
                  onClick: () => setShowDeleteConfirm(true),
                  variant: 'danger' as const,
                  disabled: isDeleting
                }
              ] : [])
            ]}
          />

          {/* Confirmation Modals */}
          {showSeedConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
              <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center mb-4">
                  <Database size={24} />
                </div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50 mb-2">Seed Sample Data?</h3>
                <p className="text-sm text-stone-600 dark:text-stone-400 mb-6">This will populate your database with sample products, orders, and customers. This is great for testing!</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowSeedConfirm(false)}
                    className="flex-1 px-4 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-xl font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={seedData}
                    className="flex-1 px-4 py-2.5 bg-amber-700 text-white rounded-xl font-bold hover:bg-amber-800 transition-colors"
                  >
                    Yes, Seed
                  </button>
                </div>
              </div>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
              <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center mb-4">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50 mb-2">Clear All Data?</h3>
                <p className="text-sm text-stone-600 dark:text-stone-400 mb-6">Are you sure you want to delete ALL products, orders, and customers? This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-xl font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={deleteData}
                    className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-stone-50 dark:bg-stone-800 rounded-xl text-stone-600 dark:text-stone-400">
                <stat.icon size={24} />
              </div>
              <div className={`flex items-center gap-1 text-sm font-medium ${stat.isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {stat.trend}
                {stat.isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              </div>
            </div>
            <p className="text-stone-500 dark:text-stone-400 text-sm font-medium">{stat.label}</p>
            <h3 className="text-2xl font-bold text-stone-900 dark:text-stone-50 mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50 mb-6">Weekly Sales Revenue</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b45309" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#b45309" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-stone-800" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color: 'var(--tooltip-text, #000)' }}
                  itemStyle={{ color: 'inherit' }}
                  formatter={(value: number) => [formatCurrency(value), 'Sales']}
                />
                <Area type="monotone" dataKey="sales" stroke="#b45309" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50 mb-6">Sales by Channel</h3>
          <div className="space-y-6">
            {channelData.length === 0 ? (
              <div className="text-center py-10 text-stone-400">No channel data available.</div>
            ) : (
              channelData.sort((a, b) => b.value - a.value).map((item, idx) => {
                const total = channelData.reduce((acc, curr) => acc + curr.value, 0);
                const percentage = ((item.value / total) * 100).toFixed(1);
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-stone-700 dark:text-stone-300">{item.name}</span>
                      <span className="text-stone-500 dark:text-stone-400 font-bold">{formatCurrency(item.value)} ({percentage}%)</span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-600 rounded-full" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50">Recent Orders</h3>
          <button className="text-amber-700 dark:text-amber-500 text-sm font-medium hover:underline">View All</button>
        </div>
        <div className="space-y-4">
          {recentOrders.length === 0 ? (
            <div className="text-center py-10 text-stone-400">No recent orders.</div>
          ) : (
            recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-all border border-transparent hover:border-stone-100 dark:hover:border-stone-700">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold">
                    {order.customerName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-stone-900 dark:text-stone-50">{order.customerName}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">{order.id.substring(0, 8)} • {order.date} • <span className="text-amber-700 dark:text-amber-500 font-medium">{order.channel}</span></p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-stone-900 dark:text-stone-50">{formatCurrency(order.total)}</p>
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                    order.status === 'Delivered' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                    order.status === 'Shipped' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                    order.status === 'Cancelled' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' :
                    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
