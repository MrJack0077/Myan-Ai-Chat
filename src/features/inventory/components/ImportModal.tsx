import React, { useState } from 'react';
import { X, FileJson, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { VendorItem } from '../../../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: Partial<VendorItem>[]) => Promise<void>;
  isImporting: boolean;
}

export default function ImportModal({ isOpen, onClose, onImport, isImporting }: ImportModalProps) {
  const { t } = useTranslation();
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleImport = async () => {
    setError(null);
    setSuccess(false);
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) {
        throw new Error('Input must be a JSON array of items.');
      }
      
      await onImport(parsed);
      setSuccess(true);
      setJsonInput('');
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Invalid JSON format');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <FileJson className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900">Import Inventory JSON</h3>
              <p className="text-xs text-zinc-500">Paste your JSON array to bulk import items</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition-all">
            <X className="w-6 h-6 text-zinc-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative">
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='[
  {
    "name": "Galaxy A51",
    "price": 1500000,
    "description": "Good camera...",
    "brand": "Samsung",
    "category": "samsung",
    "status": "active",
    "is_available": true
  }
]'
              className="w-full h-64 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-medium">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-xs font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Import successful! Refreshing data...
            </div>
          )}
        </div>

        <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting || !jsonInput.trim() || success}
            className={`flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 ${
              isImporting || !jsonInput.trim() || success ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isImporting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {isImporting ? 'Importing...' : 'Start Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
