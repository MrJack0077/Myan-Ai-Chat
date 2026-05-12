import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';

interface ShopBulkActionsBarProps {
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleBulkStatus: (status: string) => void;
  handleBulkDelete: () => void;
}

export default function ShopBulkActionsBar({
  selectedIds,
  setSelectedIds,
  handleBulkStatus,
  handleBulkDelete
}: ShopBulkActionsBarProps) {
  return (
    <AnimatePresence>
      {selectedIds.size > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 lg:left-[calc(50%+128px)] z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 border border-white/10"
        >
          <div className="flex items-center gap-2 border-r border-white/20 pr-6">
            <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{selectedIds.size}</span>
            <span className="text-sm font-medium">Selected</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => handleBulkStatus('active')} className="text-sm font-medium hover:text-emerald-400 transition-colors flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Activate
            </button>
            <button onClick={() => handleBulkStatus('suspended')} className="text-sm font-medium hover:text-amber-400 transition-colors flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> Suspend
            </button>
            <button onClick={handleBulkDelete} className="text-sm font-medium hover:text-red-400 transition-colors flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
          
          <button 
            onClick={() => setSelectedIds(new Set())}
            className="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
