"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Metrics {
  successfulInterventions: number;
  blockedActions: number;
  escalationCount: number;
  duplicatePreventionCount: number;
  transactionCount: number;
}

interface OutcomeDistributionChartProps {
  metrics: Metrics;
}

export function OutcomeDistributionChart({ metrics }: OutcomeDistributionChartProps) {
  const otherCount = Math.max(0, metrics.transactionCount - (
    metrics.successfulInterventions + 
    metrics.blockedActions + 
    metrics.escalationCount + 
    metrics.duplicatePreventionCount
  ));

  const data = [
    { name: 'Successful', count: metrics.successfulInterventions, color: '#10B981' }, // emerald
    { name: 'Dup Prevented', count: metrics.duplicatePreventionCount, color: '#F59E0B' }, // amber
    { name: 'Escalated', count: metrics.escalationCount, color: '#2563EB' }, // blue
    { name: 'Blocked', count: metrics.blockedActions, color: '#EF4444' }, // red
    { name: 'Other', count: otherCount, color: '#9CA3AF' }, // gray
  ].filter(item => item.count > 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-500 bg-white rounded-xl border border-gray-200">
        No outcome data available
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#374151', fontSize: 12 }} />
          <Tooltip 
            cursor={{ fill: '#F3F4F6' }}
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}
            formatter={(value: unknown) => [Number(value), 'Transactions']}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
