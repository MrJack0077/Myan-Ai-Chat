import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, X, RefreshCw, Copy, EyeOff, Eye, MessageSquare, AlertCircle, CheckCircle2, Trash2, LayoutDashboard, Bot, Settings, Edit2, Upload } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { Shop } from '../../../types';
import * as shopService from '../../../services/shopService';
import { useToast } from '../../../components/Toast';

interface ShopDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shop: Shop | null;
  onSuccess: () => void;
  onEdit: (shop: Shop) => void;
  onDelete: (shop: Shop) => void;
}

export default function ShopDetailsDrawer({ isOpen, onClose, shop, onSuccess, onEdit, onDelete }: ShopDetailsDrawerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handlePing = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPingingId(id);
    try {
      // Mock ping
      await new Promise(resolve => setTimeout(resolve, 500));
      showToast('Database is healthy and reachable.', 'success');
    } catch (error) {
      showToast('Ping failed', 'error');
    } finally {
      setPingingId(null);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await shopService.saveShop({ id, status: status as any });
      onSuccess();
      showToast('Status updated', 'success');
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shop) return;
    
    // Check file size (limit to 1MB)
    if (file.size > 1024 * 1024) {
      showToast('Image must be less than 1MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await shopService.saveShop({ id: shop.id, logoUrl: base64String });
        onSuccess(); // Trigger refresh on parent
        showToast('Logo updated successfully', 'success');
      } catch (error) {
        showToast('Failed to update logo', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen || !shop) return null;

  return (
    <div className="fixed inset-0 z-[40] flex">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]"
      />
      
      <div className="flex-1" />{/* Spacer to push drawer to right */}
      
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto border-l border-slate-200"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center overflow-hidden border border-indigo-200">
                {shop.logoUrl ? (
                  <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-6 h-6 text-indigo-600" />
                )}
              </div>
              <label className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-opacity">
                <Upload className="w-4 h-4 mb-0.5" />
                <span className="text-[8px] font-bold uppercase tracking-wider">Upload</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleLogoUpload}
                />
              </label>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{shop.name}</h2>
              <div>
                <p className="text-[10px] text-slate-500">{t('dashboard.shop_id', 'ဆိုင် ID')}: {shop.id}</p>
                {shop.agentId && (
                  <p className="text-[10px] text-indigo-600 font-bold">{t('shops.agent_id', 'အေးဂျင့် ID')}: {shop.agentId}</p>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-8 pb-24">
          {/* Status Section */}
          <section>
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4">{t('common.status')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-500 mb-1">{t('common.status')}</p>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", shop.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500')} />
                  <span className="font-bold text-sm capitalize">{t(`common.${shop.status}`)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Shop Credentials (Admin only) */}
          {shop.vendorCredentials && (
            <section>
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4">{t('shops.credentials')}</h3>
              <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 space-y-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-indigo-400 block mb-1">{t('common.email')}</span>
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-indigo-100">
                    <code className="text-xs text-indigo-900">{shop.vendorCredentials.email}</code>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(shop.vendorCredentials!.email);
                        showToast('Email copied', 'success');
                      }}
                      className="text-indigo-400 hover:text-indigo-600 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-indigo-400 block mb-1">{t('common.password')}</span>
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-indigo-100">
                    <code className="text-xs text-indigo-900">
                      {showPassword ? shop.vendorCredentials.password : '••••••••'}
                    </code>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-indigo-400 hover:text-indigo-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(shop.vendorCredentials!.password || '');
                          showToast('Password copied', 'success');
                        }}
                        className="text-indigo-400 hover:text-indigo-600 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Integration Section */}
          <section>
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4">Integrations</h3>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">SendPulse</p>
                    <p className="text-[10px] text-slate-500">
                      {shop.sendpulseBotIds && shop.sendpulseBotIds.length > 0 ? `Bot IDs: ${shop.sendpulseBotIds.join(', ')}` : 'Not connected'}
                    </p>
                  </div>
                </div>
                <button onClick={() => onEdit(shop)} className="text-xs font-bold text-indigo-600 hover:underline">Configure</button>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="pt-8 border-t border-slate-100">
            <h3 className="text-xs uppercase tracking-wider font-bold text-red-400 mb-4">{t('shops.danger_zone')}</h3>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleUpdateStatus(shop.id, shop.status === 'active' ? 'suspended' : 'active')}
                className="w-full px-4 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                {shop.status === 'active' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {shop.status === 'active' ? t('shops.suspended') : t('common.active')}
              </button>
              <button 
                onClick={() => onDelete(shop)}
                className="w-full px-4 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t('shops.delete_tenant')}
              </button>
            </div>
          </section>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-6 bg-white border-t border-slate-100 flex gap-3 z-10">
          <button 
            onClick={() => navigate(`/admin/support?shopId=${shop.id}`)}
            className="px-4 py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            {t('dashboard.chat')}
          </button>
          <Link 
            to={`/vendor/${shop.id}`}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            {t('nav.dashboard')}
          </Link>
          <Link 
            to={`/vendor/${shop.id}/ai-training`}
            className="px-4 py-2.5 bg-amber-50 text-amber-600 font-bold rounded-xl hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
            title="AI Training"
          >
            <Bot className="w-4 h-4" />
          </Link>
          <Link 
            to={`/vendor/${shop.id}/settings`}
            className="px-4 py-2.5 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
            title="Shop Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <button 
            onClick={() => onEdit(shop)}
            className="px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
