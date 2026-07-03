import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { PieSlice } from '../../api/adminApi.ts';

const COLORS = ['#FF5722', '#A3E635', '#F5CB91', '#6B7280'];

interface PieStatCardProps {
  title: string;
  data: PieSlice[];
}

export function PieStatCard({ title, data }: PieStatCardProps) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="bg-white rounded-3xl shadow-card px-5 py-5">
      <p className="text-sm font-semibold text-neutral-text mb-3">{title}</p>

      {total === 0 ? (
        <p className="text-sm text-neutral-secondary py-8 text-center">Нет данных</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="w-28 h-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={28}
                  outerRadius={48}
                  paddingAngle={2}
                >
                  {data.map((slice, i) => (
                    <Cell key={slice.label} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value.toLocaleString('ru-RU'), '']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="flex-1 space-y-1.5">
            {data.map((slice, i) => (
              <li key={slice.label} className="flex items-center gap-2 text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-neutral-secondary flex-1">{slice.label}</span>
                <span className="font-semibold text-neutral-text">{slice.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}