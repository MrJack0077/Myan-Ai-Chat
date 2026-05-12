import { ShopAIConfig } from '../../../../types';
export interface AITrainingCardProps {
  config: ShopAIConfig;
  updateConfig: (updates: Partial<ShopAIConfig>) => void;
  onSave: (sectionName: string) => void;
  isSaving: boolean;
}
export interface ShopSettingsData {
  currency: string;
  paymentInfo: any[];
  deliveryInfo: any[];
}