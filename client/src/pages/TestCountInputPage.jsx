import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { ArrowLeft, Save } from 'lucide-react';

const LABS = ['문정', '가산'];
const DEPTS_BY_LAB = { '문정': ['문정 임상팀', '비임상', '원료개발팀'], '가산': ['가산 임상팀', '자외선실'] };
const TEST_TYPES = ['HET-CAM', '첩포시험', '인체적용시험', '안자극시험', '광독성시험', '일반', '기타'];

const pad2 = (n) => String(n).padStart(2, '0');

export default function TestCountInputPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [lab, setLab] = useState('문정');
  const [department, setDepartment] = useState(DEPTS_BY_LAB['문정'][0]);
  const [testType, setTestType] = useState(TEST_TYPES[0]);
  const [counts, setCounts] = useState({});        // { 'YYYY-MM-DD': '숫자문자열' }
  const [originals, setOriginals] = useState({});  // 변경 감지용 원본
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

  const loadData = async () => {
    setFetching(true);
    try {
      const r = await api.get('/test-counts', { params: { month, year, lab, test_type: testType } });
      const existing = r.data.data || [];
      const map = {};
      existing
        .filter((row) => row.department === department && row.test_type === testType && row.lab === lab)
        .forEach((row) => { map[row.date] = String(row.count ?? ''); });
      setCounts(map);
      setOriginals(map);
    } catch {
      setCounts({});
      setOriginals({});
    }
    setFetching(false);
  };

  useEffect(() => {
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, lab, department, testType, user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">로딩 중...</div>;
  if (!user) { window.location.href = '/login?next=/input/test-counts'; return null; }

  const hasPermission = user.role === 'admin' || user.can_input_test_counts;
  if (!hasPermission) return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-14 bg-slate-800 text-white flex items-center px-4 gap-4 shrink-0">
        <button onClick={() => navigate('/dashboard')} className="hover:bg-slate-700 rounded-md p-1.5"><ArrowLeft size={18} /></button>
        <h1 className="font-bold">일일 시험건수 입력</h1>
      </header>
      <div className="flex-1 flex items-center justify-center"><p className="text-gray-500">시험건수 입력 권한이 없습니다. 관리자에게 문의하세요.</p></div>
    </div>
  );

  const onLabChange = (v) => {
    setLab(v);
    const depts = DEPTS_BY_LAB[v] || [];
    if (!depts.includes(department)) setDepartment(depts[0] || '');
  };

  const onCountChange = (date, value) => {
    const v = value.replace(/[^0-9]/g, '').slice(0, 4);
    setCounts((prev) => ({ ...prev, [date]: v }));
  };

  const changedEntries = () => {
    const out = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${pad2(month)}-${pad2(d)}`;
      const cur = counts[date] ?? '';
      const orig = originals[date] ?? '';
      if (cur !== orig && cur !== '') {
        const n = parseInt(cur);
        if (!isNaN(n) && n >= 0 && n <= 9999) {
          out.push({ date, count: n });
        }
      }
    }
    return out;
  };

  const handleSaveAll = async () => {
    const entries = changedEntries();
    if (entries.length === 0) {
      setMsg({ type: 'err', text: '변경된 입력값이 없습니다.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    let success = 0;
    let failed = 0;
    for (const { date, count } of entries) {
      try {
        await api.post('/test-counts', { date, lab, department, test_type: testType, count });
        success++;
      } catch {
        failed++;
      }
    }
    setSaving(false);
    if (failed === 0) {
      setMsg({ type: 'ok', text: `${success}건 저장 완료` });
    } else {
      setMsg({ type: 'err', text: `${success}건 저장, ${failed}건 실패` });
    }
    loadData();
  };

  const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];

  const totalCount = Object.values(counts).reduce((s, v) => s + (parseInt(v) || 0), 0);
  const changedCount = changedEntries().length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-14 bg-slate-800 text-white flex items-center px-4 gap-4 shrink-0">
        <button onClick={() => navigate('/dashboard')} className="hover:bg-slate-700 rounded-md p-1.5"><ArrowLeft size={18} /></button>
        <h1 className="font-bold">일일 시험건수 입력</h1>
        <span className="ml-auto text-sm">{user.name}</span>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto space-y-4">
        {/* 필터 */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">연도</label>
              <select value={year} onChange={(e) => setYear(+e.target.value)} className="w-full px-2 py-1.5 border rounded-lg">
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">월</label>
              <select value={month} onChange={(e) => setMonth(+e.target.value)} className="w-full px-2 py-1.5 border rounded-lg">
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}월</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">연구소</label>
              <select value={lab} onChange={(e) => onLabChange(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg">
                {LABS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">부서</label>
              <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg">
                {(DEPTS_BY_LAB[lab] || []).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">시험유형</label>
              <select value={testType} onChange={(e) => setTestType(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg">
                {TEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {year}년 {month}월 · {lab} / {department} / {testType} · 합계 {totalCount}건
              {changedCount > 0 && <span className="ml-2 text-orange-600 font-medium">· 변경 {changedCount}건</span>}
            </span>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || changedCount === 0}
              className="flex items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              <Save size={16} /> {saving ? '저장 중...' : '전체 저장'}
            </button>
          </div>
        </div>

        {msg && (
          <div className={`text-sm p-3 rounded ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg.text}
            <button onClick={() => setMsg(null)} className="ml-2 underline">닫기</button>
          </div>
        )}

        {/* 일자별 입력 그리드 */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {fetching ? (
            <div className="text-center text-gray-400 py-10">로딩 중...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-0 border-t border-l">
              {daysArr.map((d) => {
                const date = `${year}-${pad2(month)}-${pad2(d)}`;
                const weekday = new Date(year, month - 1, d).getDay();
                const isToday = date === today;
                const isChanged = (counts[date] ?? '') !== (originals[date] ?? '');
                return (
                  <div
                    key={d}
                    className={`border-r border-b p-2 flex flex-col gap-1 ${isToday ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-baseline gap-1">
                      <span className={`text-sm font-semibold ${weekday === 0 ? 'text-red-500' : weekday === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
                        {d}
                      </span>
                      <span className="text-xs text-gray-400">({weekdayLabels[weekday]})</span>
                      {isChanged && <span className="ml-auto text-[10px] text-orange-500 font-medium">●</span>}
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={counts[date] ?? ''}
                      onChange={(e) => onCountChange(date, e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1.5 border rounded text-right text-base font-medium focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 leading-relaxed">
          · 건수가 있는 날짜에만 입력하세요. 빈 칸으로 둔 날짜는 저장되지 않습니다.<br />
          · 기존 입력값을 수정하려면 숫자를 변경 후 "전체 저장"을 클릭하세요.<br />
          · 연구소/부서/시험유형 조합별로 별도 저장됩니다. 다른 시험유형은 상단 필터에서 변경 후 입력하세요.
        </div>
      </main>
    </div>
  );
}
