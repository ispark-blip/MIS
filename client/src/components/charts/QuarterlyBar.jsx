import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import useDashboardStore from '../../stores/dashboardStore';
import { formatCurrency, formatAxisLabel } from '../../utils/formatCurrency';
import { getDeptColor } from '../../utils/deptColors';

export default function QuarterlyBar({ data }) {
  const { selectedQuarter, setSelectedQuarter } = useDashboardStore();
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  if (!data || !Array.isArray(data.departments)) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;
  }

  const chartData = data.departments.map((d) => ({
    name: d.name,
    목표: d.target,
    실적: d.actual,
    rate: d.achievementRate,
    targetLabel: formatCurrency(d.target),
    actualLabel: formatCurrency(d.actual),
  }));

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      {/* 분기 선택 탭 */}
      <div className="flex gap-1.5 shrink-0">
        {quarters.map((q) => (
          <button
            key={q}
            onClick={() => setSelectedQuarter(q)}
            className={`px-4 sm:px-5 py-1.5 text-sm sm:text-base rounded-lg font-semibold transition-all ${
              selectedQuarter === q
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      {/* 그룹 바 차트 */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 35, right: 10, left: 0, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fontSize: 15, fontWeight: 600, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
            <YAxis tickFormatter={formatAxisLabel} tick={{ fontSize: 13, fill: '#94a3b8' }} width={55} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 14, color: '#64748b' }} />
            <Bar dataKey="목표" fill="#e2e8f0" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="targetLabel"
                position="top"
                style={{ fontSize: 14, fill: '#94a3b8', fontWeight: 600 }}
              />
            </Bar>
            <Bar dataKey="실적" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={getDeptColor(d.name, i)} />)}
              <LabelList
                dataKey="actualLabel"
                position="top"
                style={{ fontSize: 16, fill: '#1e293b', fontWeight: 700 }}
              />
              <LabelList
                dataKey="rate"
                position="insideTop"
                formatter={(v) => `${v}%`}
                style={{ fontSize: 15, fill: '#ffffff', fontWeight: 700 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
