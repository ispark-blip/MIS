import { useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getDeptColor } from '../../utils/deptColors';

const LAB_COLOR_MAP = { '문정': '#14b8a6', '가산': '#6366f1' };
const FALLBACK_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#0ea5e9', '#ec4899'];
const labColor = (lab, idx) => LAB_COLOR_MAP[lab] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

export default function SubjectCards({ data }) {
  const [expanded, setExpanded] = useState(null);

  if (!Array.isArray(data) || data.length === 0) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;

  return (
    <div className="h-full overflow-hidden flex flex-col gap-2">
      {data.map((lab, idx) => {
        const color = labColor(lab.lab, idx);
        const isOpen = expanded === lab.lab;
        return (
        <div key={lab.lab} className="border rounded-lg p-3 sm:p-4 flex-1 min-h-0 flex flex-col overflow-hidden" style={{ borderColor: color + '40' }}>
          {/* 카드 헤더 */}
          <div className="flex items-center justify-between cursor-pointer shrink-0" onClick={() => setExpanded(isOpen ? null : lab.lab)}>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xl sm:text-2xl lg:text-3xl" style={{ color }}>{lab.lab}연구소</h4>
              <div className="flex items-baseline gap-2 sm:gap-3 mt-1 flex-wrap">
                <span className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-none">
                  {fmt(lab.today)}<span className="text-base text-gray-500 ml-1">명</span>
                </span>
                <span className="text-sm sm:text-base text-gray-500">월 {fmt(lab.monthlyTotal)}명</span>
                <span className="text-sm sm:text-base text-gray-500">연 {fmt(lab.annualTotal)}명</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {/* 미니 라인 차트 */}
              <div className="w-24 sm:w-28 lg:w-32 h-12 sm:h-14 lg:h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lab.recentDays || []}>
                    <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {isOpen ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
            </div>
          </div>

          {/* 부서별 상세 (아코디언) */}
          {isOpen && lab.departments?.length > 0 && (
            <div className="mt-2 border-t pt-2 flex-1 min-h-0 overflow-hidden">
              <table className="w-full text-base sm:text-lg">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left py-1">부서</th>
                    <th className="text-right py-1">월 누적</th>
                  </tr>
                </thead>
                <tbody>
                  {lab.departments.map((d, i) => (
                    <tr key={d.department} className="border-t border-gray-100">
                      <td className="py-1 font-semibold" style={{ color: getDeptColor(d.department, i) }}>{d.department}</td>
                      <td className="text-right py-1 font-medium">{fmt(d.total)}명</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
