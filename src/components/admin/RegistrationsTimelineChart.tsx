import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Tabs } from '../ui/Tabs.tsx';
import type { RegistrationPoint } from '../../api/adminApi.ts';

type Granularity = 'day' | 'week' | 'month';

interface RegistrationsTimelineChartProps {
  data: RegistrationPoint[];
}

interface Bucket {
  label: string;
  count: number;
}

// Groups the daily series the backend returns into week/month buckets.
// Done client-side (plain Date math, no extra date library) so the backend
// only ever needs the one simple daily query.
function bucketize(points: RegistrationPoint[], granularity: Granularity): Bucket[] {
  if (granularity === 'day') {
    return points.map((p) => ({ label: formatDay(p.date), count: p.count }));
  }

  const buckets = new Map<string, number>();
  for (const point of points) {
    const date = new Date(`${point.date}T00:00:00Z`);
    const key = granularity === 'week' ? weekKey(date) : monthKey(date);
    buckets.set(key, (buckets.get(key) ?? 0) + point.count);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, count]) => ({
      label: granularity === 'week' ? formatDay(key) : formatMonth(key),
      count,
    }));
}

function weekKey(date: Date): string {
  // Monday of that ISO week, as yyyy-mm-dd.
  const day = date.getUTCDay() || 7; // Sunday(0) -> 7
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - day + 1);
  return monday.toISOString().slice(0, 10);
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatDay(iso: string): string {
  const parts = iso.split('-');
  return `${parts[2]}.${parts[1]}`;
}

function formatMonth(key: string): string {
  const m = key.split('-')[1];
  const names = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${names[Number(m) - 1]} ${key.split('-')[0]}`;
}

export function RegistrationsTimelineChart({ data }: RegistrationsTimelineChartProps) {
  const [granularity, setGranularity] = useState<Granularity>('day');

  const buckets = useMemo(() => bucketize(data, granularity), [data, granularity]);

  return (
    <div className="bg-white rounded-3xl shadow-card px-5 py-5">
      <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
        <p className="text-sm font-semibold text-neutral-text">Регистрации пользователей</p>
        <Tabs
          className="w-auto"
          tabs={[
            { id: 'day', label: 'Дни' },
            { id: 'week', label: 'Недели' },
            { id: 'month', label: 'Месяцы' },
          ]}
          activeTab={granularity}
          onChange={(id) => setGranularity(id as Granularity)}
        />
      </div>

      {buckets.length === 0 ? (
        <p className="text-sm text-neutral-secondary py-8 text-center">Нет данных</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} />
              <Tooltip formatter={(value: number) => [value, 'Новых пользователей']} cursor={{ fill: '#F5F5F5' }} />
              <Bar dataKey="count" fill="#FF5722" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}