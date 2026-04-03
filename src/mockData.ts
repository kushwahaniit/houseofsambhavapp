import { Product, Order, Customer, SalesData } from './types';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Kundan Bridal Set',
    category: 'Jewelry',
    price: 15000,
    stock: 5,
    sku: 'JW-KUN-001',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=200&h=200',
  },
  {
    id: '2',
    name: 'Velvet Bridal Lehenga',
    category: 'Lehenga',
    price: 45000,
    stock: 3,
    sku: 'LH-VEL-002',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=200&h=200',
  },
  {
    id: '3',
    name: 'Silk Anarkali Suit',
    category: 'Suit',
    price: 8500,
    stock: 12,
    sku: 'ST-SIL-003',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=200&h=200',
  },
  {
    id: '4',
    name: 'Cotton Floral Kurti',
    category: 'Kurti',
    price: 2500,
    stock: 25,
    sku: 'KT-COT-004',
    image: 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?auto=format&fit=crop&q=80&w=200&h=200',
  },
  {
    id: '5',
    name: 'Temple Gold Necklace',
    category: 'Jewelry',
    price: 12000,
    stock: 8,
    sku: 'JW-TEM-005',
    image: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&q=80&w=200&h=200',
  },
];

export const MOCK_ORDERS: Order[] = [
  { 
    id: 'ORD001', 
    customerName: 'Ananya Sharma', 
    date: '2024-03-20', 
    total: 15000, 
    status: 'Delivered', 
    channel: 'Website',
    items: [
      { productId: '1', name: 'Kundan Bridal Set', quantity: 1, price: 15000 }
    ] 
  },
  { 
    id: 'ORD002', 
    customerName: 'Priya Patel', 
    date: '2024-03-21', 
    total: 45000, 
    status: 'Shipped', 
    channel: 'Instagram',
    items: [
      { productId: '2', name: 'Velvet Bridal Lehenga', quantity: 1, price: 45000 }
    ] 
  },
  { 
    id: 'ORD003', 
    customerName: 'Sneha Gupta', 
    date: '2024-03-22', 
    total: 2500, 
    status: 'Pending', 
    channel: 'Whatsapp',
    items: [
      { productId: '4', name: 'Cotton Floral Kurti', quantity: 1, price: 2500 }
    ] 
  },
  { 
    id: 'ORD004', 
    customerName: 'Riya Singh', 
    date: '2024-03-23', 
    total: 8500, 
    status: 'Delivered', 
    channel: 'Offline',
    items: [
      { productId: '3', name: 'Silk Anarkali Suit', quantity: 1, price: 8500 }
    ] 
  },
  { 
    id: 'ORD005', 
    customerName: 'Meera Reddy', 
    date: '2024-03-24', 
    total: 12000, 
    status: 'Cancelled', 
    channel: 'Facebook',
    items: [
      { productId: '5', name: 'Temple Gold Necklace', quantity: 1, price: 12000 }
    ] 
  },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'CUST001', name: 'Ananya Sharma', email: 'ananya@example.com', phone: '+91 98765 43210', totalOrders: 5, totalSpent: 75000, lastOrder: '2024-03-20', createdAt: '2024-01-15' },
  { id: 'CUST002', name: 'Priya Patel', email: 'priya@example.com', phone: '+91 98765 43211', totalOrders: 2, totalSpent: 45000, lastOrder: '2024-03-21', createdAt: '2024-02-10' },
  { id: 'CUST003', name: 'Sneha Gupta', email: 'sneha@example.com', phone: '+91 98765 43212', totalOrders: 1, totalSpent: 2500, lastOrder: '2024-03-22', createdAt: '2024-03-01' },
  { id: 'CUST004', name: 'Riya Singh', email: 'riya@example.com', phone: '+91 98765 43213', totalOrders: 1, totalSpent: 8500, lastOrder: '2024-03-23', createdAt: '2024-03-15' },
  { id: 'CUST005', name: 'Meera Reddy', email: 'meera@example.com', phone: '+91 98765 43214', totalOrders: 1, totalSpent: 12000, lastOrder: '2024-03-24', createdAt: '2024-03-20' },
];

export const MOCK_SALES_DATA: SalesData[] = [
  { name: 'Mon', sales: 45000 },
  { name: 'Tue', sales: 52000 },
  { name: 'Wed', sales: 38000 },
  { name: 'Thu', sales: 65000 },
  { name: 'Fri', sales: 48000 },
  { name: 'Sat', sales: 85000 },
  { name: 'Sun', sales: 72000 },
];
