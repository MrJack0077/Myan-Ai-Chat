import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Trash2, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Shop } from '../../../types';
import * as shopService from '../../../services/shopService';
import { useToast } from '../../../components/Toast';

interface ShopDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: Shop | null;
  onDeleted: () => void;
}

export default function ShopDeleteModal({ isOpen, onClose, shop, onDeleted }: ShopDeleteModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset internal state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) setDeleteConfirmText('');
  }, [isOpen]);

  const confirmDelete = async () => {
    if (!shop) return;
    if (deleteConfirmText !== shop.name) {
      showToast('Shop name does not match', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      await shopService.deleteShop(shop.id);
      showToast('Shop deleted successfully', 'success');
      onDeleted();
      onClose();
    } catch (error) {
      showToast('Failed to delete shop', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !shop) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-red-100"
      >
        <div className="p-6 border-b border-red-50 bg-red-50/50 flex flex-col gap-4">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  {t('shops.delete_confirm_title')}
                </h2>
                <p className="text-xs text-red-600 font-medium">
                  {t('shops.danger_zone')}
                </p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-lg transition-colors self-start">
                  <X className="w-5 h-5 text-slate-400" />
              </button>
           </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-xs text-amber-800 leading-relaxed">
              {t('shops.delete_confirm_desc')}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('shops.type_to_confirm', { name: shop.name })}
            </label>
            <input 
              type="text" 
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium"
              placeholder={shop.name}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button 
              onClick={confirmDelete}
              disabled={deleteConfirmText !== shop.name || isDeleting}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t('shops.delete_tenant')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
