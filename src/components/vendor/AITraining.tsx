import React, { useState, useEffect } from 'react';
import { Bot, Save, Sparkles, MessageSquare, Languages, Zap, Plus, Trash2, Send, Terminal, ShieldCheck, UserCheck, History, HelpCircle, ArrowRight, Mail, Phone, AlertTriangle, FileText, Link as LinkIcon, RefreshCw, CheckCircle2 } from 'lucide-react';
import { ShopAIConfig } from '../../types';
import { updateShopAIConfig, reindexShopInventory } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Toast';

export default function AITraining({ initialConfig, shopId }: { initialConfig?: ShopAIConfig, shopId?: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [newConstraint, setNewConstraint] = useState('');
  const [testQuery, setTestQuery] = useState('');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>(new Date().toLocaleString());
  const [showKBModal, setShowKBModal] = useState(false);
  const [newKBItem, setNewKBItem] = useState({ title: '', content: '', url: '', type: 'text' as 'text' | 'url' });
  
  const [config, setConfig] = useState<ShopAIConfig>(initialConfig || {
    botName: 'My Shop Assistant',
    personality: 'A helpful and knowledgeable assistant.',
    tone: 'friendly',
    responseLanguage: 'English',
    systemPrompt: '',
    constraints: [],
    knowledgeBase: [],
    policies: {
      shipping: '',
      returns: '',
      guarantees: '',
      general: ''
    },
    welcomeMessage: 'Hello! How can I assist you today?',
    fallbackMessage: "I'm sorry, I don't have that information. Let me connect you with a human agent.",
    handoffRules: {
      captureEmail: true,
      capturePhone: false,
      triggerKeywords: ['human', 'agent', 'manager', 'person', 'help'],
      urgencyKeywords: ['urgent', 'emergency', 'asap', 'broken', 'wrong'],
      minPriceThreshold: 100
    },
    learningCenter: {
      unansweredQuestions: [
        { id: '1', question: 'Do you offer custom sizing for the blue dress?', timestamp: new Date().toISOString() },
        { id: '2', question: 'Can I pay with Bitcoin?', timestamp: new Date().toISOString() }
      ],
      corrections: []
    }
  });

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    }
  }, [initialConfig]);

  const handleSave = async (section?: string) => {
    setIsSaving(true);
    try {
      const targetShopId = shopId || user?.shopId;
      if (targetShopId) {
        await updateShopAIConfig(targetShopId, config);
        showToast(section ? `${section} saved successfully!` : 'AI Configuration updated!', 'success');
      }
    } catch (error) {
      console.error('Failed to update AI config:', error);
      showToast('Failed to save configuration', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const addConstraint = () => {
    if (!newConstraint.trim()) return;
    setConfig({
      ...config,
      constraints: [...(config.constraints || []), newConstraint.trim()]
    });
    setNewConstraint('');
  };

  const removeConstraint = (index: number) => {
    const updated = [...(config.constraints || [])];
    updated.splice(index, 1);
    setConfig({ ...config, constraints: updated });
  };

  const handleSyncInventory = async () => {
    const targetShopId = shopId || user?.shopId;
    if (!targetShopId) return;

    setIsSyncing(true);
    try {
      await reindexShopInventory(targetShopId);
      setLastSynced(new Date().toLocaleString());
      showToast('Inventory data indexed for AI semantic search!', 'success');
    } catch (error) {
      console.error('Failed to sync inventory:', error);
      showToast('Failed to index inventory', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const addKBItem = () => {
    if (!newKBItem.title || !newKBItem.content) return;
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: newKBItem.title,
      content: newKBItem.content,
      url: newKBItem.url,
      type: newKBItem.type,
      updatedAt: new Date().toISOString()
    };
    setConfig({
      ...config,
      knowledgeBase: [...(config.knowledgeBase || []), newItem]
    });
    setNewKBItem({ title: '', content: '', url: '', type: 'text' });
    setShowKBModal(false);
  };

  const removeKBItem = (id: string) => {
    setConfig({
      ...config,
      knowledgeBase: (config.knowledgeBase || []).filter(item => item.id !== id)
    });
  };

  const handleTestBot = async () => {
    if (!testQuery.trim()) return;
    setIsTesting(true);
    setTestResponse(null);
    
    // Simulate AI response based on config
    setTimeout(() => {
      let response = `[Simulated ${config.botName} Response]: `;
      const query = testQuery.toLowerCase();
      if (query.includes('hello')) {
        response += config.welcomeMessage || "Hi there!";
      } else if (query.includes('price') || query.includes('cost')) {
        response += `I'd be happy to help with pricing! Our items are priced competitively. (Tone: ${config.tone})`;
      } else if (query.includes('shipping') || query.includes('delivery')) {
        response += config.policies?.shipping || "We offer various shipping options. Please check our shop details.";
      } else if (query.includes('return') || query.includes('refund')) {
        response += config.policies?.returns || "Our return policy is designed to be fair. Please contact us for details.";
      } else {
        response += `I understand you're asking about "${testQuery}". Based on my personality as a ${config.personality}, I'll do my best to help!`;
      }
      setTestResponse(response);
      setIsTesting(false);
    }, 1000);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{t('ai_training.bot_identity')}</h3>
                  <p className="text-sm text-zinc-500">{t('ai_training.bot_identity_desc')}</p>
                </div>
              </div>
              <button
                onClick={() => handleSave(t('ai_training.bot_identity'))}
                disabled={isSaving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {t('common.save')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('ai_training.bot_name')}</label>
                <input
                  type="text"
                  value={config.botName}
                  onChange={(e) => setConfig({ ...config, botName: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. ShopHelper"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('ai_training.response_lang')}</label>
                <select
                  value={config.responseLanguage}
                  onChange={(e) => setConfig({ ...config, responseLanguage: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                >
                  <option value="English">English</option>
                  <option value="Myanmar">Myanmar</option>
                  <option value="Thai">Thai</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('ai_training.personality')}</label>
              <textarea
                rows={3}
                value={config.personality}
                onChange={(e) => setConfig({ ...config, personality: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                placeholder={t('ai_training.personality_placeholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('ai_training.system_prompt')}</label>
              <textarea
                rows={4}
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-xs bg-zinc-50"
                placeholder={t('ai_training.system_prompt_placeholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('ai_training.tone')}</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['professional', 'friendly', 'humorous', 'concise'] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setConfig({ ...config, tone })}
                    className={`py-2 px-4 rounded-xl text-xs font-bold capitalize transition-all border ${
                      config.tone === tone 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' 
                        : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{t('ai_training.knowledge_base')}</h3>
                  <p className="text-sm text-zinc-500">{t('ai_training.kb_desc')}</p>
                </div>
              </div>
              <button
                onClick={() => setShowKBModal(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
              >
                <Plus className="w-4 h-4" />
                {t('ai_training.add_doc')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.knowledgeBase?.map((item) => (
                <div key={item.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 group relative">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-zinc-100 shrink-0">
                      {item.type === 'url' ? <LinkIcon className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-purple-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-zinc-900 truncate">{item.title}</h4>
                      <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{item.content}</p>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 hover:underline mt-2 inline-block truncate max-w-full">
                          {item.url}
                        </a>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => removeKBItem(item.id)}
                    className="absolute top-2 right-2 p-1.5 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {(!config.knowledgeBase || config.knowledgeBase.length === 0) && (
                <div className="md:col-span-2 text-center py-12 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
                  <p className="text-sm text-zinc-400 italic">No documents added yet. Add your first knowledge document.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{t('ai_training.shop_policies')}</h3>
                  <p className="text-sm text-zinc-500">{t('ai_training.shop_policies_desc')}</p>
                </div>
              </div>
              <button
                onClick={() => handleSave(t('ai_training.shop_policies'))}
                disabled={isSaving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {t('common.save')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('ai_training.shipping_delivery')}</label>
                <textarea
                  rows={3}
                  value={config.policies?.shipping}
                  onChange={(e) => setConfig({ ...config, policies: { ...config.policies, shipping: e.target.value } })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none text-sm"
                  placeholder={t('ai_training.shipping_placeholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('ai_training.returns_refunds')}</label>
                <textarea
                  rows={3}
                  value={config.policies?.returns}
                  onChange={(e) => setConfig({ ...config, policies: { ...config.policies, returns: e.target.value } })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none text-sm"
                  placeholder={t('ai_training.returns_placeholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('ai_training.service_guarantees')}</label>
                <textarea
                  rows={3}
                  value={config.policies?.guarantees}
                  onChange={(e) => setConfig({ ...config, policies: { ...config.policies, guarantees: e.target.value } })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none text-sm"
                  placeholder={t('ai_training.guarantees_placeholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('ai_training.general_knowledge')}</label>
                <textarea
                  rows={3}
                  value={config.policies?.general}
                  onChange={(e) => setConfig({ ...config, policies: { ...config.policies, general: e.target.value } })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none text-sm"
                  placeholder={t('ai_training.general_placeholder')}
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{t('ai_training.behavioral_constraints')}</h3>
                  <p className="text-sm text-zinc-500">{t('ai_training.constraints_desc')}</p>
                </div>
              </div>
              <button
                onClick={() => handleSave(t('ai_training.behavioral_constraints'))}
                disabled={isSaving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {t('common.save')}
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newConstraint}
                  onChange={(e) => setNewConstraint(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addConstraint()}
                  className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder={t('ai_training.constraint_placeholder')}
                />
                <button
                  onClick={addConstraint}
                  className="bg-zinc-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-zinc-800 transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                {config.constraints?.map((constraint, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100 group">
                    <span className="text-sm text-zinc-700">{constraint}</span>
                    <button
                      onClick={() => removeConstraint(idx)}
                      className="text-zinc-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(!config.constraints || config.constraints.length === 0) && (
                  <p className="text-center text-zinc-400 text-sm py-4 italic">{t('ai_training.no_constraints')}</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{t('ai_training.standard_responses')}</h3>
                  <p className="text-sm text-zinc-500">{t('ai_training.standard_responses_desc')}</p>
                </div>
              </div>
              <button
                onClick={() => handleSave(t('ai_training.standard_responses'))}
                disabled={isSaving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {t('common.save')}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('ai_training.welcome_message')}</label>
                <textarea
                  rows={2}
                  value={config.welcomeMessage}
                  onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  placeholder={t('ai_training.welcome_placeholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('ai_training.fallback_message')}</label>
                <textarea
                  rows={2}
                  value={config.fallbackMessage}
                  onChange={(e) => setConfig({ ...config, fallbackMessage: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  placeholder={t('ai_training.fallback_placeholder')}
                />
              </div>
            </div>
          </div>

          {/* Global save button removed as per request to have individual card buttons */}
        </div>

        {/* AI Insights Sidebar */}
        <div className="space-y-6">
          <div className="bg-zinc-900 text-white p-8 rounded-3xl shadow-xl space-y-6">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-indigo-400" />
              <h4 className="text-lg font-bold">{t('ai_training.training_tips')}</h4>
            </div>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="w-5 h-5 bg-indigo-500/20 rounded flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="w-3 h-3 text-indigo-400" />
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  <strong className="text-white block mb-1">{t('ai_training.tip_specific')}</strong>
                  {t('ai_training.tip_specific_desc')}
                </p>
              </li>
              <li className="flex gap-3">
                <div className="w-5 h-5 bg-indigo-500/20 rounded flex items-center justify-center shrink-0 mt-0.5">
                  <Languages className="w-3 h-3 text-indigo-400" />
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  <strong className="text-white block mb-1">{t('ai_training.tip_tone')}</strong>
                  {t('ai_training.tip_tone_desc')}
                </p>
              </li>
            </ul>
          </div>

          {/* AI Playground */}
          <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <Terminal className="w-6 h-6 text-indigo-600" />
              <h4 className="text-lg font-bold">{t('ai_training.playground')}</h4>
            </div>
            <p className="text-xs text-zinc-500">{t('ai_training.playground_desc')}</p>
            
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleTestBot()}
                  className="w-full pl-4 pr-12 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  placeholder={t('ai_training.test_placeholder')}
                />
                <button
                  onClick={handleTestBot}
                  disabled={isTesting || !testQuery.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-30"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>

              {testResponse && (
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-xs text-zinc-600 leading-relaxed italic">
                    {testResponse}
                  </p>
                </div>
              )}
              
              {isTesting && (
                <div className="flex justify-center py-4">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-zinc-900">{t('ai_training.training_status')}</h4>
              <button 
                onClick={handleSyncInventory}
                disabled={isSyncing}
                className="p-1.5 hover:bg-zinc-100 rounded-lg text-indigo-600 transition-all disabled:opacity-50"
                title={t('ai_training.sync_now')}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">{t('ai_training.inventory_data')}</span>
                <span className={`font-bold flex items-center gap-1 ${isSyncing ? 'text-indigo-600' : 'text-emerald-600'}`}>
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {t('ai_training.syncing')}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      {t('ai_training.synced')}
                    </>
                  )}
                </span>
              </div>
              <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-1000 ${isSyncing ? 'bg-indigo-500 w-1/2 animate-pulse' : 'bg-emerald-500 w-full'}`}></div>
              </div>
              
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>{t('ai_training.last_synced')}</span>
                <span>{lastSynced}</span>
              </div>

              <div className="pt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-zinc-500">{t('ai_training.faq_knowledge')}</span>
                  <span className="text-indigo-600 font-bold">80% {t('ai_training.complete')}</span>
                </div>
                <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full w-[80%]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KB Modal */}
      {showKBModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900">{t('ai_training.add_doc')}</h3>
              <button onClick={() => setShowKBModal(false)} className="p-2 hover:bg-zinc-100 rounded-xl transition-all">
                <Trash2 className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">{t('ai_training.doc_title')}</label>
                <input 
                  type="text" 
                  value={newKBItem.title}
                  onChange={(e) => setNewKBItem({ ...newKBItem, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  placeholder="e.g. Return Policy Details"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">{t('ai_training.doc_content')}</label>
                <textarea 
                  rows={4}
                  value={newKBItem.content}
                  onChange={(e) => setNewKBItem({ ...newKBItem, content: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm resize-none"
                  placeholder="Paste text content here..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">{t('ai_training.doc_url')}</label>
                <input 
                  type="text" 
                  value={newKBItem.url}
                  onChange={(e) => setNewKBItem({ ...newKBItem, url: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  placeholder="https://example.com/info"
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button 
                  onClick={() => setNewKBItem({ ...newKBItem, type: 'text' })}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${newKBItem.type === 'text' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500'}`}
                >
                  Text Content
                </button>
                <button 
                  onClick={() => setNewKBItem({ ...newKBItem, type: 'url' })}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${newKBItem.type === 'url' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500'}`}
                >
                  URL Link
                </button>
              </div>
            </div>
            <div className="p-6 bg-zinc-50 flex gap-3">
              <button 
                onClick={() => setShowKBModal(false)}
                className="flex-1 px-4 py-2 border border-zinc-200 text-zinc-600 font-bold rounded-xl hover:bg-white transition-all"
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={addKBItem}
                disabled={!newKBItem.title || !newKBItem.content}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
