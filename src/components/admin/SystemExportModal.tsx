import React, { useState } from 'react';
import { X, Copy, Download, FileJson, Check } from 'lucide-react';
import { Shop } from '../../types';

interface SystemExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  shops: Shop[];
}

export default function SystemExportModal({ isOpen, onClose, shops }: SystemExportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const jsonContent = JSON.stringify({
    version: "1.0.0",
    exportDate: new Date().toISOString(),
    system: "Multi-Tenant Shop Manager",
    totalShops: shops.length,
    shops: shops.map(shop => ({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      status: shop.status,
      database: shop.databaseName,
      createdAt: shop.createdAt,
      chatwootId: shop.chatwootAccountId,
      vendor: {
        email: shop.vendorCredentials?.email
      }
    }))
  }, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonContent);
    setCopied(false);
    setTimeout(() => setCopied(true), 10);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">System Database Export</h3>
              <p className="text-sm text-slate-500">Full JSON representation of all shops and configurations</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all">
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          <div className="flex-1 bg-slate-900 p-6 rounded-2xl border border-slate-800 font-mono text-[10px] overflow-y-auto text-emerald-400 whitespace-pre">
            {jsonContent}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copied!' : 'Copy JSON'}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download .json
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
