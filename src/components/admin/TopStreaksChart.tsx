import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TopStreakUser } from '../../api/adminApi.ts';

interface TopStreaksChartProps {
  data: TopStreakUser[];
}

export function TopStreaksChart({ data }: TopStreaksChartProps) {
  return (
    <div className="bg-white rounded-3xl shadow-card px-5 py-5">
      <p className="text-sm font-semibold text-neutral-text mb-3">Топ-3 по самому длинному стрику</p>

      {data.length === 0 ? (
        <p className="text-sm text-neutral-secondary py-8 text-center">Нет данных</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="username" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} />
              <Tooltip
                formatter={(value: number) => [`${value} дней`, 'Стрик']}
                cursor={{ fill: '#F5F5F5' }}
              />
              <Bar dataKey="streak_longest" fill="#FF5722" radius={[8, 8, 0, 0]} maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}