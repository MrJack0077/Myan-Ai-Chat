import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Activity, TrendingUp, AlertTriangle, MessageSquare, Users, Zap } from 'lucide-react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function VendorAnalytics({ shopId }: { shopId?: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTokens: 0,
    totalConversations: 0,
    resolutionRate: '0.0',
    escalationRate: '0.0',
    intentData: [] as any[],
    sentimentData: [] as any[],
    tokenUsageData: [] as any[]
  });

  useEffect(() => {
    if (!shopId) return;

    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        
        // Fetch shop data for tokens
        const shopDoc = await getDoc(doc(db, 'shops', shopId));
        const shopData = shopDoc.data();
        const totalTokens = shopData?.usedTokens || 0;

        // Fetch profiles (conversations)
        const profilesSnap = await getDocs(collection(db, 'shops', shopId, 'profiles'));
        const totalConversations = profilesSnap.size;

        // Fetch analytics events
        const analyticsSnap = await getDocs(collection(db, 'shops', shopId, 'analytics'));
        let escalations = 0;
        let orders = 0;
        
        analyticsSnap.forEach(doc => {
          const data = doc.data();
          if (data.event_type === 'ESCALATION') escalations++;
          if (data.event_type === 'ORDER_CONFIRMED') orders++;
        });

        // Calculate rates
        const escalationRate = totalConversations > 0 ? (escalations / totalConversations) * 100 : 0;
        const resolutionRate = totalConversations > 0 ? 100 - escalationRate : 0;

        // Intent Data
        const intentData = [
          { name: 'Order', value: orders },
          { name: 'Inquiry', value: Math.max(0, totalConversations - orders - escalations) },
          { name: 'Escalation', value: escalations },
        ].filter(item => item.value > 0);

        if (intentData.length === 0) {
          intentData.push({ name: 'No Data', value: 1 });
        }

        // Sentiment Data (Inferred from actions)
        const sentimentData = [
          { name: 'Positive', value: Math.max(0, orders * 2) }, // Orders imply positive sentiment
          { name: 'Neutral', value: Math.max(0, totalConversations - orders - escalations) },
          { name: 'Negative', value: escalations }, // Escalations imply negative/frustrated sentiment
        ].filter(item => item.value > 0);
        
        if (sentimentData.length === 0) {
          sentimentData.push({ name: 'No Data', value: 1 });
        }

        // Token Usage Data (Historical mock based on total, as we don't store daily tokens yet)
        const avgDaily = Math.round(totalTokens / 7);
        const tokenUsageData = [
          { name: 'Mon', tokens: avgDaily },
          { name: 'Tue', tokens: avgDaily },
          { name: 'Wed', tokens: avgDaily },
          { name: 'Thu', tokens: avgDaily },
          { name: 'Fri', tokens: avgDaily },
          { name: 'Sat', tokens: avgDaily },
          { name: 'Sun', tokens: avgDaily },
        ];

        setStats({
          totalTokens,
          totalConversations,
          resolutionRate: resolutionRate.toFixed(1),
          escalationRate: escalationRate.toFixed(1),
          intentData,
          sentimentData,
          tokenUsageData
        });

      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [shopId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm text-zinc-500 font-medium mb-1">Total Tokens Used</p>
          <h3 className="text-2xl font-bold text-zinc-900">{stats.totalTokens.toLocaleString()}</h3>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm text-zinc-500 font-medium mb-1">AI Conversations</p>
          <h3 className="text-2xl font-bold text-zinc-900">{stats.totalConversations.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm text-zinc-500 font-medium mb-1">AI Resolution Rate</p>
          <h3 className="text-2xl font-bold text-zinc-900">{stats.resolutionRate}%</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm text-zinc-500 font-medium mb-1">Human Escalations</p>
          <h3 className="text-2xl font-bold text-zinc-900">{stats.escalationRate}%</h3>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage Chart */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Token Usage</h3>
              <p className="text-sm text-zinc-500">Estimated daily API token consumption</p>
            </div>
            <TrendingUp className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.tokenUsageData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} dx={-10} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#e4e4e7', strokeWidth: 2 }}
                />
                <Line type="monotone" dataKey="tokens" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Intent Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Customer Intent</h3>
              <p className="text-sm text-zinc-500">What customers are asking about</p>
            </div>
            <Users className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.intentData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#3f3f46', fontSize: 12, fontWeight: 500 }} width={80} />
                <RechartsTooltip 
                  cursor={{ fill: '#f4f4f5' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24}>
                  {stats.intentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Analysis */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Customer Sentiment</h3>
              <p className="text-sm text-zinc-500">Overall mood of interactions (Inferred)</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 h-72">
            <div className="w-full md:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.sentimentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === 'Positive' ? '#10b981' : entry.name === 'Neutral' ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-emerald-700">Positive</span>
                </div>
                <p className="text-xs text-emerald-600">Customers who successfully placed orders.</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-amber-700">Neutral</span>
                </div>
                <p className="text-xs text-amber-600">Standard inquiries and product questions.</p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-red-700">Negative</span>
                </div>
                <p className="text-xs text-red-600">Customers who requested human support or escalated.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
