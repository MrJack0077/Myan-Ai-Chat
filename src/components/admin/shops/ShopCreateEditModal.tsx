import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, Settings, X, Key, Eye, EyeOff, Bot, Plus, Trash2, ShieldAlert, Loader2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../components/Toast';
import * as shopService from '../../../services/shopService';
import { Shop } from '../../../types';

interface ShopCreateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialData: Partial<Shop> & { email?: string; password?: string };
  onSuccess: () => void;
  editingShopId?: string | null;
}

export default function ShopCreateEditModal({ isOpen, onClose, mode, initialData, onSuccess, editingShopId }: ShopCreateEditModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newShop, setNewShop] = useState(initialData);
  
  // Update effect to reset state when opened with new data
  React.useEffect(() => {
    if (isOpen) {
      setNewShop(initialData);
    }
  }, [isOpen, initialData]);

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      if (mode === 'create') {
        const shopData: Partial<Shop> = {
          name: newShop.name,
          slug: newShop.slug,
          sendpulseBotIds: newShop.sendpulseBots?.length ? newShop.sendpulseBots.map(b => b.id) : undefined,
          sendpulseBots: newShop.sendpulseBots?.length ? newShop.sendpulseBots : undefined,
          sendpulseClientId: newShop.sendpulseClientId || undefined,
          sendpulseClientSecret: newShop.sendpulseClientSecret || undefined,
          agentId: newShop.agentId || undefined,
          disableCache: newShop.disableCache,
          databaseName: `db_${newShop.slug}`,
          vendorCredentials: {
            email: newShop.email as string,
            password: newShop.password as string 
          }
        };
        
        const shopId = await shopService.saveShop(shopData);
        await shopService.createVendorUser(newShop.email as string, newShop.password as string, shopId);
        
        showToast(`Shop provisioned and vendor account ${newShop.email} created!`, 'success');
      } else {
        if (!editingShopId) return;
        await shopService.saveShop({ 
          id: editingShopId, 
          name: newShop.name, 
          slug: newShop.slug, 
          sendpulseBotIds: newShop.sendpulseBots?.length ? newShop.sendpulseBots.map(b => b.id) : undefined,
          sendpulseBots: newShop.sendpulseBots?.length ? newShop.sendpulseBots : undefined,
          sendpulseClientId: newShop.sendpulseClientId || undefined,
          sendpulseClientSecret: newShop.sendpulseClientSecret || undefined,
          agentId: newShop.agentId || undefined,
          disableCache: newShop.disableCache
        });
        showToast('Shop configuration updated', 'success');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Save error:', error);
      showToast(error.message || 'An error occurred while saving the shop', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
      >
        <div className="p-8 border-b border-slate-100 flex items-start justify-between bg-white relative z-20">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center shadow-md">
              {mode === 'create' ? <Store className="w-7 h-7 text-white" /> : <Settings className="w-7 h-7 text-white" />}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {mode === 'create' ? t('shops.provision_new') : t('inventory.edit_item')}
              </h2>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                {mode === 'create' ? t('shops.provision_desc') : t('shops.edit_desc')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveShop} className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-8rem)] custom-scrollbar relative z-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Left Column */}
            <div className="space-y-8">
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                   <Store className="w-4 h-4 text-slate-400" /> အခြေခံအချက်အလက်များ
                </h3>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">{t('dashboard.shop_name')}</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. My Awesome Store"
                    className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-sm shadow-sm"
                    value={newShop.name}
                    onChange={(e) => setNewShop({ ...newShop, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">{t('shops.url_slug')}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">/</span>
                    <input 
                      required
                      type="text" 
                      placeholder="my-store"
                      disabled={mode === 'edit'}
                      className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-sm shadow-sm disabled:opacity-50 disabled:bg-slate-50"
                      value={newShop.slug}
                      onChange={(e) => setNewShop({ ...newShop, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">{t('shops.agent_id')}</label>
                  <input 
                    type="text" 
                    placeholder="e.g. AGENT-001"
                    className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-sm shadow-sm"
                    value={newShop.agentId}
                    onChange={(e) => setNewShop({ ...newShop, agentId: e.target.value })}
                  />
                </div>
              </div>

              {mode === 'create' && (
                <div className="space-y-5">
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                     <Key className="w-4 h-4 text-slate-400" /> အကောင့်ဝင်ရောက်ရန်
                  </h3>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('common.email')}</label>
                    <input 
                      required
                      type="email" 
                      placeholder="vendor@example.com"
                      className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-sm shadow-sm"
                      value={newShop.email}
                      onChange={(e) => setNewShop({ ...newShop, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('common.password')}</label>
                    <div className="relative">
                      <input 
                        required
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••"
                        className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-sm shadow-sm pr-12"
                        value={newShop.password}
                        onChange={(e) => setNewShop({ ...newShop, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-slate-400" /> SendPulse ချိတ်ဆက်မှု
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setNewShop({ ...newShop, sendpulseBots: [...(newShop.sendpulseBots || []), { id: '', channel: 'telegram' }] })}
                    className="text-xs text-slate-900 hover:text-white font-bold bg-slate-100 hover:bg-slate-900 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3 h-3" /> ဘော့အသစ်
                  </button>
                </div>

                {(!newShop.sendpulseBots || newShop.sendpulseBots.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-8 bg-slate-50/50 border border-slate-200 border-dashed rounded-2xl">
                    <Bot className="w-8 h-8 text-slate-300 mb-3" />
                    <p className="text-sm font-medium text-slate-500">ချိတ်ဆက်ထားသော ဘော့ မရှိသေးပါ</p>
                  </div>
                )}

                {newShop.sendpulseBots && newShop.sendpulseBots.length > 0 && (
                  <div className="space-y-3">
                    {newShop.sendpulseBots.map((bot, idx) => (
                      <div key={idx} className="flex gap-3 items-center p-3 bg-slate-50/50 border border-slate-200 rounded-xl group hover:border-slate-300 transition-colors">
                        <input 
                          type="text" 
                          placeholder="Bot ID"
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-sm"
                          value={bot.id}
                          onChange={(e) => {
                            const newBots = [...(newShop.sendpulseBots || [])];
                            newBots[idx].id = e.target.value;
                            setNewShop({ ...newShop, sendpulseBots: newBots });
                          }}
                        />
                        <select 
                          className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-sm w-32 font-medium text-slate-700"
                          value={bot.channel}
                          onChange={(e) => {
                            const newBots = [...(newShop.sendpulseBots || [])];
                            newBots[idx].channel = e.target.value;
                            setNewShop({ ...newShop, sendpulseBots: newBots });
                          }}
                        >
                          <option value="telegram">Telegram</option>
                          <option value="facebook">Facebook</option>
                          <option value="instagram">Instagram</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="viber">Viber</option>
                          <option value="other">Other</option>
                        </select>
                        <button 
                          type="button"
                          onClick={() => {
                            const newBots = (newShop.sendpulseBots || []).filter((_, i) => i !== idx);
                            setNewShop({ ...newShop, sendpulseBots: newBots });
                          }}
                          className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Client ID (ရွေးချယ်ရန်)</label>
                    <input 
                      type="text" 
                      placeholder="Client ID..."
                      className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-sm shadow-sm"
                      value={newShop.sendpulseClientId || ''}
                      onChange={(e) => setNewShop({ ...newShop, sendpulseClientId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Client Secret (ရွေးချယ်ရန်)</label>
                    <input 
                      type="text" 
                      placeholder="Client Secret..."
                      className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-sm shadow-sm"
                      value={newShop.sendpulseClientSecret || ''}
                      onChange={(e) => setNewShop({ ...newShop, sendpulseClientSecret: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-400" /> အဆင့်မြင့် ဆက်တင်များ
                </h3>
                <label className="flex items-start gap-4 p-5 bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200 rounded-2xl cursor-pointer transition-colors group">
                  <div className="relative flex items-center h-6 mt-0.5">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={newShop.disableCache || false}
                      onChange={(e) => setNewShop({ ...newShop, disableCache: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-900/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-100 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900 shadow-sm"></div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900 mb-1">Redis Cache ပိတ်ရန်</div>
                    <div className="text-sm text-slate-500 font-medium">စမ်းသပ်ရန်အတွက် - database မှ တိုက်ရိုက်ခေါ်ယူရန်</div>
                  </div>
                </label>
              </div>

            </div>
          </div>

          <div className="pt-8 flex items-center justify-end gap-3 sticky bottom-0 bg-white border-t border-slate-100 mt-8 -mx-8 -mb-8 p-6 px-8 z-20">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              {t('common.cancel')}
            </button>
            <button 
              type="submit"
              disabled={isCreating}
              className="px-8 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 focus:ring-4 focus:ring-slate-900/20 transition-all shadow-lg shadow-slate-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {mode === 'create' ? "စတင်သတ်မှတ်မည်" : "သိမ်းဆည်းမည်"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
