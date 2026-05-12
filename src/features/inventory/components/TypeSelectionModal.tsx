import React from 'react';
import { Package, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TypeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'product' | 'service') => void;
}

export default function TypeSelectionModal({
  isOpen,
  onClose,
  onSelectType
}: TypeSelectionModalProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 p-8 animate-in fade-in zoom-in duration-200">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-zinc-900 mb-2">{t('inventory.create_new_title')}</h3>
          <p className="text-zinc-500">{t('inventory.create_new_desc')}</p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => onSelectType('product')}
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
            onClick={() => onSelectType('service')}
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
          onClick={onClose}
          className="w-full mt-6 py-3 text-zinc-500 font-bold hover:text-zinc-900 transition-all"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
