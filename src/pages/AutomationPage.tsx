import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Bot, 
  Zap, 
  Plus, 
  Trash2, 
  Save, 
  MessageSquare, 
  Clock, 
  ShieldCheck,
  Sparkles,
  Settings,
  AlertCircle,
  ChevronRight,
  Play
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

interface AutomationRule {
  id: string;
  name: string;
  trigger_intent: string;
  action_type: 'REPLY' | 'HANDOVER' | 'LABEL' | 'FOLLOWUP';
  action_payload: any;
  is_active: boolean;
}

export default function AutomationPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [personality, setPersonality] = useState('');
  const [botName, setBotName] = useState('');

  const effectiveShopId = user?.shopId;

  useEffect(() => {
    if (effectiveShopId) {
      fetchAutomationData();
    }
  }, [effectiveShopId]);

  const fetchAutomationData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/shops/${effectiveShopId}/automation`);
      const data = await response.json();
      if (data.status === 'success' || data.rules) {
        setRules(data.rules || []);
        setPersonality(data.personality || '');
        setBotName(data.botName || 'AI Assistant');
      }
    } catch (error) {
      console.error('Failed to fetch automation data:', error);
      showToast('Failed to load automation settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!effectiveShopId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/shops/${effectiveShopId}/automation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, personality, botName })
      });
      const data = await response.json();
      if (data.status === 'success') {
        showToast('Automation settings saved successfully', 'success');
      } else {
        showToast(data.message || 'Failed to save settings', 'error');
      }
    } catch (error) {
      console.error('Failed to save automation data:', error);
      showToast('Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const addRule = () => {
    const newRule: AutomationRule = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Automation Rule',
      trigger_intent: 'GREETING',
      action_type: 'REPLY',
      action_payload: { text: 'Hello! How can I help you today?' },
      is_active: true
    };
    setRules([...rules, newRule]);
  };

  const updateRule = (id: string, updates: Partial<AutomationRule>) => {
    setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 flex items-center gap-3">
            <Zap className="w-8 h-8 text-amber-500" />
            Enterprise Automation
          </h1>
          <p className="text-zinc-500 mt-1">Manage AI behavior, proactive follow-ups, and custom workflow rules.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: AI Personality */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-zinc-900">AI Personality</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">Bot Name</label>
                <input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                  placeholder="e.g. Lucky Assistant"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">Personality Description</label>
                <textarea
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all resize-none"
                  placeholder="Describe how the AI should behave (e.g. Polite, energetic, uses many emojis, very professional...)"
                />
              </div>
            </div>

            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <p className="text-xs text-indigo-700 leading-relaxed">
                <Sparkles className="w-3 h-3 inline-block mr-1 mb-0.5" />
                Tip: Enterprise-level bots should have a clear identity and tone that matches your brand.
              </p>
            </div>
          </div>

          <div className="bg-zinc-900 p-6 rounded-3xl text-white space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Automation Health
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Success Rate</span>
                <span className="font-mono text-emerald-400">94.2%</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full w-[94%]"></div>
              </div>
              <p className="text-[10px] text-zinc-500">Based on last 500 automated interactions.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Automation Rules */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Workflow Rules</h2>
                  <p className="text-xs text-zinc-500">Define custom actions for specific customer intents.</p>
                </div>
              </div>
              <button
                onClick={addRule}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Rule
              </button>
            </div>

            <div className="space-y-4">
              {rules.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-zinc-100 rounded-3xl">
                  <Settings className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                  <p className="text-zinc-400 font-medium">No custom rules defined yet.</p>
                  <button onClick={addRule} className="text-indigo-600 text-sm font-bold mt-2 hover:underline">Create your first rule</button>
                </div>
              ) : (
                rules.map((rule) => (
                  <div key={rule.id} className="p-5 rounded-2xl border border-zinc-100 bg-zinc-50/50 hover:bg-white hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            value={rule.name}
                            onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                            className="bg-transparent font-bold text-zinc-900 outline-none focus:border-b border-zinc-300"
                          />
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                            rule.is_active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"
                          )}>
                            {rule.is_active ? 'Active' : 'Paused'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">When Intent is</label>
                            <select
                              value={rule.trigger_intent}
                              onChange={(e) => updateRule(rule.id, { trigger_intent: e.target.value })}
                              className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none"
                            >
                              <option value="GREETING">Greeting</option>
                              <option value="PRODUCT_INQUIRY">Product Inquiry</option>
                              <option value="ORDER_CHECKOUT">Checkout Started</option>
                              <option value="COMPLAINT">Complaint</option>
                              <option value="HUMAN_REQUEST">Human Requested</option>
                              <option value="PAYMENT_SLIP">Payment Slip Uploaded</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Then Action</label>
                            <select
                              value={rule.action_type}
                              onChange={(e) => updateRule(rule.id, { action_type: e.target.value as any })}
                              className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none"
                            >
                              <option value="REPLY">Send Custom Reply</option>
                              <option value="HANDOVER">Handover to Human</option>
                              <option value="LABEL">Add Label</option>
                              <option value="FOLLOWUP">Schedule Follow-up</option>
                            </select>
                          </div>
                        </div>

                        {rule.action_type === 'REPLY' && (
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Reply Text</label>
                            <textarea
                              value={rule.action_payload.text || ''}
                              onChange={(e) => updateRule(rule.id, { action_payload: { ...rule.action_payload, text: e.target.value } })}
                              className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none"
                              rows={2}
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => updateRule(rule.id, { is_active: !rule.is_active })}
                          className="p-2 text-zinc-400 hover:text-zinc-900 transition-all"
                          title={rule.is_active ? 'Pause Rule' : 'Activate Rule'}
                        >
                          {rule.is_active ? <Play className="w-4 h-4 rotate-90" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => deleteRule(rule.id)}
                          className="p-2 text-zinc-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Proactive Follow-ups Section */}
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Proactive Follow-ups</h2>
                <p className="text-xs text-zinc-500">Automatically re-engage customers who stopped responding.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl border border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Abandoned Cart Follow-up</p>
                    <p className="text-[10px] text-zinc-500">Send message after 2 hours of inactivity during checkout.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-600">Enabled</span>
                  <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                    <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-zinc-100 opacity-60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Post-Purchase Review Request</p>
                    <p className="text-[10px] text-zinc-500">Ask for feedback 24 hours after order completion.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-400">Disabled</span>
                  <div className="w-10 h-5 bg-zinc-200 rounded-full relative">
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
