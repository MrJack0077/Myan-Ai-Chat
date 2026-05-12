import React, { useRef, useState } from 'react';
import { Trash2, Upload, FileText, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../../lib/firebase';
import { useToast } from '../../../../components/Toast';

export default function KBModal({
  isOpen,
  onClose,
  newKBItem,
  setNewKBItem,
  onSave,
  editingKBItemId,
  shopId
}: any) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-[0_20px_60px_rgb(0,0,0,0.08)] overflow-hidden border border-zinc-100 animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-900">{editingKBItemId ? t('common.edit', 'Edit') : t('ai_training.add_doc')}</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl transition-all">
            <span className="text-zinc-400 font-bold">✕</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">{t('ai_training.doc_title')}</label>
            <input 
              type="text" 
              value={newKBItem.title}
              onChange={(e) => setNewKBItem({ ...newKBItem, title: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
              placeholder="e.g. Return Policy Details"
            />
          </div>
          
          {newKBItem.type === 'text' && (
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">{t('ai_training.doc_content')}</label>
              <textarea 
                rows={4}
                value={newKBItem.content}
                onChange={(e) => setNewKBItem({ ...newKBItem, content: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm resize-none"
                placeholder="Paste text content here..."
              />
            </div>
          )}
          
          {newKBItem.type === 'url' && (
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">{t('ai_training.doc_url')}</label>
              <input 
                type="text" 
                value={newKBItem.url}
                onChange={(e) => setNewKBItem({ ...newKBItem, url: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                placeholder="https://example.com/info"
              />
            </div>
          )}
          
          {newKBItem.type === 'file' && (
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">File Upload</label>
              <div className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center bg-zinc-50 hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
                <p className="text-sm text-zinc-600 font-medium">Click to upload a document or image</p>
                <p className="text-xs text-zinc-400 mt-1">PDF, TXT, DOCX, JPG, PNG up to 5MB</p>
                <input 
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setIsUploading(true);
                      setUploadProgress(0);
                      try {
                        const fileRef = ref(storage, `shops/${shopId}/knowledgeBase/${Date.now()}_${file.name}`);
                        const uploadTask = uploadBytesResumable(fileRef, file);
                        
                        uploadTask.on('state_changed', 
                          (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(progress);
                          },
                          (error) => {
                            console.error('Upload failed', error);
                            setIsUploading(false);
                            showToast('Upload failed', 'error');
                          },
                          async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            setNewKBItem({ ...newKBItem, url: downloadURL, content: `Uploaded file: ${file.name}` });
                            setIsUploading(false);
                            showToast('File uploaded successfully', 'success');
                          }
                        );
                      } catch (err) {
                        console.error(err);
                        setIsUploading(false);
                        showToast('Upload failed', 'error');
                      }
                    }
                  }}
                />
                {isUploading && (
                  <div className="mt-4 w-full bg-zinc-200 rounded-full h-1.5">
                    <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                )}
                {newKBItem.url && newKBItem.type === 'file' && !isUploading && (
                  <p className="text-xs text-green-600 font-bold mt-3">File selected and uploaded successfully!</p>
                )}
              </div>
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <button 
              onClick={() => setNewKBItem({ ...newKBItem, type: 'text' })}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${newKBItem.type === 'text' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500'}`}
            >
              <FileText className="w-3.5 h-3.5" />
              Text
            </button>
            <button 
              onClick={() => setNewKBItem({ ...newKBItem, type: 'url' })}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${newKBItem.type === 'url' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500'}`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              URL
            </button>
            <button 
              onClick={() => setNewKBItem({ ...newKBItem, type: 'file' })}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${newKBItem.type === 'file' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500'}`}
            >
              <Upload className="w-3.5 h-3.5" />
              File
            </button>
          </div>
        </div>
        <div className="p-6 bg-zinc-50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-zinc-200 text-zinc-600 font-bold rounded-xl hover:bg-white transition-all"
          >
            {t('common.cancel')}
          </button>
          <button 
            onClick={onSave}
            disabled={!newKBItem.title || !newKBItem.content}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
