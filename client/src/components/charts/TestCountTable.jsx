import { LineChart, Line, ResponsiveContainer } from 'recharts';
import useDashboardStore from '../../stores/dashboardStore';
import { getDeptColor } from '../../utils/deptColors';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

export default function TestCountTable({ data, hideChart }) {
  const selectedYear = useDashboardStore((s) => s.selectedYear) || new Date().getFullYear();
  const yy = String(selectedYear).slice(-2);

  if (!Array.isArray(data) || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;
  }

  const cols = data.length <= 2 ? 1 : 2;
  return (
    <div className={`h-full overflow-hidden grid gap-2 auto-rows-fr`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {data.map((d, i) => {
        const color = getDeptColor(d.department, i);
        return (
          <div key={`${d.lab}-${d.department}`} className="border rounded-lg p-2 sm:p-3 min-h-0 overflow-hidden flex flex-col justify-start" style={{ borderColor: color + '40', background: color + '08' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-base sm:text-lg lg:text-xl truncate leading-tight" style={{ color }}>{d.department}</h4>
                <div className="text-[10px] sm:text-xs text-gray-400 leading-tight">{d.lab}연구소</div>

                <div className="mt-1.5 flex items-end gap-2 sm:gap-3">
                  {/* Hero: 오늘 */}
                  <div>
                    <div className="text-xl sm:text-2xl lg:text-3xl font-bold leading-none" style={{ color }}>
                      {fmt(d.today)}<span className="text-xs font-medium text-gray-500 ml-0.5">건</span>
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-gray-500 mt-1 font-medium leading-none">오늘</div>
                  </div>

                  <div className="w-px self-stretch bg-gray-200"></div>

                  {/* 당월 누적 */}
                  <div>
                    <div className="text-base sm:text-lg lg:text-xl font-bold leading-none text-gray-800">
                      {fmt(d.monthlyTotal)}<span className="text-[11px] font-medium text-gray-500 ml-0.5">건</span>
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-gray-500 mt-1 font-medium leading-none">당월 누적</div>
                  </div>

                  <div className="w-px self-stretch bg-gray-200"></div>

                  {/* 연 누적 */}
                  <div>
                    <div className="text-base sm:text-lg lg:text-xl font-bold leading-none text-gray-800">
                      {fmt(d.annualTotal)}<span className="text-[11px] font-medium text-gray-500 ml-0.5">건</span>
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-gray-500 mt-1 font-medium leading-none">{yy}년 누적</div>
                  </div>
                </div>
              </div>
              {!hideChart && (
                <div className="w-16 sm:w-20 lg:w-24 h-8 sm:h-10 lg:h-12 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={d.recentDays || []}>
                      <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
