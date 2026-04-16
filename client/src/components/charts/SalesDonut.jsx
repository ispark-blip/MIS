import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '../../utils/formatCurrency';

const COLORS = ['#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444', '#6366f1'];

function getAchievementColor(rate) {
  if (rate >= 80) return '#22c55e';
  if (rate >= 50) return '#eab308';
  return '#ef4444';
}

export default function SalesDonut({ data }) {
  if (!data) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;

  const { totalTarget, totalActual, achievementRate, departments } = data;
  const pieData = [
    { name: '달성', value: totalActual },
    { name: '잔여', value: Math.max(totalTarget - totalActual, 0) },
  ];

  const stackData = departments.map((d) => ({ name: d.name, value: d.actual }));

  return (
    <div className="h-full flex flex-col gap-2">
      {/* 수치 표시 */}
      <div className="flex items-center gap-4 text-sm">
        <div><span className="text-gray-500">목표</span> <span className="font-bold">{formatCurrency(totalTarget)}</span></div>
        <div><span className="text-gray-500">달성</span> <span className="font-bold">{formatCurrency(totalActual)}</span></div>
        <div className="ml-auto font-bold text-lg" style={{ color: getAchievementColor(achievementRate) }}>
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

        {/* 부서별 스택바 */}
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stackData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {stackData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
