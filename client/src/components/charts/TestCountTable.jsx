import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { getDeptColor } from '../../utils/deptColors';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

export default function TestCountTable({ data }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;
  }

  const cols = data.length <= 2 ? 1 : 2;
  return (
    <div className="h-full overflow-hidden grid gap-3 auto-rows-fr" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {data.map((d, i) => {
        const color = getDeptColor(d.department, i);
        return (
          <div key={`${d.lab}-${d.department}`}
            className="rounded-xl bg-slate-50 overflow-hidden min-h-0 flex"
            style={{ borderLeft: `4px solid ${color}` }}
          >
            <div className="flex items-center justify-between gap-2 h-full w-full px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <h4 className="font-bold text-lg sm:text-xl truncate" style={{ color }}>{d.department}</h4>
                  <span className="text-xs text-slate-400 shrink-0">{d.lab}</span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-3xl sm:text-4xl font-bold text-slate-800 leading-none tracking-tight">
                    {fmt(d.today)}
                  </span>
                  <span className="text-sm font-medium text-slate-400">건</span>
                  <span className="text-sm text-slate-400 ml-2">월 {fmt(d.monthlyTotal)}</span>
                  <span className="text-sm text-slate-400">· 연 {fmt(d.annualTotal)}</span>
                </div>
              </div>
              <div className="w-24 sm:w-28 h-12 sm:h-14 shrink-0 opacity-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.recentDays || []}>
                    <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2.5} dot={false} />
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
