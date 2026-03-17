import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  Package, 
  Clock, 
  Search,
  ChevronDown,
  AlertCircle,
  Layers,
  Save,
  ShieldCheck,
  Database,
  MessageSquare,
  Settings,
  FileJson
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  getItems, 
  getCategories, 
  getFAQs,
  getShop,
  getOrders,
  addCategory, 
  deleteCategory, 
  saveItem, 
  deleteItem,
  saveFAQ,
  saveShop,
  bulkSaveItems
} from '../services/firebaseService';
import { VendorItem, Category, FAQ, Shop, Order } from '../types';
import VendorStats from '../components/vendor/VendorStats';
import InventoryGrid from '../components/vendor/InventoryGrid';
import CategoryManager from '../components/vendor/CategoryManager';
import ItemModal from '../components/vendor/ItemModal';
import ImportModal from '../components/vendor/ImportModal';
import AIContextModal from '../components/vendor/AIContextModal';
import FAQManager from '../components/vendor/FAQManager';
import AITraining from '../components/vendor/AITraining';
import OrderManager from '../components/vendor/OrderManager';
import SupportChat from '../components/common/SupportChat';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/Toast';

interface Analytics {
  mostPopularCategory: string;
  outOfStockCount: number;
  totalItems: number;
  newOrdersCount: number;
  pendingDeliveryCount: number;
  usedTokens: number;
}

export default function VendorDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { shopId: urlShopId } = useParams();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine effective shopId: URL param takes precedence for ADMINs
  const effectiveShopId = (user?.role === 'ADMIN' && urlShopId) ? urlShopId : user?.shopId;
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'categories' | 'settings' | 'analytics' | 'reviews' | 'ai-training' | 'orders'>('dashboard');
  const [items, setItems] = useState<VendorItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTypeSelectionOpen, setIsTypeSelectionOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<VendorItem | null>(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkStockData, setBulkStockData] = useState<{id: string, name: string, stock: number}[]>([]);
  const [formData, setFormData] = useState({
    item_type: 'product' as 'product' | 'service',
    name: '',
    price: '',
    description: '',
    category: 'General',
    subcategory: '',
    ai_keywords: '',
    ai_metadata: '',
    stock_type: 'count' as 'count' | 'status',
    stock_quantity: '',
    is_available: true,
    duration: '',
    booking_availability: true,
    image_url: '',
    status: 'active' as 'active' | 'inactive' | 'draft',
    brand: '',
    specifications: '',
    target_audience: '',
    usage_instructions: '',
    shipping_info: '',
    return_policy: '',
    warranty_info: '',
    ai_custom_description: '',
    sub_items: [] as any[]
  });

  const handleBulkUpdate = async () => {
    setIsSaving(true);
    try {
      await Promise.all(bulkStockData.map(item => 
        saveItem(effectiveShopId || '', { id: item.id, stock_quantity: item.stock })
      ));
      setIsBulkModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Failed to bulk update stock:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const openBulkUpdate = () => {
    setBulkStockData(items.filter(i => i.item_type === 'product' && i.stock_type === 'count').map(i => ({
      id: i.id,
      name: i.name,
      stock: i.stock_quantity || 0
    })));
    setIsBulkModalOpen(true);
  };

  useEffect(() => {
    const path = location.pathname;
    if (path.endsWith('/inventory')) setActiveTab('inventory');
    else if (path.endsWith('/categories')) setActiveTab('categories');
    else if (path.endsWith('/analytics')) setActiveTab('analytics');
    else if (path.endsWith('/reviews')) setActiveTab('reviews');
    else if (path.endsWith('/ai-training')) setActiveTab('ai-training');
    else if (path.endsWith('/settings')) setActiveTab('settings');
    else if (path.endsWith('/orders')) setActiveTab('orders');
    else setActiveTab('dashboard');
  }, [location.pathname]);

  useEffect(() => {
    if (effectiveShopId) {
      fetchData();
    }
  }, [effectiveShopId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [itemsData, categoriesData, faqsData, shopData, ordersData] = await Promise.all([
        getItems(effectiveShopId || ''),
        getCategories(effectiveShopId || ''),
        getFAQs(effectiveShopId || ''),
        user?.role === 'ADMIN' && effectiveShopId ? getShop(effectiveShopId) : Promise.resolve(user?.shop || null),
        getOrders(effectiveShopId || '')
      ]);
      
      setItems(itemsData);
      setCategories(categoriesData);
      setFaqs(faqsData);
      setCurrentShop(shopData);
      
      // Basic analytics calculation
      setAnalytics({
        totalItems: itemsData.length,
        outOfStockCount: itemsData.filter(i => i.stock_quantity === 0).length,
        mostPopularCategory: categoriesData[0]?.name || 'General',
        newOrdersCount: ordersData.filter(o => o.status === 'pending').length,
        pendingDeliveryCount: ordersData.filter(o => ['processing', 'shipped'].includes(o.status)).length,
        usedTokens: shopData?.usedTokens || 0
      });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await addCategory(effectiveShopId || '', newCategoryName);
      setNewCategoryName('');
      fetchData();
    } catch (error) {
      console.error('Failed to add category:', error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setCategoryToDelete(id);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsSaving(true);
    try {
      await deleteCategory(effectiveShopId || '', categoryToDelete);
      showToast('Category deleted successfully', 'success');
      setCategoryToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Failed to delete category:', error);
      showToast('Failed to delete category', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (item: VendorItem) => {
    setEditingItem(item);
    setFormData({
      item_type: item.item_type,
      name: item.name,
      price: item.price.toString(),
      description: item.description || '',
      category: item.category,
      subcategory: item.subcategory || '',
      ai_keywords: item.ai_keywords || '',
      ai_metadata: item.ai_metadata || '',
      stock_type: item.stock_type || 'count',
      stock_quantity: item.stock_quantity?.toString() || '',
      is_available: item.is_available !== undefined ? item.is_available : true,
      duration: item.duration || '',
      booking_availability: !!item.booking_availability,
      image_url: item.image_url || '',
      status: item.status,
      brand: item.brand || '',
      specifications: item.specifications || '',
      target_audience: item.target_audience || '',
      usage_instructions: item.usage_instructions || '',
      shipping_info: item.shipping_info || '',
      return_policy: item.return_policy || '',
      warranty_info: item.warranty_info || '',
      ai_custom_description: item.ai_custom_description || '',
      sub_items: item.sub_items || []
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setIsTypeSelectionOpen(true);
  };

  const handleSelectType = (type: 'product' | 'service') => {
    setEditingItem(null);
    setFormData({ 
      item_type: type, 
      name: '', 
      price: '', 
      description: '', 
      category: categories.length > 0 ? categories[0].name : 'General',
      subcategory: '',
      ai_keywords: '',
      ai_metadata: '',
      stock_type: 'count',
      stock_quantity: '', 
      is_available: true,
      duration: '',
      booking_availability: true,
      image_url: '',
      status: 'active',
      brand: '',
      specifications: '',
      target_audience: '',
      usage_instructions: '',
      shipping_info: '',
      return_policy: '',
      warranty_info: '',
      ai_custom_description: '',
      sub_items: []
    });
    setIsTypeSelectionOpen(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const price = parseFloat(formData.price);
    const stock = parseInt(formData.stock_quantity || '0');
    const itemData = {
      ...formData,
      price: isNaN(price) ? 0 : price,
      stock_quantity: formData.stock_type === 'count' ? (isNaN(stock) ? 0 : stock) : 0,
      is_available: formData.stock_type === 'status' ? formData.is_available : (stock > 0)
    };

    try {
      const finalItemData = editingItem ? { ...itemData, id: editingItem.id } : itemData;
      await saveItem(effectiveShopId || '', finalItemData);
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save item:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsSaving(true);
    try {
      await deleteItem(effectiveShopId || '', itemToDelete);
      showToast('Item deleted successfully', 'success');
      setItemToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Failed to delete item:', error);
      showToast('Failed to delete item', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (item: VendorItem) => {
    const newStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      await saveItem(effectiveShopId || '', { id: item.id, status: newStatus });
      fetchData();
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const handleImportJSON = async (itemsToImport: Partial<VendorItem>[]) => {
    setIsSaving(true);
    try {
      await bulkSaveItems(effectiveShopId || '', itemsToImport);
      showToast(`Successfully imported ${itemsToImport.length} items`, 'success');
      fetchData();
    } catch (error) {
      console.error('Import failed:', error);
      showToast('Failed to import items', 'error');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    const matchesSearch = (item.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStock = filterStock === 'all' 
      ? true 
      : filterStock === 'low' 
        ? (item.item_type === 'product' && item.stock_type === 'count' && item.stock_quantity > 0 && item.stock_quantity <= 5)
        : (item.item_type === 'product' && ((item.stock_type === 'count' && item.stock_quantity === 0) || (item.stock_type === 'status' && !item.is_available)));
    return matchesCategory && matchesSearch && matchesStock;
  });

  const lowStockItems = items.filter(item => item.item_type === 'product' && item.stock_quantity <= 5);

  const getCurrencySymbol = (code: string) => {
    switch (code) {
      case 'MMK': return 'Ks';
      case 'THB': return '฿';
      case 'USD': return '$';
      default: return '$';
    }
  };

  const symbol = getCurrencySymbol(currentShop?.currency || 'USD');

  const generateAIContext = () => {
    let context = `AI Agent Configuration & Knowledge Base\n`;
    context += `======================================\n\n`;
    
    if (currentShop?.aiConfig) {
      const cfg = currentShop.aiConfig;
      context += `BOT IDENTITY:\n`;
      context += `- Name: ${cfg.botName}\n`;
      context += `- Personality: ${cfg.personality}\n`;
      context += `- Tone: ${cfg.tone}\n`;
      context += `- Language: ${cfg.responseLanguage}\n`;
      if (cfg.systemPrompt) context += `- System Prompt: ${cfg.systemPrompt}\n`;
      if (cfg.constraints && cfg.constraints.length > 0) {
        context += `- Constraints:\n`;
        cfg.constraints.forEach(c => context += `  * ${c}\n`);
      }
      if (cfg.policies) {
        context += `- Shop Policies:\n`;
        if (cfg.policies.shipping) context += `  * Shipping: ${cfg.policies.shipping}\n`;
        if (cfg.policies.returns) context += `  * Returns: ${cfg.policies.returns}\n`;
        if (cfg.policies.guarantees) context += `  * Guarantees: ${cfg.policies.guarantees}\n`;
        if (cfg.policies.general) context += `  * General: ${cfg.policies.general}\n`;
      }
      context += `\n`;
    }

    context += `INVENTORY DATA:\n`;
    items.forEach(item => {
      context += `- ${item.name} (${item.item_type})\n`;
      context += `  Category: ${item.category}\n`;
      context += `  Price: ${symbol}${Number(item.price).toFixed(2)}\n`;
      if (item.brand) context += `  Brand: ${item.brand}\n`;
      if (item.ai_keywords) context += `  Keywords: ${item.ai_keywords}\n`;
      if (item.ai_metadata) context += `  Special Instructions: ${item.ai_metadata}\n`;
      if (item.description) context += `  Description: ${item.description}\n`;
      if (item.ai_custom_description) context += `  AI Knowledge Base Description: ${item.ai_custom_description}\n`;
      if (item.specifications) context += `  Specifications: ${item.specifications}\n`;
      if (item.target_audience) context += `  Target Audience: ${item.target_audience}\n`;
      if (item.usage_instructions) context += `  Usage Instructions: ${item.usage_instructions}\n`;
      if (item.shipping_info) context += `  Shipping Details: ${item.shipping_info}\n`;
      if (item.return_policy) context += `  Return Policy: ${item.return_policy}\n`;
      if (item.warranty_info) context += `  Warranty: ${item.warranty_info}\n`;
      if (item.sub_items && item.sub_items.length > 0) {
        context += `  Available Variations:\n`;
        item.sub_items.forEach(sub => {
          context += `    - ${sub.name}: ${symbol}${Number(sub.price).toFixed(2)}${sub.stock_quantity !== undefined ? ` (${sub.stock_quantity} in stock)` : ''}\n`;
        });
      }
      context += `\n`;
    });

    if (faqs.length > 0) {
      context += `FREQUENTLY ASKED QUESTIONS:\n`;
      faqs.forEach(faq => {
        context += `Q: ${faq.question}\n`;
        context += `A: ${faq.answer}\n\n`;
      });
    }

    return context;
  };

  const generateFullJSONExport = () => {
    const exportData = {
      shop: {
        id: effectiveShopId,
        name: user?.role === 'ADMIN' ? 'Admin Managed Shop' : user?.shop?.name,
        slug: user?.role === 'ADMIN' ? 'managed' : user?.shop?.slug,
        aiConfig: user?.role === 'ADMIN' ? null : user?.shop?.aiConfig,
      },
      inventory: items.map(item => ({
        ...item,
        // Remove internal fields if any
      })),
      faqs: faqs,
      categories: categories,
      exportedAt: new Date().toISOString(),
      version: "1.0"
    };
    return JSON.stringify(exportData, null, 2);
  };

  if (user?.role === 'ADMIN' && !effectiveShopId) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-50 p-6">
        <div className="bg-white p-12 rounded-3xl border border-zinc-200 shadow-sm text-center max-w-md space-y-6">
          <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-zinc-900">{t('dashboard.no_shop_selected')}</h3>
            <p className="text-zinc-500 mt-2">
              {t('dashboard.no_shop_selected_desc')}
            </p>
          </div>
          <button 
            onClick={() => navigate('/admin/shops')}
            className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all"
          >
            {t('dashboard.go_to_management')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* Header Area with AI Context Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 capitalize">
            {t(`nav.${activeTab.replace('-', '_')}`)}
          </h2>
          <p className="text-sm text-zinc-500">
            {activeTab === 'dashboard' ? t('dashboard.overview_desc') : `${t('dashboard.manage_desc')} ${t(`nav.${activeTab.replace('-', '_')}`)}`}
          </p>
        </div>
        <button 
          onClick={() => setIsAIModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
        >
          <Clock className="w-4 h-4" />
          AI Context Export
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1">
        {/* Delete Confirmation Modal */}
        {itemToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-2xl max-w-sm w-full text-center space-y-6">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-900">Confirm Delete</h3>
                <p className="text-zinc-500 mt-2">Are you sure you want to delete this item? This action cannot be undone.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Category Delete Confirmation Modal */}
        {categoryToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-2xl max-w-sm w-full text-center space-y-6">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-900">Delete Category</h3>
                <p className="text-zinc-500 mt-2">Are you sure? Items in this category will remain but the category will be deleted.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setCategoryToDelete(null)}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeleteCategory}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <VendorStats analytics={analytics} />

            {lowStockItems.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3 text-amber-800 font-bold">
                  <AlertCircle className="w-5 h-5" />
                  {t('dashboard.low_stock_alerts')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {lowStockItems.map(item => (
                    <div key={item.id} className="bg-white px-3 py-1.5 rounded-xl border border-amber-200 text-xs font-medium flex items-center gap-2">
                      <span className="text-zinc-900">{item.name}</span>
                      <span className={`px-1.5 py-0.5 rounded-md ${item.stock_quantity === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {item.stock_quantity} {t('dashboard.left')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                <h3 className="text-lg font-bold text-zinc-900 mb-4">{t('dashboard.recent_activity')}</h3>
                <div className="space-y-4">
                  {items.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.item_type === 'product' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                          {item.item_type === 'product' ? <Package className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{item.name}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{item.category}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-zinc-900">{symbol}{Number(item.price).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-2">{t('dashboard.ai_ready_shop')}</h3>
                <p className="text-sm text-zinc-500 max-w-xs">{t('dashboard.ai_ready_desc')}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="bg-white border border-zinc-200 text-zinc-700 px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-zinc-50 transition-all"
              >
                <FileJson className="w-5 h-5" />
                Import JSON
              </button>
              <button 
                onClick={openBulkUpdate}
                className="bg-white border border-zinc-200 text-zinc-700 px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-zinc-50 transition-all"
              >
                <Layers className="w-5 h-5" />
                Bulk Stock Update
              </button>
              <button 
                onClick={handleAddNew}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 transition-all"
              >
                <Plus className="w-5 h-5" />
                {t('inventory.add_new')}
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder={t('inventory.search_placeholder')} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <select 
                    value={filterStock}
                    onChange={(e) => setFilterStock(e.target.value as any)}
                    className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-all outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">{t('inventory.all_stock')}</option>
                    <option value="low">{t('inventory.low_stock_filter')}</option>
                    <option value="out">Out of Stock</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="relative">
                  <select 
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-all outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="All">{t('inventory.all_categories')}</option>
                    {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="py-20 text-center text-zinc-500">{t('inventory.loading')}</div>
            ) : filteredItems.length === 0 ? (
              <div className="bg-white p-20 rounded-3xl border border-zinc-200 text-center space-y-4">
                <div className="w-20 h-20 bg-zinc-50 text-zinc-300 rounded-full flex items-center justify-center mx-auto">
                  <Package className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{t('inventory.no_items_found')}</h3>
                  <p className="text-zinc-500 max-w-xs mx-auto">
                    {t('inventory.no_items_desc')}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setFilterCategory('All');
                    setFilterStock('all');
                  }}
                  className="text-indigo-600 font-bold hover:text-indigo-700 transition-all"
                >
                  {t('common.clear_filters')}
                </button>
              </div>
            ) : (
              <InventoryGrid 
                items={filteredItems} 
                onEdit={handleEdit} 
                onDelete={handleDelete} 
                onToggleStatus={toggleStatus} 
                currency={currentShop?.currency}
              />
            )}
          </div>
        )}

        {activeTab === 'categories' && (
          <CategoryManager 
            categories={categories} 
            items={items} 
            newCategoryName={newCategoryName} 
            setNewCategoryName={setNewCategoryName} 
            onAdd={handleAddCategory} 
            onDelete={handleDeleteCategory} 
          />
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
                <div className="space-y-6">
                  <div className="flex items-center gap-6 pb-6 border-b border-zinc-100">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center">
                      <Package className="w-10 h-10" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-zinc-900">{currentShop?.name}</h3>
                      <p className="text-sm text-zinc-500">Shop ID: {effectiveShopId}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('dashboard.shop_name')}</label>
                      <input
                        type="text"
                        disabled={user?.role !== 'ADMIN'}
                        value={currentShop?.name || ''}
                        onChange={async (e) => {
                          if (user?.role === 'ADMIN' && effectiveShopId) {
                            const newName = e.target.value;
                            setCurrentShop(prev => prev ? { ...prev, name: newName } : null);
                          }
                        }}
                        onBlur={async () => {
                          if (user?.role === 'ADMIN' && effectiveShopId && currentShop) {
                            await saveShop({ id: effectiveShopId, name: currentShop.name });
                            showToast('Shop name updated', 'success');
                          }
                        }}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border border-zinc-200 transition-all",
                          user?.role !== 'ADMIN' ? "bg-zinc-50 text-zinc-500 cursor-not-allowed" : "focus:ring-2 focus:ring-indigo-500 outline-none"
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('dashboard.slug')}</label>
                      <input
                        type="text"
                        disabled
                        value={currentShop?.slug || ''}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100">
                    <h4 className="text-sm font-bold text-zinc-900 mb-4">{t('shop.status')}</h4>
                    <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
                      <div>
                        <p className="text-sm font-bold text-zinc-900">Current Status: <span className={currentShop?.status === 'active' ? 'text-emerald-600' : 'text-red-600'}>{currentShop?.status?.toUpperCase()}</span></p>
                        <p className="text-[10px] text-zinc-500">When inactive, your shop will not be visible to customers.</p>
                      </div>
                      <button 
                        onClick={async () => {
                          const newStatus = currentShop?.status === 'active' ? 'inactive' : 'active';
                          await saveShop({ id: effectiveShopId, status: newStatus });
                          setCurrentShop(prev => prev ? { ...prev, status: newStatus } : null);
                          showToast(`Shop ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          currentShop?.status === 'active' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}
                      >
                        {currentShop?.status === 'active' ? 'Deactivate Shop' : 'Activate Shop'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100">
                    <h4 className="text-sm font-bold text-zinc-900 mb-4">{t('shop.chatwoot_integration')}</h4>
                    <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-zinc-900 mb-1">Account ID: {currentShop?.chatwootAccountId || 'Not Connected'}</p>
                          {currentShop?.chatwootToken && (
                            <p className="text-xs font-bold text-zinc-900 mb-1">Access Token: {currentShop.chatwootToken.replace(/./g, '*')}</p>
                          )}
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            Your shop is ready to be connected to Chatwoot. Use the AI Context Export to feed your inventory data to the AI Agent.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100">
                    <h4 className="text-sm font-bold text-zinc-900 mb-4">{t('shop.settings')}</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('shop.currency')}</label>
                        <select
                          value={currentShop?.currency || 'USD'}
                          onChange={async (e) => {
                            const newCurrency = e.target.value as any;
                            setCurrentShop(prev => prev ? { ...prev, currency: newCurrency } : null);
                            await saveShop({ id: effectiveShopId, currency: newCurrency });
                            showToast(t('shop.currency_updated'), 'success');
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                        >
                          <option value="USD">US Dollar ($)</option>
                          <option value="MMK">Myanmar Kyat (Ks)</option>
                          <option value="THB">Thai Baht (฿)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-zinc-900">{t('shop.payment_info')}</h4>
                      <button 
                        onClick={() => {
                          const newPayment = { id: Math.random().toString(36).substr(2, 9), type: '', accountName: '', accountNumber: '' };
                          const updated = [...(currentShop?.paymentInfo || []), newPayment];
                          setCurrentShop(prev => prev ? { ...prev, paymentInfo: updated } : null);
                        }}
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        + Add Payment Method
                      </button>
                    </div>
                    <div className="space-y-3">
                      {currentShop?.paymentInfo?.map((payment, idx) => (
                        <div key={payment.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3 relative group">
                          <button 
                            onClick={() => {
                              const updated = currentShop.paymentInfo?.filter(p => p.id !== payment.id);
                              setCurrentShop(prev => prev ? { ...prev, paymentInfo: updated } : null);
                            }}
                            className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Plus className="w-4 h-4 rotate-45" />
                          </button>
                          <div className="grid grid-cols-2 gap-3">
                            <input 
                              placeholder={t('shop.payment_type_placeholder')}
                              value={payment.type}
                              onChange={(e) => {
                                const updated = [...(currentShop.paymentInfo || [])];
                                updated[idx].type = e.target.value;
                                setCurrentShop(prev => prev ? { ...prev, paymentInfo: updated } : null);
                              }}
                              className="px-3 py-2 rounded-lg border border-zinc-200 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <input 
                              placeholder={t('shop.account_name_placeholder')}
                              value={payment.accountName}
                              onChange={(e) => {
                                const updated = [...(currentShop.paymentInfo || [])];
                                updated[idx].accountName = e.target.value;
                                setCurrentShop(prev => prev ? { ...prev, paymentInfo: updated } : null);
                              }}
                              className="px-3 py-2 rounded-lg border border-zinc-200 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <input 
                            placeholder={t('shop.account_number_placeholder')}
                            value={payment.accountNumber}
                            onChange={(e) => {
                              const updated = [...(currentShop.paymentInfo || [])];
                              updated[idx].accountNumber = e.target.value;
                              setCurrentShop(prev => prev ? { ...prev, paymentInfo: updated } : null);
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      ))}
                      {currentShop?.paymentInfo && currentShop.paymentInfo.length > 0 && (
                        <button 
                          onClick={async () => {
                            await saveShop({ id: effectiveShopId, paymentInfo: currentShop.paymentInfo });
                            showToast(t('shop.payment_info_saved'), 'success');
                          }}
                          className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                        >
                          {t('shop.save_payment_info')}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-zinc-900">{t('shop.delivery_info')}</h4>
                      <button 
                        onClick={() => {
                          const newDeli = { id: Math.random().toString(36).substr(2, 9), region: '', amount: 0 };
                          const updated = [...(currentShop?.deliveryInfo || []), newDeli];
                          setCurrentShop(prev => prev ? { ...prev, deliveryInfo: updated } : null);
                        }}
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        + Add Region
                      </button>
                    </div>
                    <div className="space-y-3">
                      {currentShop?.deliveryInfo?.map((deli, idx) => (
                        <div key={deli.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3 relative group">
                          <button 
                            onClick={() => {
                              const updated = currentShop.deliveryInfo?.filter(d => d.id !== deli.id);
                              setCurrentShop(prev => prev ? { ...prev, deliveryInfo: updated } : null);
                            }}
                            className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Plus className="w-4 h-4 rotate-45" />
                          </button>
                          <div className="grid grid-cols-2 gap-3">
                            <input 
                              placeholder={t('shop.region_placeholder')}
                              value={deli.region}
                              onChange={(e) => {
                                const updated = [...(currentShop.deliveryInfo || [])];
                                updated[idx].region = e.target.value;
                                setCurrentShop(prev => prev ? { ...prev, deliveryInfo: updated } : null);
                              }}
                              className="px-3 py-2 rounded-lg border border-zinc-200 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">{currentShop?.currency || 'USD'}</span>
                              <input 
                                type="number"
                                placeholder={t('shop.amount_placeholder')}
                                value={deli.amount}
                                onChange={(e) => {
                                  const updated = [...(currentShop.deliveryInfo || [])];
                                  updated[idx].amount = parseFloat(e.target.value) || 0;
                                  setCurrentShop(prev => prev ? { ...prev, deliveryInfo: updated } : null);
                                }}
                                className="w-full pl-10 pr-3 py-2 rounded-lg border border-zinc-200 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      {currentShop?.deliveryInfo && currentShop.deliveryInfo.length > 0 && (
                        <button 
                          onClick={async () => {
                            await saveShop({ id: effectiveShopId, deliveryInfo: currentShop.deliveryInfo });
                            showToast(t('shop.delivery_info_saved'), 'success');
                          }}
                          className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                        >
                          {t('shop.save_delivery_info')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-6 border-b border-zinc-100">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                      <Settings className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900">{t('shop.manager_settings')}</h3>
                      <p className="text-xs text-zinc-500">{t('shop.manager_configs')}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('shop.manager_email')}</label>
                      <input
                        type="email"
                        disabled
                        value={currentShop?.vendorCredentials?.email || ''}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500 cursor-not-allowed"
                      />
                    </div>
                    
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <div className="flex gap-3">
                        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-indigo-900 mb-1">{t('shop.role_permissions')}</p>
                          <p className="text-[10px] text-indigo-700 leading-relaxed">
                            As a Shop Manager, you have full control over inventory, AI training, and customer interactions for this specific shop.
                          </p>
                        </div>
                      </div>
                    </div>

                    {user?.role === 'ADMIN' && (
                      <div className="pt-4 space-y-4">
                        <h4 className="text-sm font-bold text-zinc-900">{t('shop.admin_controls')}</h4>
                        <div className="grid grid-cols-1 gap-3">
                          <button 
                            onClick={() => navigate(`/admin/support?shopId=${effectiveShopId}`)}
                            className="w-full px-4 py-3 bg-white border border-zinc-200 text-zinc-700 font-bold rounded-xl hover:bg-zinc-50 transition-all flex items-center justify-center gap-2"
                          >
                            <MessageSquare className="w-4 h-4" />
                            {t('shop.open_support_chat')}
                          </button>
                          <button 
                            onClick={() => navigate(`/admin/databases`)}
                            className="w-full px-4 py-3 bg-white border border-zinc-200 text-zinc-700 font-bold rounded-xl hover:bg-zinc-50 transition-all flex items-center justify-center gap-2"
                          >
                            <Database className="w-4 h-4" />
                            {t('shop.manage_database')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai-training' && (
          <div className="space-y-12">
            <section>
              <AITraining initialConfig={currentShop?.aiConfig} shopId={effectiveShopId || ''} />
            </section>
            
            <section className="pt-12 border-t border-zinc-200">
              <FAQManager shopId={effectiveShopId || ''} />
            </section>
          </div>
        )}

        {activeTab === 'orders' && (
          <OrderManager shopId={effectiveShopId || ''} currency={currentShop?.currency} />
        )}

        {['analytics', 'reviews'].includes(activeTab) && (
          <div className="p-12 text-center text-zinc-500 bg-white rounded-3xl border border-zinc-200 shadow-sm">
            <div className="w-16 h-16 bg-zinc-50 text-zinc-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2 capitalize">{activeTab.replace('-', ' ')}</h3>
            <p className="max-w-xs mx-auto">This module is currently being optimized for your shop. Check back soon for new features!</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {isTypeSelectionOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setIsTypeSelectionOpen(false)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 p-8 animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-zinc-900 mb-2">{t('inventory.create_new_title')}</h3>
              <p className="text-zinc-500">{t('inventory.create_new_desc')}</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => handleSelectType('product')}
                className="group p-6 bg-zinc-50 border border-zinc-200 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left flex items-center gap-4"
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-zinc-900 group-hover:text-indigo-900">{t('common.product')}</p>
                  <p className="text-xs text-zinc-500">{t('inventory.product_desc')}</p>
                </div>
              </button>
              <button
                onClick={() => handleSelectType('service')}
                className="group p-6 bg-zinc-50 border border-zinc-200 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left flex items-center gap-4"
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-zinc-900 group-hover:text-indigo-900">{t('common.service')}</p>
                  <p className="text-xs text-zinc-500">{t('inventory.service_desc')}</p>
                </div>
              </button>
            </div>
            <button
              onClick={() => setIsTypeSelectionOpen(false)}
              className="w-full mt-6 py-3 text-zinc-500 font-bold hover:text-zinc-900 transition-all"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      <ItemModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        editingItem={editingItem} 
        categories={categories} 
        formData={formData} 
        setFormData={setFormData} 
        onSubmit={handleSubmit} 
        isSaving={isSaving}
        currency={currentShop?.currency}
      />

      <AIContextModal 
        isOpen={isAIModalOpen} 
        onClose={() => setIsAIModalOpen(false)} 
        context={generateAIContext()} 
        jsonContext={generateFullJSONExport()}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportJSON}
        isImporting={isSaving}
      />

      {/* Bulk Stock Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">{t('inventory.bulk_stock_update')}</h3>
                <p className="text-sm text-zinc-500">Quickly update stock levels for all products</p>
              </div>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-zinc-200 rounded-full transition-all">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {bulkStockData.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-zinc-900">{item.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        const newData = [...bulkStockData];
                        newData[idx].stock = Math.max(0, newData[idx].stock - 1);
                        setBulkStockData(newData);
                      }}
                      className="w-8 h-8 bg-white border border-zinc-200 rounded-lg flex items-center justify-center hover:bg-zinc-50 transition-all"
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      value={item.stock}
                      onChange={(e) => {
                        const newData = [...bulkStockData];
                        newData[idx].stock = parseInt(e.target.value) || 0;
                        setBulkStockData(newData);
                      }}
                      className="w-20 px-2 py-1 bg-white border border-zinc-200 rounded-lg text-center font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button 
                      onClick={() => {
                        const newData = [...bulkStockData];
                        newData[idx].stock += 1;
                        setBulkStockData(newData);
                      }}
                      className="w-8 h-8 bg-white border border-zinc-200 rounded-lg flex items-center justify-center hover:bg-zinc-50 transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-3">
              <button onClick={() => setIsBulkModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-all">
                Cancel
              </button>
              <button 
                onClick={handleBulkUpdate}
                disabled={isSaving}
                className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Update All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {effectiveShopId && (
        <SupportChat 
          room={effectiveShopId} 
          recipientName="Super Admin" 
          senderRole="VENDOR" 
        />
      )}
    </div>
  );
}
