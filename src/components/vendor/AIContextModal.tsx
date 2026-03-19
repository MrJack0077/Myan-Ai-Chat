import React from 'react';
import { X, Copy, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AIContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: string;
  jsonContext: string;
}

const AIContextModal: React.FC<AIContextModalProps> = ({ isOpen, onClose, context, jsonContext }) => {
  const [activeTab, setActiveTab] = React.useState<'text' | 'json'>('text');

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadJSON = () => {
    const blob = new Blob([jsonContext], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shop-context-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">AI Knowledge Base Context</h2>
              <p className="text-zinc-500 text-sm">Export your shop data for AI training</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-zinc-500" />
            </button>
          </div>

          <div className="flex border-b border-zinc-100">
            <button
              onClick={() => setActiveTab('text')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'text' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Text Context
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'json' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              JSON Data
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-zinc-50">
            <pre className="text-xs font-mono text-zinc-700 whitespace-pre-wrap bg-white p-4 rounded-xl border border-zinc-200">
              {activeTab === 'text' ? context : jsonContext}
            </pre>
          </div>

          <div className="p-6 border-t border-zinc-100 flex justify-end gap-3">
            <button
              onClick={() => copyToClipboard(activeTab === 'text' ? context : jsonContext)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy to Clipboard
            </button>
            {activeTab === 'json' && (
              <button
                onClick={downloadJSON}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                Download JSON
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AIContextModal;
