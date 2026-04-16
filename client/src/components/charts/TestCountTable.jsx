import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import { getDeptColor } from '../../utils/deptColors';

export default function TestCountTable({ data }) {
  const [viewMode, setViewMode] = useState('table');

  // 날짜/부서별 피벗
  const rows = Array.isArray(data) ? data : [];
  const deptSet = new Set();
  const dateMap = {};
  rows.forEach((r) => {
    deptSet.add(r.department);
    if (!dateMap[r.date]) dateMap[r.date] = {};
    dateMap[r.date][r.department] = (dateMap[r.date][r.department] || 0) + r.count;
  });
  const departments = [...deptSet].sort();
  const dates = Object.keys(dateMap).sort();

  // 부서별 합계
  const totals = {};
  departments.forEach((d) => {
    totals[d] = dates.reduce((s, dt) => s + (dateMap[dt]?.[d] || 0), 0);
  });

  const today = new Date().toISOString().split('T')[0];

  // 차트용 데이터
  const chartData = dates.map((dt) => {
    const entry = { date: dt.slice(5) }; // MM-DD
    departments.forEach((d) => { entry[d] = dateMap[dt]?.[d] || 0; });
    return entry;
  });

  return (
    <div className="h-full flex flex-col gap-2">
      {/* 상단 액션 */}
      <div className="flex items-center gap-2">
        <button onClick={() => setViewMode('table')} className={`p-1 rounded ${viewMode === 'table' ? 'bg-slate-200' : 'hover:bg-gray-100'}`} title="테이블"><Table2 size={16} /></button>
        <button onClick={() => setViewMode('chart')} className={`p-1 rounded ${viewMode === 'chart' ? 'bg-slate-200' : 'hover:bg-gray-100'}`} title="차트"><BarChart3 size={16} /></button>
      </div>

      {/* 본문 */}
      <div className="flex-1 min-h-0 overflow-auto">
        {rows.length === 0 && <div className="text-center text-gray-400 text-sm py-8">입력된 시험건수가 없습니다</div>}

        {viewMode === 'table' && rows.length > 0 && (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b">
                <th className="text-left py-1 px-1 font-medium text-gray-600">날짜</th>
                {departments.map((d) => <th key={d} className="text-right py-1 px-1 font-medium text-gray-600">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {dates.map((dt) => (
                <tr key={dt} className={`border-b border-gray-100 ${dt === today ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="py-0.5 px-1 text-gray-500">{dt.slice(5)}</td>
                  {departments.map((d) => <td key={d} className="text-right py-0.5 px-1">{dateMap[dt]?.[d] || '-'}</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 bg-slate-50 font-bold">
              <tr className="border-t-2 border-slate-300">
                <td className="py-1 px-1">합계</td>
                {departments.map((d) => <td key={d} className="text-right py-1 px-1">{totals[d]}</td>)}
              </tr>
            </tfoot>
          </table>
        )}

        {viewMode === 'chart' && rows.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={30} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {departments.map((d) => (
                <Line key={d} type="monotone" dataKey={d} stroke={getDeptColor(d, departments.indexOf(d))} strokeWidth={1.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
}
