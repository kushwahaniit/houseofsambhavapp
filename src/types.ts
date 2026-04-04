export type Category = 'Jewelry' | 'Lehenga' | 'Kurti' | 'Suit';
export type Role = 'super_admin' | 'store_manager' | 'staff';

export interface User {
  uid: string;
  email: string;
  name: string;
  role: Role;
  createdAt: any;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  stock: number;
  image: string;
  sku: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
}

export type OrderChannel = 'Website' | 'Offline' | 'Facebook' | 'Instagram' | 'Whatsapp';

export interface Order {
  id: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  customerPincode?: string;
  customerState?: string;
  date: string;
  total: number;
  subtotal?: number;
  discount?: number;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
  channel: OrderChannel;
  items: OrderItem[];
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  lastOrder: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  createdAt?: any;
}

export interface SalesData {
  name: string;
  sales: number;
}
