import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import { formatCurrency } from '../../utils/formatCurrency';
import { getDeptColor } from '../../utils/deptColors';

function getAchievementColor(rate) {
  if (rate >= 80) return '#22c55e';
  if (rate >= 50) return '#eab308';
  return '#ef4444';
}

export default function SalesDonut({ data }) {
  if (!data || !Array.isArray(data.departments)) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;
  }

  const { totalTarget = 0, totalActual = 0, achievementRate = 0, departments } = data;
  const pieData = [
    { name: '달성', value: totalActual },
    { name: '잔여', value: Math.max(totalTarget - totalActual, 0) },
  ];

  const stackData = departments.map((d) => ({
    name: d.name,
    value: d.actual,
    label: formatCurrency(d.actual),
  }));

  return (
    <div className="h-full flex flex-col gap-2">
      {/* 수치 표시 (3배 크기) */}
      <div className="flex items-center gap-5 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-gray-500">목표</span>
          <span className="text-3xl font-bold">{formatCurrency(totalTarget)}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-gray-500">달성</span>
          <span className="text-3xl font-bold">{formatCurrency(totalActual)}</span>
        </div>
        <div className="ml-auto font-bold text-5xl" style={{ color: getAchievementColor(achievementRate) }}>
          {achievementRate}%
        </div>
      </div>

      {/* 도넛 차트 */}
      <div className="flex-1 min-h-0 flex items-center">
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" startAngle={90} endAngle={-270}>
                <Cell fill={getAchievementColor(achievementRate)} />
                <Cell fill="#e2e8f0" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 부서별 가로 바 + 금액 표시 */}
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stackData} layout="vertical" margin={{ left: 10, right: 55, top: 5, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={65} tick={{ fontSize: 13 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {stackData.map((d, i) => <Cell key={i} fill={getDeptColor(d.name, i)} />)}
                <LabelList
                  dataKey="label"
                  position="right"
                  style={{ fontSize: 14, fill: '#1e293b', fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
