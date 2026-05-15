import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useShop } from '../../features/shop/hooks/useShop';
import AITraining from '../../features/ai-training/components/AITraining';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { RefreshCw } from 'lucide-react';

export default function AITrainingPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const effectiveShopId = shopId || user?.shopId;
  
  const { shop: currentShop, loading: isLoading } = useShop(effectiveShopId);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasPendingSync, setHasPendingSync] = useState(false);

  const handleSyncAI = async () => {
    if (!effectiveShopId) return;
    setIsSyncing(true);
    try {
      const response = await fetch('/api/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: effectiveShopId })
      });
      
      if (response.ok) {
        showToast('AI Knowledge Refreshed & Cache Cleared!', 'success');
        setHasPendingSync(false);
      } else {
        throw new Error('Sync failed');
      }
    } catch (err) {
      console.error('Sync Error:', err);
      showToast('Failed to sync with AI', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-zinc-500">Loading AI Training...</div>;
  }

  return (
    <div className="space-y-8 relative">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">AI Training</h1>
          <p className="text-sm font-medium text-zinc-500 mt-1">Train your AI assistant and manage knowledge base.</p>
        </div>

        {hasPendingSync && (
          <button 
            onClick={handleSyncAI}
            disabled={isSyncing}
            className="group flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-2xl font-bold shadow-lg shadow-amber-100 hover:bg-amber-600 transition-all animate-in fade-in slide-in-from-right-4 duration-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            Sync to AI
          </button>
        )}
      </div>

      <div className="space-y-8">
        <AITraining 
            initialConfig={currentShop?.aiConfig} 
            shopId={effectiveShopId} 
            currentShop={currentShop}
            onUnsynced={() => setHasPendingSync(true)}
          />
      </div>
    </div>
  );
}
