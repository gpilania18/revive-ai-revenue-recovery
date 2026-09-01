"use client";

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatINR } from '@/lib/format';

interface Metrics {
  revenueRecoveredPaise: number;
  recoveryRate: number;
  successfulInterventions: number;
  blockedActions: number;
  escalationCount: number;
}

interface RecoveryPerformanceChartProps {
  baselineMetrics: Metrics;
  reviveMetrics: Metrics;
}

export function RecoveryPerformanceChart({
  baselineMetrics,
  reviveMetrics,
}: RecoveryPerformanceChartProps) {
  const [mode, setMode] = useState<'revenue' | 'rate'>('revenue');

  // Map aggregate metrics into an array suitable for Recharts comparison
  const data = [
    {
      name: 'Revenue (₹)',
      baseline: baselineMetrics.revenueRecoveredPaise / 100,
      revive: reviveMetrics.revenueRecoveredPaise / 100,
    },
    {
      name: 'Success Rate (%)',
      baseline: baselineMetrics.recoveryRate,
      revive: reviveMetrics.recoveryRate,
    },
    {
      name: 'Interventions',
      baseline: baselineMetrics.successfulInterventions,
      revive: reviveMetrics.successfulInterventions,
    },
    {
      name: 'Safety (Blocked)',
      baseline: baselineMetrics.blockedActions,
      revive: reviveMetrics.blockedActions,
    },
    {
      name: 'Escalations',
      baseline: baselineMetrics.escalationCount,
      revive: reviveMetrics.escalationCount,
    },
  ];

  const formatTooltip = (value: unknown, name: unknown) => {
    const v = Number(value);
    if (name === 'Baseline' || name === 'REVIVE') {
      return [v.toLocaleString("en-IN"),String(name)];
    }
    return [v, String(name)];
  };

  return (
    <div className="w-full">
      <div className="flex justify-end mb-4">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => setMode('revenue')}
            className={`px-4 py-2 text-sm font-medium border border-gray-200 rounded-l-lg ${
              mode === 'revenue'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-white text-gray-900 hover:bg-gray-50'
            }`}
          >
            Revenue
          </button>
          <button
            type="button"
            onClick={() => setMode('rate')}
            className={`px-4 py-2 text-sm font-medium border border-l-0 border-gray-200 rounded-r-lg ${
              mode === 'rate'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-white text-gray-900 hover:bg-gray-50'
            }`}
          >
            Rate
          </button>
        </div>
      </div>
      
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={mode === 'revenue' ? [data[0]] : data.slice(1)}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
            <Tooltip
              formatter={formatTooltip}
              contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}
              cursor={{ fill: '#F3F4F6' }}
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
            <Bar dataKey="baseline" name="Baseline" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            <Bar dataKey="revive" name="REVIVE" fill="#2563EB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
