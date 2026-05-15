import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShopAIConfig, Shop } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/Toast';
import { useShop } from '../../shop/hooks/useShop';

import {
  ShopSettingsCard,
  BotIdentityCard,
  CommunicationStyleCard,
  HumanHandoffCard,
  ShopPoliciesCard,
  BehavioralConstraintsCard,
  ReplyGuidelinesCard,
  FewShotExamplesCard,
  ShopSettingsData
} from './ai-training';

export default function AITraining({ initialConfig, shopId, currentShop, onUnsynced }: { initialConfig?: ShopAIConfig, shopId?: string, currentShop?: Shop | null, onUnsynced?: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const targetShopId = shopId || user?.shopId;
  const { updateSettings } = useShop(targetShopId);

  const [isSaving, setIsSaving] = useState(false);

  const [shopSettings, setShopSettings] = useState<ShopSettingsData>({
    currency: currentShop?.currency || 'MMK',
    paymentInfo: currentShop?.paymentInfo || [],
    deliveryInfo: currentShop?.deliveryInfo || []
  });

  const [config, setConfig] = useState<ShopAIConfig>(() => {
    const fallbackConfig: ShopAIConfig = {
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
      learningCenter: { unansweredQuestions: [], corrections: [] },
      advancedTuning: { upsellFocus: 'balanced', strictness: 'high' },
      faqs: [],
      communicationStyle: {
        responseLength: 'moderate',
        emojiUsage: 'friendly',
        greetingMode: 'once_per_session',
        formalityLevel: 'casual',
        sentenceStructure: 'natural_flow',
        useShopkeeperVoice: true,
        maxSentencesPerReply: 3
      },
      replyGuidelines: {
        greeting: "မင်္ဂလာပါရှင့်။",
        outOfStock: "စိတ်မကောင်းပါဘူးရှင့်။ ဒီပစ္စည်းလေး လောလောဆယ်ကုန်နေပါတယ်။",
        orderConfirm: "အော်ဒါလေး confirm လုပ်ပေးလို့ ကျေးဇူးပါရှင့်။",
        fallback: "ဒီအကြောင်းကို ကျွန်မတို့ admin ထံ ဆက်သွယ်ပေးလိုက်ပါမယ်။"
      },
      fewShotExamples: [
        {user: "ဒီအင်္ကျီ ဘယ်လောက်လဲ", assistant: "၂၅၀၀၀ပါရှင့်။ အရောင်လေးတွေလည်း အနီ၊အပြာရှိလို့ ကြိုက်တာလေး ပြောပေးပါနော်။"},
        {user: "delivery ကြာလား", assistant: "ရန်ကုန်ထဲဆို ၂ရက်ပါရှင့်။ နယ်ဆို ၃-၄ရက်လောက်တော့ စောင့်ရပါမယ်ရှင့်။"}
      ]
    };

    if (initialConfig) {
      return {
        ...fallbackConfig,
        ...initialConfig,
        communicationStyle: { ...fallbackConfig.communicationStyle, ...initialConfig.communicationStyle } as any,
        replyGuidelines: { ...fallbackConfig.replyGuidelines, ...initialConfig.replyGuidelines },
        fewShotExamples: initialConfig.fewShotExamples?.length ? initialConfig.fewShotExamples : fallbackConfig.fewShotExamples
      };
    }
    return fallbackConfig;
  });

  useEffect(() => {
    if (currentShop) {
      setShopSettings({
        currency: currentShop.currency || 'MMK',
        paymentInfo: currentShop.paymentInfo || [],
        deliveryInfo: currentShop.deliveryInfo || []
      });
    }
  }, [currentShop]);

  useEffect(() => {
    if (initialConfig) {
      setConfig(prev => ({
        ...prev,
        ...initialConfig,
        communicationStyle: { ...prev.communicationStyle, ...(initialConfig.communicationStyle || {}) } as any,
        replyGuidelines: { ...prev.replyGuidelines, ...(initialConfig.replyGuidelines || {}) },
        fewShotExamples: initialConfig.fewShotExamples?.length ? initialConfig.fewShotExamples : prev.fewShotExamples
      }));
    }
  }, [initialConfig]);

  const updateConfig = (updates: Partial<ShopAIConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleSaveAllSettings = async (section?: string) => {
    setIsSaving(true);
    try {
      if (!targetShopId) throw new Error('No shop ID found');

      await updateSettings({ 
        aiConfig: config,
        currency: shopSettings.currency,
        paymentInfo: shopSettings.paymentInfo,
        deliveryInfo: shopSettings.deliveryInfo
      });

      if (onUnsynced) onUnsynced();

      showToast(`${section ? section + ' updated' : 'Settings updated'} and AI bot cache cleared!`, 'success');
    } catch (error) {
      console.error('Failed to update AI config and clear cache:', error);
      showToast('Failed to save configuration or clear cache', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const commonProps = {
    config,
    updateConfig,
    onSave: handleSaveAllSettings,
    isSaving
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* ── Full-width: Shop Settings ── */}
      <ShopSettingsCard shopSettings={shopSettings} setShopSettings={setShopSettings} onSave={handleSaveAllSettings} isSaving={isSaving} />

      {/* ── 2-Column Grid: AI Configuration Cards ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BotIdentityCard {...commonProps} />
        <CommunicationStyleCard {...commonProps} />
        <HumanHandoffCard {...commonProps} />
        <ShopPoliciesCard {...commonProps} />
        <BehavioralConstraintsCard {...commonProps} />
        <ReplyGuidelinesCard {...commonProps} />
        <FewShotExamplesCard {...commonProps} />
      </div>
    </div>
  );
}
