import React, { useState, useEffect } from 'react';
import { RefreshCcw, Activity, Terminal, Mail } from 'lucide-react';

interface WebhookLog {
  time: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  data: any;
  error: string | null;
}

const DebugPage: React.FC = () => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [expressStatus, setExpressStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      // Express health check (not proxied)
      const exRes = await fetch('/api/health');
      setExpressStatus(exRes.ok ? 'online' : 'offline');

      // Backend health check (proxied)
      const res = await fetch('/webhook');
      const contentType = res.headers.get("content-type");
      
      if (res.ok && contentType && contentType.includes("application/json")) {
        setStatus('online');
        setErrorMsg(null);
      } else {
        setStatus('offline');
        if (!contentType || !contentType.includes("application/json")) {
            setErrorMsg("Invalid backend response (not JSON). Routing issue?");
        } else {
            const errorData = await res.json().catch(() => ({}));
            setErrorMsg(errorData.details || errorData.message || 'FastAPI not responding correctly');
        }
      }
    } catch (err: any) {
      setStatus('offline');
      setErrorMsg(err.message);
    }
  };

  const manualPing = async () => {
    try {
      const res = await fetch('/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: "manual_ping", time: new Date().toISOString() })
      });
      
      if (res.ok) {
          fetchLogs();
      } else {
          const text = await res.text();
          console.error("Ping error:", text);
          alert("Ping failed with status " + res.status);
      }
    } catch (err: any) {
      alert("Ping failed: " + err.message);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/webhook/logs');
      const contentType = res.headers.get("content-type");
      
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setLogs(data.logs || []);
      } else {
        console.error("Failed to fetch logs: Invalid response", res.status, contentType);
      }
    } catch (err) {
      console.error("Failed to fetch logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const webhookUrl = `${currentOrigin}/webhook`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    alert("Copied to clipboard!");
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto font-sans bg-[#FDFDFF] min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <Terminal className="w-6 h-6 text-indigo-600" />
            Backend Debugging & Webhooks
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Monitor system health and chatbot events in real-time.</p>
        </div>
        <div className="flex gap-2">
          <button 
            className="flex items-center px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-all shadow-sm active:scale-95"
            onClick={manualPing}
          >
            <Activity className="w-4 h-4 mr-2" />
            Manual Ping
          </button>
          <button 
            className="flex items-center px-4 py-2 text-sm font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-all shadow-sm active:scale-95"
            onClick={() => { checkStatus(); fetchLogs(); }}
          >
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden h-fit flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
            <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              Environment Status
            </h2>
          </div>
          <div className="p-4 space-y-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between font-medium">
                <span className="text-sm text-zinc-500">Express Server</span>
                {expressStatus === 'online' ? (
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full">ACTIVE</span>
                ) : (
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 rounded-full uppercase">Down</span>
                )}
              </div>
              <div className="flex items-center justify-between font-medium">
                <span className="text-sm text-zinc-500">FastAPI (Proxied)</span>
                {status === 'loading' ? (
                  <span className="px-2.5 py-0.5 text-[10px] bg-zinc-100 text-zinc-600 rounded">...</span>
                ) : status === 'online' ? (
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full uppercase">Connected</span>
                ) : (
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 rounded-full uppercase">Error</span>
                )}
              </div>
              {errorMsg && (
                <div className="mt-2 text-[10px] bg-rose-50 text-rose-600 p-3 rounded-lg font-mono break-all border border-rose-100/50 whitespace-pre-wrap leading-relaxed">
                  <span className="font-bold">Info:</span> {errorMsg}
                </div>
              )}
            </div>

            <div className="pt-5 border-t border-zinc-100">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">MyanSocial Webhook URL</label>
              <div className="flex items-center gap-2">
                  <input 
                    readOnly 
                    value={webhookUrl}
                    className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-600 font-mono focus:outline-none"
                  />
                  <button 
                    className="p-2 text-zinc-400 hover:text-indigo-600 bg-white border border-zinc-200 rounded-lg hover:bg-indigo-50 transition-colors"
                    onClick={copyToClipboard}
                    title="Copy URL"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
              </div>
              <div className="mt-4 text-[11px] text-zinc-600 bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100/50 leading-relaxed shadow-sm">
                <span className="font-bold text-indigo-700 flex items-center gap-1.5 mb-1.5">
                  <Activity className="w-3.5 h-3.5" /> Setup Guide
                </span>
                Go to SendPulse Bot Settings &gt; Webhooks and paste this URL. Events will appear here instantly.
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-zinc-500" />
              Recent Webhook Payloads
            </h2>
            <span className="px-2 py-0.5 text-[10px] bg-zinc-100 text-zinc-500 rounded font-medium">{logs.length} logs cached</span>
          </div>
          <div className="p-4 flex-1">
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {logs.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-zinc-100 rounded-xl">
                  <Mail className="w-10 h-10 text-zinc-200 mx-auto mb-4" />
                  <p className="text-sm font-medium text-zinc-600">Waiting for data...</p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-[200px] mx-auto">Send a message to your chatbot to trigger a webhook event.</p>
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="bg-zinc-900 rounded-lg p-4 text-[11px] font-mono text-zinc-300 border border-zinc-800 shadow-lg">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                      <div className="flex items-center gap-4">
                        <span className="text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-400/10 rounded">{log.method}</span>
                        <span className="text-indigo-400">{log.path}</span>
                        <span className="text-zinc-500">{new Date(log.time).toLocaleTimeString()}</span>
                      </div>
                      {log.error ? (
                         <span className="text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-bold">ERROR: {log.error}</span>
                      ) : (
                         <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-bold">ACKNOWLEDGED</span>
                      )}
                    </div>
                    <div>
                        <p className="text-zinc-500 mb-2 uppercase text-[9px] font-bold tracking-widest text-left">Payload Data</p>
                        <pre className="bg-zinc-950/50 p-3 rounded border border-zinc-800/50 overflow-x-auto whitespace-pre-wrap max-h-[300px] text-zinc-400 text-left">
                            {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : log.data}
                        </pre>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugPage;
