import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import { formatCurrency } from '../../utils/formatCurrency';
import { getDeptColor } from '../../utils/deptColors';

function getAchievementColor(rate) {
  if (rate >= 80) return '#22c55e';
  if (rate >= 50) return '#eab308';
  return '#ef4444';
}

function DonutCenterLabel({ viewBox, achievementRate }) {
  if (!viewBox) return null;
  var cx = viewBox.cx;
  var cy = viewBox.cy;
  var r = viewBox.innerRadius || 80;
  var pctSize = Math.max(16, Math.min(r * 0.48, 44));
  var subSize = Math.max(9, Math.min(r * 0.15, 14));
  return (
    <g>
      <text x={cx} y={cy - subSize * 0.4} textAnchor="middle" dominantBaseline="central"
        fontSize={pctSize} fontWeight="700" fill={getAchievementColor(achievementRate)}>
        {achievementRate}%
      </text>
      <text x={cx} y={cy + pctSize * 0.55} textAnchor="middle" dominantBaseline="central"
        fontSize={subSize} fontWeight="500" fill="#94a3b8">
        목표달성률
      </text>
    </g>
  );
}

export default function SalesDonut({ data, layout }) {
  if (!data || !Array.isArray(data.departments)) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;
  }

  const { totalTarget = 0, totalActual = 0, achievementRate = 0, departments } = data;
  const pieData = [
    { name: '달성', value: totalActual },
    { name: '잔여', value: Math.max(totalTarget - totalActual, 0) },
  ];

  const stackData = departments.map((d) => {
    const pct = totalActual > 0 ? (d.actual / totalActual) * 100 : 0;
    const pctLabel = pct > 0 ? `${pct.toFixed(1)}%` : '';
    const amountLabel = formatCurrency(d.actual);
    return {
      name: d.name,
      value: d.actual,
      label: amountLabel,
      pctLabel,
      combinedLabel: pctLabel ? `${amountLabel}  ${pctLabel}` : amountLabel,
    };
  });

  if (layout === 'signage') {
    return (
      <div className="h-full flex flex-col gap-1 min-h-0">
        {/* 수치 표시 */}
        <div className="flex items-center justify-center gap-4 flex-wrap shrink-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm text-gray-500">목표</span>
            <span className="text-2xl font-bold">{formatCurrency(totalTarget)}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm text-gray-500">달성</span>
            <span className="text-2xl font-bold">{formatCurrency(totalActual)}</span>
          </div>
        </div>

        {/* 도넛 (상단) */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius="50%" outerRadius="92%" startAngle={90} endAngle={-270}>
                <Cell fill={getAchievementColor(achievementRate)} />
                <Cell fill="#e2e8f0" />
                <LabelList content={<DonutCenterLabel achievementRate={achievementRate} />} position="center" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 부서별 세로 바 (하단) */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stackData} margin={{ top: 22, right: 8, left: 8, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} interval={0} />
              <YAxis hide />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {stackData.map((d, i) => <Cell key={i} fill={getDeptColor(d.name, i)} />)}
                <LabelList
                  dataKey="combinedLabel"
                  position="top"
                  style={{ fontSize: 12, fill: '#1e293b', fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      {/* 수치 표시 */}
      <div className="flex items-center gap-3 sm:gap-5 flex-wrap shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm sm:text-base text-gray-500">목표</span>
          <span className="text-3xl sm:text-4xl lg:text-5xl font-bold">{formatCurrency(totalTarget)}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm sm:text-base text-gray-500">달성</span>
          <span className="text-3xl sm:text-4xl lg:text-5xl font-bold">{formatCurrency(totalActual)}</span>
        </div>
      </div>

      {/* 도넛 차트 */}
      <div className="flex-1 min-h-0 flex items-center">
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius="44%" outerRadius="90%" startAngle={90} endAngle={-270}>
                <Cell fill={getAchievementColor(achievementRate)} />
                <Cell fill="#e2e8f0" />
                <LabelList content={<DonutCenterLabel achievementRate={achievementRate} />} position="center" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 부서별 가로 바 + 금액 표시 */}
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stackData} layout="vertical" margin={{ left: 10, right: 110, top: 5, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 15, fontWeight: 600 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {stackData.map((d, i) => <Cell key={i} fill={getDeptColor(d.name, i)} />)}
                <LabelList
                  dataKey="combinedLabel"
                  position="right"
                  style={{ fontSize: 16, fill: '#1e293b', fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
