import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ExerciseVolume } from '../../api/adminApi.ts';

interface ExerciseTotalsChartProps {
  data: ExerciseVolume[];
}

export function ExerciseTotalsChart({ data }: ExerciseTotalsChartProps) {
  return (
    <div className="bg-white rounded-3xl shadow-card px-5 py-5">
      <p className="text-sm font-semibold text-neutral-text mb-3">Суммарно выполнено</p>

      {data.length === 0 ? (
        <p className="text-sm text-neutral-secondary py-8 text-center">Нет данных</p>
      ) : (
        <div style={{ height: Math.max(56 * data.length, 140) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} />
              <YAxis
                type="category"
                dataKey="exercise"
                width={90}
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <Tooltip
                formatter={(value: number, _name: string, item: { payload?: ExerciseVolume }) => [
                  `${value.toLocaleString('ru-RU')} ${item.payload?.unit ?? ''}`,
                  '',
                ]}
                cursor={{ fill: '#F5F5F5' }}
              />
              <Bar dataKey="total" fill="#A3E635" radius={[0, 8, 8, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}