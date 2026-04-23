import { useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getDeptColor } from '../../utils/deptColors';

const LAB_COLOR_MAP = { '가산': '#6366f1', '문정': '#14b8a6' };
const FALLBACK_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#0ea5e9', '#ec4899'];
const labColor = (lab, idx) => LAB_COLOR_MAP[lab] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

export default function SubjectCards({ data }) {
  const [expanded, setExpanded] = useState(null);

  if (!Array.isArray(data) || data.length === 0) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 연동 대기 중</div>;

  return (
    <div className="h-full overflow-hidden flex flex-col gap-3">
      {data.map((lab, idx) => {
        const color = labColor(lab.lab, idx);
        const isOpen = expanded === lab.lab;
        return (
        <div key={lab.lab}
          className="rounded-xl bg-slate-50 flex-1 min-h-0 flex flex-col overflow-hidden"
          style={{ borderLeft: `4px solid ${color}` }}
        >
          <div className="flex items-center justify-between cursor-pointer shrink-0 px-4 py-3"
            onClick={() => setExpanded(isOpen ? null : lab.lab)}>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-lg sm:text-xl" style={{ color }}>{lab.lab}연구소</h4>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-3xl sm:text-4xl font-bold text-slate-800 leading-none tracking-tight">
                  {fmt(lab.today)}
                </span>
                <span className="text-sm font-medium text-slate-400">명</span>
                <span className="text-sm text-slate-400 ml-2">월 {fmt(lab.monthlyTotal)}명</span>
                <span className="text-sm text-slate-400">· 연 {fmt(lab.annualTotal)}명</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="w-24 sm:w-28 h-12 sm:h-14 opacity-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lab.recentDays || []}>
                    <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </div>
          </div>

          {isOpen && lab.departments?.length > 0 && (
            <div className="mx-4 mb-3 border-t border-slate-200 pt-2 flex-1 min-h-0 overflow-hidden">
              <table className="w-full text-sm sm:text-base">
                <thead>
                  <tr className="text-slate-400">
                    <th className="text-left py-1 font-medium">부서</th>
                    <th className="text-right py-1 font-medium">월 누적</th>
                  </tr>
                </thead>
                <tbody>
                  {lab.departments.map((d, i) => (
                    <tr key={d.department} className="border-t border-slate-100">
                      <td className="py-1.5 font-semibold" style={{ color: getDeptColor(d.department, i) }}>{d.department}</td>
                      <td className="text-right py-1.5 font-semibold text-slate-700">{fmt(d.total)}명</td>
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
