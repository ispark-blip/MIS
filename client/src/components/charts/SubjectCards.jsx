import { useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getDeptColor } from '../../utils/deptColors';

const LAB_COLOR_MAP = { '문정': '#14b8a6', '가산': '#6366f1' };
const FALLBACK_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#0ea5e9', '#ec4899'];
const labColor = (lab, idx) => LAB_COLOR_MAP[lab] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

export default function SubjectCards({ data, hideChart }) {
  const [expanded, setExpanded] = useState(null);

  if (!Array.isArray(data) || data.length === 0) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;

  return (
    <div className="h-full overflow-hidden flex flex-col gap-2">
      {data.map((lab, idx) => {
        const color = labColor(lab.lab, idx);
        const isOpen = !hideChart && expanded === lab.lab;
        return (
        <div key={lab.lab} className="border rounded-lg p-2 sm:p-3 flex-1 min-h-0 flex flex-col overflow-hidden" style={{ borderColor: color + '40', background: color + '08' }}>
          {/* 카드 헤더 */}
          <div
            className={`flex items-center justify-between shrink-0 ${hideChart ? '' : 'cursor-pointer'}`}
            onClick={hideChart ? undefined : () => setExpanded(isOpen ? null : lab.lab)}
          >
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-lg sm:text-xl lg:text-2xl" style={{ color }}>{lab.lab}연구소</h4>
              <div className="flex items-baseline gap-2 sm:gap-3 mt-1 flex-wrap">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-none">
                  {fmt(lab.today)}<span className="text-sm text-gray-500 ml-1">명</span>
                </span>
                <span className="text-xs sm:text-sm text-gray-500">월 {fmt(lab.monthlyTotal)}명</span>
                <span className="text-xs sm:text-sm text-gray-500">연 {fmt(lab.annualTotal)}명</span>
              </div>
            </div>
            {!hideChart && (
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="w-20 sm:w-24 lg:w-28 h-10 sm:h-12 lg:h-14">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lab.recentDays || []}>
                      <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </div>
            )}
          </div>

          {/* 부서별 상세 (아코디언) */}
          {isOpen && lab.departments?.length > 0 && (
            <div className="mt-2 border-t pt-2 flex-1 min-h-0 overflow-hidden">
              <table className="w-full text-sm sm:text-base">
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
