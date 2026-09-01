"use client";

import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatFailureType } from '@/lib/format';

interface Transaction {
  failureType: string;
}

interface FailureDistributionChartProps {
  transactions: Transaction[];
}

const COLORS = ['#2563EB', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280', '#14B8A6'];

export function FailureDistributionChart({ transactions }: FailureDistributionChartProps) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    
    transactions.forEach((tx) => {
      const type = tx.failureType || 'UNKNOWN_FAILURE';
      counts[type] = (counts[type] || 0) + 1;
      total++;
    });

    return Object.entries(counts)
      .map(([type, count]) => {
        return {
          name: formatFailureType(type),
          value: count,
          percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-500 bg-white rounded-xl border border-gray-200">
        No failure data available
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: unknown, name: unknown) => [
              `${Number(value)} transactions`, 
              String(name)
            ]}
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}
          />
          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
