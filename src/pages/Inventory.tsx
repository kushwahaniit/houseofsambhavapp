import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, Package, X, Database, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/src/firebase';
import { formatCurrency } from '@/src/lib/utils';
import { Category, Product } from '@/src/types';
import logo from '../assets/logo.png';

import { handleFirestoreError, OperationType } from '@/src/lib/utils';

interface InventoryProps {
  userRole: string;
}

const Inventory: React.FC<InventoryProps> = ({ userRole }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Jewelry' as Category,
    price: '',
    stock: '',
    sku: '',
    image: ''
  });
  const [uploading, setUploading] = useState(false);

  const generateSKU = () => {
    const prefix = formData.category.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    setFormData({ ...formData, sku: `${prefix}-${random}-${timestamp}` });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFeedbackMessage({ type: 'error', text: 'File size too large. Please upload an image smaller than 2MB.' });
      setTimeout(() => setFeedbackMessage(null), 3000);
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, image: reader.result as string });
      setUploading(false);
      setFeedbackMessage({ type: 'success', text: 'Image uploaded successfully.' });
      setTimeout(() => setFeedbackMessage(null), 2000);
    };
    reader.onerror = () => {
      setFeedbackMessage({ type: 'error', text: 'Failed to read file.' });
      setTimeout(() => setFeedbackMessage(null), 3000);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const canEdit = userRole === 'super_admin' || userRole === 'store_manager';

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(prods);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });
    return unsubscribe;
  }, []);

  const filteredProducts = products.filter(product => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (product.name || '').toLowerCase().includes(searchLower) || 
                         (product.sku || '').toLowerCase().includes(searchLower);
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories: (Category | 'All')[] = ['All', 'Jewelry', 'Lehenga', 'Kurti', 'Suit'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const price = parseFloat(formData.price);
    const stock = parseInt(formData.stock);
    
    if (isNaN(price) || price < 0) {
      setFeedbackMessage({ type: 'error', text: 'Please enter a valid price.' });
      setTimeout(() => setFeedbackMessage(null), 3000);
      return;
    }
    
    if (isNaN(stock) || stock < 0) {
      setFeedbackMessage({ type: 'error', text: 'Please enter a valid stock quantity.' });
      setTimeout(() => setFeedbackMessage(null), 3000);
      return;
    }

    if (!formData.sku) {
      setFeedbackMessage({ type: 'error', text: 'SKU is required.' });
      setTimeout(() => setFeedbackMessage(null), 3000);
      return;
    }

    const data = {
      name: formData.name,
      category: formData.category,
      price: price,
      stock: stock,
      sku: formData.sku,
      image: formData.image,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), data);
        setFeedbackMessage({ type: 'success', text: 'Product updated successfully.' });
      } else {
        await addDoc(collection(db, 'products'), {
          ...data,
          createdAt: serverTimestamp()
        });
        setFeedbackMessage({ type: 'success', text: 'Product added successfully.' });
      }
      setTimeout(() => setFeedbackMessage(null), 3000);
      closeModal();
    } catch (error) {
      console.error('Error saving product:', error);
      handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
      setFeedbackMessage({ type: 'error', text: 'Failed to save product. Please check permissions.' });
      setTimeout(() => setFeedbackMessage(null), 5000);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData({ name: '', category: 'Jewelry', price: '', stock: '', sku: '', image: '' });
  };

  const clearAllProducts = async () => {
    if (!window.confirm('Are you sure you want to delete ALL products? This action cannot be undone.')) return;
    setIsClearing(true);
    try {
      const snap = await getDocs(collection(db, 'products'));
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      setFeedbackMessage({ type: 'success', text: 'All products cleared successfully.' });
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    } finally {
      setIsClearing(false);
    }
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      stock: product.stock.toString(),
      sku: product.sku,
      image: product.image || ''
    });
    setIsModalOpen(true);
  };

  const downloadTemplate = () => {
    const headers = ['Name', 'Category', 'Price', 'Stock', 'SKU', 'ImageURL'];
    const sampleData = [
      ['Kundan Bridal Set', 'Jewelry', '15000', '5', 'JW-KUN-001', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=200&h=200'],
      ['Silk Anarkali Suit', 'Suit', '8500', '12', 'ST-SIL-003', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=200&h=200']
    ];
    
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'inventory_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setFeedbackMessage({ type: 'success', text: 'Template downloaded successfully.' });
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      
      // Skip headers
      const rows = lines.slice(1);
      let successCount = 0;
      let errorCount = 0;

      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);

      for (const row of rows) {
        const columns = row.split(',').map(col => col.trim());
        if (columns.length < 5) {
          errorCount++;
          continue;
        }

        const [name, category, price, stock, sku, image] = columns;
        
        // Basic validation
        if (!name || !category || isNaN(parseFloat(price)) || isNaN(parseInt(stock)) || !sku) {
          errorCount++;
          continue;
        }

        const productData = {
          name,
          category: category as Category,
          price: parseFloat(price),
          stock: parseInt(stock),
          sku,
          image: image || '',
          updatedAt: serverTimestamp()
        };

        const newDocRef = doc(collection(db, 'products'));
        batch.set(newDocRef, productData);
        successCount++;
      }

      if (successCount > 0) {
        try {
          await batch.commit();
          setFeedbackMessage({ 
            type: 'success', 
            text: `Successfully uploaded ${successCount} products.${errorCount > 0 ? ` (${errorCount} failed)` : ''}` 
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'bulk_upload');
        }
      } else if (errorCount > 0) {
        setFeedbackMessage({ type: 'error', text: `Failed to upload ${errorCount} products. Check formatting.` });
      }

      setTimeout(() => setFeedbackMessage(null), 5000);
      // Reset input
      e.target.value = '';
    };

    reader.readAsText(file);
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
      setDeleteConfirm({ isOpen: false, id: '', name: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Message */}
      {feedbackMessage && (
        <div className={`fixed top-4 right-4 z-[100] p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-5 ${
          feedbackMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {feedbackMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="font-bold">{feedbackMessage.text}</p>
        </div>
      )}

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
            <h2 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-50">Inventory Management</h2>
            <p className="text-stone-500 dark:text-stone-400">Manage your product catalog and stock levels.</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-3">
            {userRole === 'super_admin' && (
              <button 
                onClick={clearAllProducts}
                disabled={isClearing}
                className="flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-4 py-2.5 rounded-xl font-medium hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-50"
                title="Delete all product data"
              >
                <Trash2 size={18} />
                <span>{isClearing ? 'Clearing...' : 'Clear Data'}</span>
              </button>
            )}
            <button 
              onClick={downloadTemplate}
              className="flex items-center justify-center gap-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 px-4 py-2.5 rounded-xl font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            >
              <Database size={18} />
              <span>Template</span>
            </button>
            <label className="flex items-center justify-center gap-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 px-4 py-2.5 rounded-xl font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer">
              <Plus size={18} />
              <span>Bulk Upload</span>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleBulkUpload}
              />
            </label>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-amber-700 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-amber-800 transition-colors"
            >
              <Plus size={20} />
              <span>Add New Product</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col md:flex-row gap-4 transition-colors duration-300">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or SKU..." 
            className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all dark:text-stone-100"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat 
                  ? 'bg-amber-700 text-white shadow-md' 
                  : 'bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="relative aspect-square overflow-hidden bg-stone-100 dark:bg-stone-800">
              {product.image ? (
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300 dark:text-stone-700">
                  <Package size={48} />
                </div>
              )}
              <div className="absolute top-3 left-3">
                <span className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm text-stone-800 dark:text-stone-100 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg shadow-sm">
                  {product.category}
                </span>
              </div>
              {canEdit && (
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  <button 
                    onClick={() => openEdit(product)}
                    className="p-2 bg-white dark:bg-stone-800 rounded-full shadow-md text-stone-600 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-500"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirm({ isOpen: true, id: product.id, name: product.name })}
                    className="p-2 bg-white dark:bg-stone-800 rounded-full shadow-md text-stone-600 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-stone-900 dark:text-stone-50 line-clamp-1">{product.name}</h3>
                <span className={`text-xs font-bold ${product.stock < 10 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {product.stock} in stock
                </span>
              </div>
              <p className="text-[10px] text-stone-400 dark:text-stone-500 mb-4">SKU: {product.sku} | ID: {product.id}</p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-amber-800 dark:text-amber-500">{formatCurrency(product.price)}</span>
                <button className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-20 bg-stone-50 dark:bg-stone-900/50 rounded-3xl border-2 border-dashed border-stone-200 dark:border-stone-800 transition-colors duration-300">
          <Package className="mx-auto text-stone-300 dark:text-stone-700 mb-4" size={48} />
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50">No products found</h3>
          <p className="text-stone-500 dark:text-stone-400">Try adjusting your search or filters.</p>
        </div>
      )}

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl my-auto transition-colors duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-stone-900 dark:text-stone-50 font-serif">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={closeModal} className="p-2 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Product Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Category</label>
                  <select 
                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value as Category})}
                  >
                    <option>Jewelry</option>
                    <option>Lehenga</option>
                    <option>Kurti</option>
                    <option>Suit</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-stone-700 dark:text-stone-300">SKU</label>
                    <button 
                      type="button"
                      onClick={generateSKU}
                      className="text-xs font-bold text-amber-700 dark:text-amber-500 hover:text-amber-800 dark:hover:text-amber-400 flex items-center gap-1"
                    >
                      <Database size={12} />
                      Auto-Generate
                    </button>
                  </div>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                    value={formData.sku}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Price (₹)</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Stock Level</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                    value={formData.stock}
                    onChange={e => setFormData({...formData, stock: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Product Image</label>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-stone-50 dark:bg-stone-800 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-700 hover:border-amber-500 transition-all group relative">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-20 h-20 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-center overflow-hidden shrink-0">
                        {formData.image ? (
                          <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <Smartphone className="text-stone-300 dark:text-stone-700" size={32} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-stone-900 dark:text-stone-50 mb-1">
                          {uploading ? 'Processing...' : 'Click or drag to upload'}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                          Recommended: Square image (800x800px), Max 2MB.<br />
                          Supported formats: JPG, PNG, WEBP.
                        </p>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-stone-400 text-xs font-bold uppercase">OR URL</span>
                      </div>
                      <input 
                        type="url" 
                        className="w-full pl-16 pr-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm dark:text-stone-100"
                        value={formData.image}
                        onChange={e => setFormData({...formData, image: e.target.value})}
                        placeholder="https://images.unsplash.com/..."
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-4 rounded-2xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 font-bold hover:bg-stone-50 dark:hover:bg-stone-800 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 rounded-2xl bg-amber-700 text-white font-bold hover:bg-amber-800 shadow-lg shadow-amber-700/20 transition-all"
                >
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center my-auto transition-colors duration-300">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-50 mb-2">Delete Product?</h3>
            <p className="text-stone-500 dark:text-stone-400 mb-8">
              Are you sure you want to delete <span className="font-bold text-stone-900 dark:text-stone-100">{deleteConfirm.name}</span>? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
                className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-xl font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDelete(deleteConfirm.id)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
