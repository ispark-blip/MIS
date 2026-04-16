import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { getDeptColor } from '../../utils/deptColors';

export default function TestCountTable({ data }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;
  }

  return (
    <div className="h-full overflow-auto grid grid-cols-2 gap-3 auto-rows-min">
      {data.map((d, i) => {
        const color = getDeptColor(d.department, i);
        return (
          <div key={`${d.lab}-${d.department}`} className="border rounded-lg p-4" style={{ borderColor: color + '40' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="font-bold text-2xl truncate" style={{ color }}>{d.department}</h4>
                <div className="text-sm text-gray-400 mt-0.5">{d.lab}연구소</div>
                <div className="flex items-baseline gap-3 mt-2 flex-wrap">
                  <span className="text-4xl font-bold">
                    {d.today}<span className="text-lg text-gray-500 ml-1">건</span>
                  </span>
                  <span className="text-base text-gray-500">월 {d.monthlyTotal}</span>
                  <span className="text-base text-gray-500">연 {d.annualTotal}</span>
                </div>
              </div>
              {/* 미니 라인 차트 */}
              <div className="w-28 h-14 shrink-0">
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
