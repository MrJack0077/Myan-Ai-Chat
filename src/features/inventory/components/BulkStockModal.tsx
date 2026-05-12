import React from 'react';
import { X, Save, Package, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface BulkStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  bulkStockData: { id: string, name: string, stock_quantity: number, price: number }[];
  setBulkStockData: (data: any[]) => void;
  handleBulkUpdate: (data: any[]) => Promise<void>;
  isSaving?: boolean;
  currency?: string;
}

export default function BulkStockModal({
  isOpen,
  onClose,
  bulkStockData,
  setBulkStockData,
  handleBulkUpdate,
  isSaving = false,
  currency = 'MMK'
}: BulkStockModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleInputChange = (id: string, field: 'stock_quantity' | 'price', value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    setBulkStockData(bulkStockData.map(item => 
      item.id === id ? { ...item, [field]: numValue } : item
    ));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-zinc-200">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">Bulk Inventory Update</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-xl transition-all">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="p-8">
          <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">
                  <th className="pb-3 px-2">Item Name</th>
                  <th className="pb-3 px-2 w-32">Stock</th>
                  <th className="pb-3 px-2 w-48 font-right">Price ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {bulkStockData.map(item => (
                  <tr key={item.id} className="hover:bg-zinc-50 transition-all">
                    <td className="py-4 px-2">
                      <span className="text-sm font-bold text-zinc-900">{item.name}</span>
                    </td>
                    <td className="py-4 px-2">
                      <input
                        type="number"
                        value={item.stock_quantity}
                        onChange={(e) => handleInputChange(item.id, 'stock_quantity', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm"
                      />
                    </td>
                    <td className="py-4 px-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-bold">
                          {currency}
                        </span>
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => handleInputChange(item.id, 'price', e.target.value)}
                          className="w-full pl-12 pr-3 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-zinc-600 hover:bg-zinc-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => handleBulkUpdate(bulkStockData)}
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all"
          >
            {isSaving ? 'Saving...' : (
              <>
                <Save className="w-4 h-4" />
                Update All Items
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
