import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, User, ShieldCheck, Minimize2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { sendMessage, subscribeToMessages, ChatMessage } from '../../services/supportService';
import { useTranslation } from 'react-i18next';

interface SupportChatProps {
  room: string;
  recipientName: string;
  senderRole: 'VENDOR' | 'ADMIN';
  onClose?: () => void;
  initialOpen?: boolean;
  embed?: boolean;
}

export default function SupportChat({ room, recipientName, senderRole, onClose, initialOpen = false, embed = false }: SupportChatProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(initialOpen || embed);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (room && isOpen) {
      const unsubscribe = subscribeToMessages(room, (newMessages) => {
        setMessages(newMessages);
      });

      return () => {
        unsubscribe();
      };
    }
  }, [room, isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (e?: React.FormEvent, customMessage?: string) => {
    if (e) e.preventDefault();
    const messageToSend = customMessage || message;
    if (!messageToSend.trim()) return;

    const senderName = senderRole === 'ADMIN' 
      ? 'Super Admin' 
      : (user?.shop?.name || user?.email || 'Vendor');

    const msgData: Omit<ChatMessage, 'id' | 'isRead' | 'timestamp'> = {
      sender: senderName,
      text: messageToSend.trim(),
      senderRole
    };

    try {
      await sendMessage(room, msgData);
      if (!customMessage) setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const quickReplies = senderRole === 'ADMIN' 
    ? ['Hello! How can I help you?', 'I am looking into your request.', 'Your issue has been resolved.', 'Please provide more details.']
    : ['I need help with my inventory.', 'How do I train my AI?', 'I have a billing question.', 'Can you check my shop status?'];

  if (!isOpen && !embed) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-indigo-700 transition-all z-50 group"
      >
        <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
      </button>
    );
  }

  const containerClasses = embed 
    ? "w-full h-full bg-white flex flex-col relative"
    : `fixed right-6 bottom-6 w-80 md:w-96 bg-white rounded-3xl shadow-2xl border border-zinc-200 z-50 flex flex-col transition-all duration-300 ${isMinimized ? 'h-16' : 'h-[500px]'}`;

  return (
    <div className={containerClasses}>
      {/* Header */}
      {!embed && (
        <div className="p-4 bg-zinc-900 text-white rounded-t-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
              {senderRole === 'ADMIN' ? <User className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-sm font-bold">{recipientName}</p>
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider">
                {senderRole === 'ADMIN' ? t('nav.shop_settings') : t('common.admin_portal')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                setIsOpen(false);
                if (onClose) onClose();
              }}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!isMinimized && (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 scroll-smooth">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="w-6 h-6 text-zinc-400" />
                </div>
                <p className="text-xs text-zinc-500">{t('support.no_messages')}</p>
              </div>
            )}
            {messages.map((msg, idx) => {
              const isMe = msg.senderRole === senderRole;
              const showSender = !isMe && (idx === 0 || messages[idx-1].senderRole !== msg.senderRole);
              
              return (
                <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {showSender && (
                    <span className="text-[10px] font-bold text-zinc-400 mb-1 px-1 uppercase tracking-wider">
                      {msg.sender}
                    </span>
                  )}
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                    isMe 
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-100' 
                      : 'bg-white text-zinc-900 rounded-tl-none border border-zinc-200 shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-zinc-400 mt-1 px-1">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {!isMinimized && messages.length > 0 && messages[messages.length-1].senderRole !== senderRole && (
            <div className="px-4 py-2 bg-white border-t border-zinc-50 flex gap-2 overflow-x-auto no-scrollbar">
              {quickReplies.map((reply, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(undefined, reply)}
                  className="whitespace-nowrap px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-full text-[10px] font-medium transition-all"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <form onSubmit={handleSend} className="p-4 border-t border-zinc-100 bg-white rounded-b-3xl">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('support.type_message')}
                className="flex-1 px-4 py-2 bg-zinc-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              <button
                type="submit"
                className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
