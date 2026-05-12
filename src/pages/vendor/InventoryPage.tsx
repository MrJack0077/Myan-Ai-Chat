import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useInventory } from '../../features/inventory/hooks/useInventory';
import { useCategories } from '../../features/inventory/hooks/useCategories';
import { useShop } from '../../features/shop/hooks/useShop';
import { VendorItem } from '../../types';
import InventoryManager from '../../features/inventory/components/InventoryManager';
import ItemModal from '../../features/inventory/components/ItemModal';
import TypeSelectionModal from '../../features/inventory/components/TypeSelectionModal';
import BulkStockModal from '../../features/inventory/components/BulkStockModal';
import ImportModal from '../../features/inventory/components/ImportModal';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';
import * as inventoryService from '../../services/inventoryService';

export default function InventoryPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const effectiveShopId = shopId || user?.shopId;

  const { items, loading: isLoadingItems, saveItem, deleteItem, refresh: refreshItems } = useInventory(effectiveShopId);
  const { categories, refresh: refreshCategories } = useCategories(effectiveShopId);
  const { shop: currentShop } = useShop(effectiveShopId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTypeSelectionOpen, setIsTypeSelectionOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VendorItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [formData, setFormData] = useState<Partial<VendorItem>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingSync, setHasPendingSync] = useState(false);

  const handleAddItem = () => {
    setEditingItem(null);
    setFormData({
      item_type: 'product',
      status: 'active',
      stock_quantity: 0,
      stock_type: 'count',
      is_available: true,
      category: categories[0]?.name || 'General'
    });
    setIsTypeSelectionOpen(true);
  };

  const handleSelectType = (type: 'product' | 'service') => {
    setFormData(prev => ({ ...prev, item_type: type }));
    setIsTypeSelectionOpen(false);
    setIsModalOpen(true);
  };

  const handleEditItem = (item: VendorItem) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!effectiveShopId) return;
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteItem(id);
        setHasPendingSync(true);
        showToast('Item deleted successfully', 'success');
      } catch (err) {
        showToast('Failed to delete item', 'error');
      }
    }
  };

  const handleToggleStatus = async (item: VendorItem) => {
    if (!effectiveShopId) return;
    const newStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      await saveItem({ ...item, status: newStatus as any });
      setHasPendingSync(true);
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveShopId) return;
    setIsSaving(true);
    try {
      await saveItem(formData);
      setIsModalOpen(false);
      showToast(editingItem ? 'Item updated' : 'Item added', 'success');
      setHasPendingSync(true);
    } catch (err) {
      showToast('Failed to save item', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncAI = async () => {
    if (!effectiveShopId) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: effectiveShopId })
      });
      if (response.ok) {
        showToast('AI Knowledge Updated & Cache Cleared', 'success');
        setHasPendingSync(false);
      } else {
        throw new Error('Sync failed');
      }
    } catch (err) {
      console.error('Sync Error:', err);
      showToast('Failed to sync with AI', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Category', 'Price', 'Stock', 'Status', 'Description'];
    const rows = items.map(item => [
      item.name,
      item.category,
      item.price,
      item.stock_quantity,
      item.status,
      item.description?.replace(/,/g, ';') || ''
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_${effectiveShopId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJSON = async (jsonData: any[]) => {
    if (!effectiveShopId) return;
    setIsSaving(true);
    try {
      const itemsToSave = jsonData.map(item => ({
        ...item,
        shopId: effectiveShopId,
        created_at: new Date().toISOString()
      }));
      await inventoryService.bulkSaveItems(effectiveShopId, itemsToSave);
      await refreshItems();
      showToast(`Successfully imported ${jsonData.length} items`, 'success');
      setIsImportModalOpen(false);
    } catch (error) {
      showToast('Failed to import items', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingItems && !items.length) {
    return <div className="p-8 text-center text-zinc-500">Loading Inventory...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Inventory</h1>
        <p className="text-sm font-medium text-zinc-500 mt-1">Manage your shop items and stock levels.</p>
      </div>

      <InventoryManager 
        items={items}
        categories={categories}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        isCategoryManagerOpen={isCategoryManagerOpen}
        setIsCategoryManagerOpen={setIsCategoryManagerOpen}
        handleAddItem={handleAddItem}
        setIsBulkModalOpen={setIsBulkModalOpen}
        setIsImportModalOpen={setIsImportModalOpen}
        handleExportCSV={handleExportCSV}
        onEditItem={handleEditItem}
        onDeleteItem={handleDeleteItem}
        onToggleStatus={handleToggleStatus}
        currency={currentShop?.currency || 'MMK'}
        refreshCategories={refreshCategories}
        effectiveShopId={effectiveShopId}
        hasPendingSync={hasPendingSync}
        onSyncAI={handleSyncAI}
      />

      <TypeSelectionModal 
        isOpen={isTypeSelectionOpen}
        onClose={() => setIsTypeSelectionOpen(false)}
        onSelectType={handleSelectType}
      />

      <ItemModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        editingItem={editingItem} 
        categories={categories} 
        formData={formData} 
        setFormData={setFormData} 
        onSubmit={handleSubmit} 
        isSaving={isSaving}
        currency={currentShop?.currency || 'MMK'}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportJSON}
        isImporting={isSaving}
      />

      <BulkStockModal 
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        bulkStockData={items.map(i => ({ id: i.id, name: i.name, stock_quantity: i.stock_quantity, price: i.price }))}
        setBulkStockData={(data: any) => {
           // This would need a better implementation for local state update of bulk data
        }}
        handleBulkUpdate={async (data) => {
          if (!effectiveShopId) return;
          setIsSaving(true);
          try {
            await inventoryService.bulkSaveItems(effectiveShopId, data);
            await refreshItems();
            setHasPendingSync(true);
            showToast('Inventory updated successfully', 'success');
            setIsBulkModalOpen(false);
          } catch (err) {
            showToast('Failed to update inventory', 'error');
          } finally {
            setIsSaving(false);
          }
        }}
        isSaving={isSaving}
        currency={currentShop?.currency || 'MMK'}
      />
    </div>
  );
}
