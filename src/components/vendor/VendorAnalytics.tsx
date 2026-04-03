import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Activity, TrendingUp, AlertTriangle, MessageSquare, Users, Zap } from 'lucide-react';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function VendorAnalytics({ shopId }: { shopId?: string }) {
  const [isLoading, setIsLoading] = useState(true);

  // Mock data for analytics
  const tokenUsageData = [
    { name: 'Mon', tokens: 4000 },
    { name: 'Tue', tokens: 3000 },
    { name: 'Wed', tokens: 2000 },
    { name: 'Thu', tokens: 2780 },
    { name: 'Fri', tokens: 1890 },
    { name: 'Sat', tokens: 2390 },
    { name: 'Sun', tokens: 3490 },
  ];

  const intentData = [
    { name: 'Order', value: 400 },
    { name: 'Inquiry', value: 300 },
    { name: 'Complaint', value: 50 },
    { name: 'General', value: 200 },
  ];

  const sentimentData = [
    { name: 'Positive', value: 600 },
    { name: 'Neutral', value: 300 },
    { name: 'Negative', value: 100 },
  ];

  useEffect(() => {
    // Simulate fetching data
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
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
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">+12.5%</span>
          </div>
          <p className="text-sm text-zinc-500 font-medium mb-1">Total Tokens Used</p>
          <h3 className="text-2xl font-bold text-zinc-900">19,550</h3>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">+5.2%</span>
          </div>
          <p className="text-sm text-zinc-500 font-medium mb-1">AI Conversations</p>
          <h3 className="text-2xl font-bold text-zinc-900">1,240</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">98%</span>
          </div>
          <p className="text-sm text-zinc-500 font-medium mb-1">AI Resolution Rate</p>
          <h3 className="text-2xl font-bold text-zinc-900">92.4%</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">-2.1%</span>
          </div>
          <p className="text-sm text-zinc-500 font-medium mb-1">Human Escalations</p>
          <h3 className="text-2xl font-bold text-zinc-900">7.6%</h3>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage Chart */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Token Usage</h3>
              <p className="text-sm text-zinc-500">Daily API token consumption</p>
            </div>
            <TrendingUp className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tokenUsageData}>
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
              <BarChart data={intentData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#3f3f46', fontSize: 12, fontWeight: 500 }} width={80} />
                <RechartsTooltip 
                  cursor={{ fill: '#f4f4f5' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24}>
                  {intentData.map((entry, index) => (
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
              <p className="text-sm text-zinc-500">Overall mood of interactions</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 h-72">
            <div className="w-full md:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {sentimentData.map((entry, index) => (
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
                  <span className="font-bold text-emerald-700">60%</span>
                </div>
                <p className="text-xs text-emerald-600">Customers are highly satisfied with AI responses.</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-amber-700">Neutral</span>
                  <span className="font-bold text-amber-700">30%</span>
                </div>
                <p className="text-xs text-amber-600">Standard inquiries and order tracking requests.</p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-red-700">Negative</span>
                  <span className="font-bold text-red-700">10%</span>
                </div>
                <p className="text-xs text-red-600">Mostly related to delivery delays or out-of-stock items.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
