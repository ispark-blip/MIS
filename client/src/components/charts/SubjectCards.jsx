import { useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getDeptColor } from '../../utils/deptColors';

const LAB_COLORS = { '문정': '#14b8a6', '가산': '#6366f1' };
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

export default function SubjectCards({ data }) {
  const [expanded, setExpanded] = useState(null);

  if (!Array.isArray(data) || data.length === 0) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;

  return (
    <div className="h-full overflow-auto flex flex-col gap-4">
      {data.map((lab) => (
        <div key={lab.lab} className="border rounded-lg p-4" style={{ borderColor: LAB_COLORS[lab.lab] + '40' }}>
          {/* 카드 헤더 */}
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(expanded === lab.lab ? null : lab.lab)}>
            <div>
              <h4 className="font-bold text-2xl" style={{ color: LAB_COLORS[lab.lab] }}>{lab.lab}연구소</h4>
              <div className="flex items-baseline gap-4 mt-2">
                <span className="text-4xl font-bold">
                  {fmt(lab.today)}<span className="text-lg text-gray-500 ml-1">명</span>
                </span>
                <span className="text-base text-gray-500">월 {fmt(lab.monthlyTotal)}명</span>
                <span className="text-base text-gray-500">연 {fmt(lab.annualTotal)}명</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {/* 미니 라인 차트 */}
              <div className="w-32 h-14">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lab.recentDays || []}>
                    <Line type="monotone" dataKey="total" stroke={LAB_COLORS[lab.lab]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {expanded === lab.lab ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
            </div>
          </div>

          {/* 부서별 상세 (아코디언) */}
          {expanded === lab.lab && lab.departments?.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <table className="w-full text-base">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left py-1.5">부서</th>
                    <th className="text-right py-1.5">월 누적</th>
                  </tr>
                </thead>
                <tbody>
                  {lab.departments.map((d, i) => (
                    <tr key={d.department} className="border-t border-gray-100">
                      <td className="py-1.5 font-semibold" style={{ color: getDeptColor(d.department, i) }}>{d.department}</td>
                      <td className="text-right py-1.5 font-medium">{fmt(d.total)}명</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
