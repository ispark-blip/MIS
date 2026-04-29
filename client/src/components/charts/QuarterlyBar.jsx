import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import useDashboardStore from '../../stores/dashboardStore';
import { formatCurrency, formatAxisLabel } from '../../utils/formatCurrency';
import { getDeptColor } from '../../utils/deptColors';

export default function QuarterlyBar({ data, horizontal }) {
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
      <div className="flex gap-1 sm:gap-2 shrink-0">
        {quarters.map((q) => (
          <button
            key={q}
            onClick={() => setSelectedQuarter(q)}
            className={`px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md font-semibold transition-colors ${
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
          {horizontal ? (
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 90, left: 5, bottom: 5 }}>
              <XAxis type="number" tickFormatter={formatAxisLabel} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 16, fontWeight: 700, fill: '#1e293b' }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="목표" fill="#cbd5e1" radius={[0, 2, 2, 0]} />
              <Bar dataKey="실적" radius={[0, 2, 2, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={getDeptColor(d.name, i)} />)}
                <LabelList
                  dataKey="actualLabel"
                  position="right"
                  style={{ fontSize: 16, fill: '#1e293b', fontWeight: 800 }}
                />
                <LabelList
                  dataKey="rate"
                  position="insideRight"
                  formatter={(v) => `${v}%`}
                  style={{ fontSize: 13, fill: '#ffffff', fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 30, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 16, fontWeight: 600 }} />
              <YAxis tickFormatter={formatAxisLabel} tick={{ fontSize: 13 }} width={55} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Bar dataKey="목표" fill="#cbd5e1" radius={[2, 2, 0, 0]}>
                <LabelList
                  dataKey="targetLabel"
                  position="top"
                  style={{ fontSize: 15, fill: '#64748b', fontWeight: 600 }}
                />
              </Bar>
              <Bar dataKey="실적" radius={[2, 2, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={getDeptColor(d.name, i)} />)}
                <LabelList
                  dataKey="actualLabel"
                  position="top"
                  style={{ fontSize: 17, fill: '#1e293b', fontWeight: 700 }}
                />
                <LabelList
                  dataKey="rate"
                  position="insideTop"
                  formatter={(v) => `${v}%`}
                  style={{ fontSize: 16, fill: '#ffffff', fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
