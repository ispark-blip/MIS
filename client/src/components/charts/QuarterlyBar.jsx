import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import useDashboardStore from '../../stores/dashboardStore';
import { formatCurrency, formatAxisLabel } from '../../utils/formatCurrency';

export default function QuarterlyBar({ data }) {
  const { selectedQuarter, setSelectedQuarter } = useDashboardStore();
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  if (!data) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;

  const chartData = (data.departments || []).map((d) => ({
    name: d.name,
    목표: d.target,
    실적: d.actual,
    rate: d.achievementRate,
    targetLabel: formatCurrency(d.target),
    actualLabel: formatCurrency(d.actual),
  }));

  return (
    <div className="h-full flex flex-col gap-2">
      {/* 분기 선택 탭 */}
      <div className="flex gap-1">
        {quarters.map((q) => (
          <button
            key={q}
            onClick={() => setSelectedQuarter(q)}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
              selectedQuarter === q ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      {/* 그룹 바 차트 */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 25, right: 10, left: 0, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatAxisLabel} tick={{ fontSize: 10 }} width={45} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="목표" fill="#cbd5e1" radius={[2, 2, 0, 0]}>
              <LabelList
                dataKey="targetLabel"
                position="top"
                style={{ fontSize: 10, fill: '#64748b' }}
              />
            </Bar>
            <Bar dataKey="실적" fill="#3b82f6" radius={[2, 2, 0, 0]}>
              <LabelList
                dataKey="actualLabel"
                position="top"
                style={{ fontSize: 10, fill: '#1e40af', fontWeight: 600 }}
              />
              <LabelList
                dataKey="rate"
                position="insideTop"
                formatter={(v) => `${v}%`}
                style={{ fontSize: 9, fill: '#ffffff' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
