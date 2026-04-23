import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import { formatCurrency } from '../../utils/formatCurrency';
import { getDeptColor } from '../../utils/deptColors';

function getAchievementColor(rate) {
  if (rate >= 80) return '#16a34a';
  if (rate >= 50) return '#ca8a04';
  return '#dc2626';
}

function DonutCenterLabel({ viewBox, achievementRate }) {
  const { cx, cy, innerRadius } = viewBox;
  const r = innerRadius || 80;
  const pctSize = Math.max(16, Math.min(r * 0.48, 44));
  const subSize = Math.max(9, Math.min(r * 0.15, 14));
  return (
    <g>
      <text x={cx} y={cy - subSize * 0.4} textAnchor="middle" dominantBaseline="central"
        fontSize={pctSize} fontWeight="700" fill={getAchievementColor(achievementRate)}
        style={{ letterSpacing: '-0.02em' }}>
        {achievementRate}%
      </text>
      <text x={cx} y={cy + pctSize * 0.55} textAnchor="middle" dominantBaseline="central"
        fontSize={subSize} fontWeight="500" fill="#94a3b8">
        목표달성률
      </text>
    </g>
  );
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
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* 수치 표시 */}
      <div className="flex items-end gap-6 sm:gap-8 shrink-0">
        <div>
          <span className="text-sm sm:text-base font-medium text-slate-400 tracking-wider">목표</span>
          <div className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-800 leading-tight tracking-tight">
            {formatCurrency(totalTarget)}
          </div>
        </div>
        <div>
          <span className="text-sm sm:text-base font-medium text-slate-400 tracking-wider">달성</span>
          <div className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-800 leading-tight tracking-tight">
            {formatCurrency(totalActual)}
          </div>
        </div>
      </div>

      {/* 도넛 차트 + 바 차트 */}
      <div className="flex-1 min-h-0 flex items-center">
        <div className="w-[45%] h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius="44%"
                outerRadius="90%"
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                <Cell fill={getAchievementColor(achievementRate)} />
                <Cell fill="#e5e7eb" />
                <LabelList content={<DonutCenterLabel achievementRate={achievementRate} />} position="center" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 부서별 가로 바 */}
        <div className="w-[55%] h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stackData} layout="vertical" margin={{ left: 5, right: 70, top: 5, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={90}
                tick={{ fontSize: 15, fontWeight: 600, fill: '#475569' }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                {stackData.map((d, i) => <Cell key={i} fill={getDeptColor(d.name, i)} />)}
                <LabelList
                  dataKey="label"
                  position="right"
                  style={{ fontSize: 15, fill: '#334155', fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
