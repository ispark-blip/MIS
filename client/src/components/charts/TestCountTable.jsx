import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { getDeptColor } from '../../utils/deptColors';

export default function TestCountTable({ data }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;
  }

  return (
    <div className="h-full overflow-auto grid grid-cols-2 gap-2 auto-rows-min">
      {data.map((d, i) => {
        const color = getDeptColor(d.department, i);
        return (
          <div key={`${d.lab}-${d.department}`} className="border rounded-lg p-2.5" style={{ borderColor: color + '40' }}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h4 className="font-bold text-sm truncate" style={{ color }}>{d.department}</h4>
                <div className="text-[10px] text-gray-400">{d.lab}연구소</div>
                <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                  <span className="text-xl font-bold">
                    {d.today}<span className="text-xs text-gray-500 ml-0.5">건</span>
                  </span>
                  <span className="text-[11px] text-gray-500">월 {d.monthlyTotal}</span>
                  <span className="text-[11px] text-gray-500">연 {d.annualTotal}</span>
                </div>
              </div>
              {/* 미니 라인 차트 */}
              <div className="w-20 h-10 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.recentDays || []}>
                    <Line type="monotone" dataKey="total" stroke={color} strokeWidth={1.5} dot={false} />
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
