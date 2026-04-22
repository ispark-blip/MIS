import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { getDeptColor } from '../../utils/deptColors';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

export default function TestCountTable({ data }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;
  }

  const cols = data.length <= 2 ? 1 : 2;
  return (
    <div className={`h-full overflow-hidden grid gap-2 auto-rows-fr`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {data.map((d, i) => {
        const color = getDeptColor(d.department, i);
        return (
          <div key={`${d.lab}-${d.department}`} className="border rounded-lg p-3 sm:p-4 min-h-0 overflow-hidden" style={{ borderColor: color + '40' }}>
            <div className="flex items-center justify-between gap-2 h-full">
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-xl sm:text-2xl lg:text-3xl truncate" style={{ color }}>{d.department}</h4>
                <div className="text-sm text-gray-400">{d.lab}연구소</div>
                <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                  <span className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-none">
                    {fmt(d.today)}<span className="text-base text-gray-500 ml-1">건</span>
                  </span>
                  <span className="text-sm sm:text-base text-gray-500">월 {fmt(d.monthlyTotal)}</span>
                  <span className="text-sm sm:text-base text-gray-500">연 {fmt(d.annualTotal)}</span>
                </div>
              </div>
              {/* 미니 라인 차트 */}
              <div className="w-24 sm:w-28 lg:w-32 h-12 sm:h-14 lg:h-16 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.recentDays || []}>
                    <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
