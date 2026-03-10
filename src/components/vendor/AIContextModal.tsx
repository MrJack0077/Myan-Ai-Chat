import React, { useState } from 'react';
import { X, Copy, Download, FileJson, FileText, Check } from 'lucide-react';

interface AIContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: string;
  jsonContext: string;
}

export default function AIContextModal({ isOpen, onClose, context, jsonContext }: AIContextModalProps) {
  const [format, setFormat] = useState<'text' | 'json'>('text');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const activeContent = format === 'text' ? context : jsonContext;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeContent], { type: format === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shop-knowledge-base.${format === 'json' ? 'json' : 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-zinc-900">Knowledge Base Export</h3>
              <p className="text-sm text-zinc-500">Export your shop data for AI training or backup</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-all">
              <X className="w-6 h-6 text-zinc-400" />
            </button>
          </div>

          <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl mb-6 w-fit">
            <button
              onClick={() => setFormat('text')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                format === 'text' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Plain Text
            </button>
            <button
              onClick={() => setFormat('json')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                format === 'json' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <FileJson className="w-3.5 h-3.5" />
              JSON Data
            </button>
          </div>
          
          <div className="flex-1 bg-zinc-900 p-6 rounded-2xl border border-zinc-800 font-mono text-xs overflow-y-auto text-zinc-300 whitespace-pre-wrap">
            {activeContent}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-zinc-200 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download .{format === 'json' ? 'json' : 'txt'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold text-zinc-600 hover:bg-zinc-100 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
