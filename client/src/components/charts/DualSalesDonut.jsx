import { PieChart, Pie, Cell, ResponsiveContainer, LabelList } from 'recharts';
import { formatCurrency } from '../../utils/formatCurrency';
import { getDeptColor } from '../../utils/deptColors';

const ALTRU_LAB = '얼트루';

function getAchievementColor(rate) {
  if (rate >= 80) return '#22c55e';
  if (rate >= 50) return '#eab308';
  return '#ef4444';
}

function PctCenterLabel({ viewBox, achievementRate }) {
  if (!viewBox) return null;
  const cx = viewBox.cx;
  const cy = viewBox.cy;
  const r = viewBox.innerRadius || 60;
  const pctSize = Math.max(16, Math.min(r * 0.45, 38));
  const subSize = Math.max(9, Math.min(r * 0.16, 13));
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

function AmountCenterLabel({ viewBox, amount }) {
  if (!viewBox) return null;
  const cx = viewBox.cx;
  const cy = viewBox.cy;
  const r = viewBox.innerRadius || 60;
  const amtSize = Math.max(14, Math.min(r * 0.38, 30));
  const subSize = Math.max(9, Math.min(r * 0.16, 13));
  return (
    <g>
      <text x={cx} y={cy - subSize * 0.4} textAnchor="middle" dominantBaseline="central"
        fontSize={amtSize} fontWeight="700" fill="#1e293b">
        {formatCurrency(amount)}
      </text>
      <text x={cx} y={cy + amtSize * 0.65} textAnchor="middle" dominantBaseline="central"
        fontSize={subSize} fontWeight="500" fill="#94a3b8">
        현재 매출
      </text>
    </g>
  );
}

function DeptLegend({ depts, totalActual }) {
  if (!depts || depts.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:text-sm shrink-0">
      {depts.map((d, i) => {
        const c = getDeptColor(d.name, i);
        const pct = totalActual > 0 ? ((d.actual / totalActual) * 100).toFixed(1) : '0';
        return (
          <div key={d.name} className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c }}></span>
            <span className="truncate text-gray-700 font-medium">{d.name}</span>
            <span className="ml-auto text-gray-800 font-semibold whitespace-nowrap">{formatCurrency(d.actual)}</span>
            <span className="text-gray-400 text-[10px] sm:text-xs whitespace-nowrap">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function KdriPanel({ depts, totalTarget, totalActual, achievementRate }) {
  const slices = [
    ...depts
      .filter((d) => d.actual > 0)
      .map((d, i) => ({ name: d.name, value: d.actual, fill: getDeptColor(d.name, i) })),
  ];
  const remaining = Math.max(totalTarget - totalActual, 0);
  if (remaining > 0) slices.push({ name: '잔여', value: remaining, fill: '#e2e8f0' });
  if (slices.length === 0) slices.push({ name: '데이터 없음', value: 1, fill: '#e2e8f0' });

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
      <div className="flex items-baseline justify-center gap-2 shrink-0">
        <span className="text-base sm:text-lg font-bold text-slate-800">한피연</span>
      </div>
      <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap shrink-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs sm:text-sm text-gray-500">목표</span>
          <span className="text-xl sm:text-2xl lg:text-3xl font-bold">{formatCurrency(totalTarget)}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs sm:text-sm text-gray-500">달성</span>
          <span className="text-xl sm:text-2xl lg:text-3xl font-bold">{formatCurrency(totalActual)}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" cx="50%" cy="50%" innerRadius="55%" outerRadius="92%" startAngle={90} endAngle={-270} stroke="none">
              {slices.map((s, i) => <Cell key={i} fill={s.fill} />)}
              <LabelList content={<PctCenterLabel achievementRate={achievementRate} />} position="center" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <DeptLegend depts={depts.filter((d) => d.actual > 0)} totalActual={totalActual} />
    </div>
  );
}

function AltruPanel({ depts, totalActual }) {
  const positiveDepts = depts.filter((d) => d.actual > 0);
  const slices = positiveDepts.length > 0
    ? positiveDepts.map((d, i) => ({ name: d.name, value: d.actual, fill: getDeptColor(d.name, i) }))
    : [{ name: '얼트루 매출', value: totalActual > 0 ? totalActual : 1, fill: totalActual > 0 ? '#6366f1' : '#e2e8f0' }];

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
      <div className="flex items-baseline justify-center gap-2 shrink-0">
        <span className="text-base sm:text-lg font-bold text-slate-800">얼트루</span>
      </div>
      <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap shrink-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs sm:text-sm text-gray-500">매출</span>
          <span className="text-xl sm:text-2xl lg:text-3xl font-bold">{formatCurrency(totalActual)}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" cx="50%" cy="50%" innerRadius="55%" outerRadius="92%" startAngle={90} endAngle={-270} stroke="none">
              {slices.map((s, i) => <Cell key={i} fill={s.fill} />)}
              <LabelList content={<AmountCenterLabel amount={totalActual} />} position="center" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      {positiveDepts.length > 0
        ? <DeptLegend depts={positiveDepts} totalActual={totalActual} />
        : <div className="text-center text-xs text-gray-400 shrink-0">부서별 데이터 입력 시 표시됩니다</div>}
    </div>
  );
}

export default function DualSalesDonut({ data }) {
  if (!data || !Array.isArray(data.departments)) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;
  }

  const kdriDepts = data.departments.filter((d) => d.lab !== ALTRU_LAB);
  const altruDepts = data.departments.filter((d) => d.lab === ALTRU_LAB);

  const kdriTotalTarget = kdriDepts.reduce((s, d) => s + (d.target || 0), 0);
  const kdriTotalActual = kdriDepts.reduce((s, d) => s + (d.actual || 0), 0);
  const kdriRate = kdriTotalTarget > 0 ? Math.round((kdriTotalActual / kdriTotalTarget) * 1000) / 10 : 0;

  const altruTotalActual = altruDepts.reduce((s, d) => s + (d.actual || 0), 0);

  return (
    <div className="h-full flex gap-3 sm:gap-4 min-h-0">
      <KdriPanel depts={kdriDepts} totalTarget={kdriTotalTarget} totalActual={kdriTotalActual} achievementRate={kdriRate} />
      <div className="w-px self-stretch bg-gray-300 shrink-0"></div>
      <AltruPanel depts={altruDepts} totalActual={altruTotalActual} />
    </div>
  );
}
