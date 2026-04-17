import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { ArrowLeft, Plus, Pencil, X, Save } from 'lucide-react';

const LABS = ['문정', '가산'];
const DEPTS_BY_LAB = { '문정': ['문정 임상팀', '비임상', '원료개발팀'], '가산': ['가산 임상팀', '자외선실'] };

export default function SubjectInputPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [msg, setMsg] = useState(null);

  const loadData = async () => {
    setFetching(true);
    try {
      const r = await api.get('/subjects', { params: { month, year } });
      setRows(r.data.data || []);
    } catch { setRows([]); }
    setFetching(false);
  };

  useEffect(() => { if (user) loadData(); }, [year, month, user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">로딩 중...</div>;
  if (!user) { window.location.href = '/login?next=/input/subjects'; return null; }

  const hasPermission = user.role === 'admin' || user.can_input_subjects;
  if (!hasPermission) return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-14 bg-slate-800 text-white flex items-center px-4 gap-4 shrink-0">
        <button onClick={() => navigate('/dashboard')} className="hover:bg-slate-700 rounded-md p-1.5"><ArrowLeft size={18} /></button>
        <h1 className="font-bold">시험대상자 인원수 입력</h1>
      </header>
      <div className="flex-1 flex items-center justify-center"><p className="text-gray-500">시험대상자 입력 권한이 없습니다. 관리자에게 문의하세요.</p></div>
    </div>
  );

  const totalCount = rows.reduce((s, r) => s + (r.subject_count || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-14 bg-slate-800 text-white flex items-center px-4 gap-4 shrink-0">
        <button onClick={() => navigate('/dashboard')} className="hover:bg-slate-700 rounded-md p-1.5"><ArrowLeft size={18} /></button>
        <h1 className="font-bold">시험대상자 인원수 입력</h1>
        <span className="ml-auto text-sm">{user.name}</span>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto space-y-4">
        {/* 월 선택 + 신규 입력 */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={year} onChange={e => setYear(+e.target.value)} className="px-3 py-2 border rounded-lg">
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={month} onChange={e => setMonth(+e.target.value)} className="px-3 py-2 border rounded-lg">
            {Array.from({length:12},(_,i) => <option key={i+1} value={i+1}>{i+1}월</option>)}
          </select>
          <span className="text-sm text-gray-500">총 {rows.length}건 / 합계 {totalCount}명</span>
          <button onClick={() => { setEditRow(null); setShowForm(true); }} className="ml-auto flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
            <Plus size={16} /> 신규 입력
          </button>
        </div>

        {msg && (
          <div className={`text-sm p-3 rounded ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg.text}
            <button onClick={() => setMsg(null)} className="ml-2 underline">닫기</button>
          </div>
        )}

        {/* 입력/수정 폼 */}
        {showForm && (
          <SubjectForm
            defaultYear={year}
            defaultMonth={month}
            editing={editRow}
            onClose={() => { setShowForm(false); setEditRow(null); }}
            onSaved={(text) => { setShowForm(false); setEditRow(null); loadData(); setMsg({ type: 'ok', text }); }}
            onError={(text) => setMsg({ type: 'err', text })}
          />
        )}

        {/* 데이터 테이블 */}
        {fetching ? (
          <div className="text-center text-gray-400 py-10">로딩 중...</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-gray-400 py-10">해당 월에 입력된 데이터가 없습니다.</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-left text-gray-500">
                  <th className="py-2.5 px-3">날짜</th>
                  <th className="py-2.5 px-3">연구소</th>
                  <th className="py-2.5 px-3">부서</th>
                  <th className="py-2.5 px-3 text-right">인원수</th>
                  <th className="py-2.5 px-3">과제명</th>
                  <th className="py-2.5 px-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id || i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3 font-mono">{r.date}</td>
                    <td className="py-2 px-3">{r.lab}</td>
                    <td className="py-2 px-3">{r.department}</td>
                    <td className="py-2 px-3 text-right font-semibold">{r.subject_count}</td>
                    <td className="py-2 px-3 text-gray-500 truncate max-w-[200px]">{r.study_name || ''}</td>
                    <td className="py-2 px-3 text-right">
                      <button onClick={() => { setEditRow(r); setShowForm(true); }} className="p-1 hover:bg-gray-200 rounded" title="수정">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function SubjectForm({ defaultYear, defaultMonth, editing, onClose, onSaved, onError }) {
  const pad2 = n => String(n).padStart(2, '0');
  const defaultDate = editing?.date || `${defaultYear}-${pad2(defaultMonth)}-${pad2(new Date().getDate())}`;
  const [form, setForm] = useState({
    date: defaultDate,
    lab: editing?.lab || '문정',
    department: editing?.department || DEPTS_BY_LAB['문정'][0],
    subject_count: editing?.subject_count ?? '',
    study_name: editing?.study_name || '',
  });
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === 'lab') next.department = DEPTS_BY_LAB[v]?.[0] || '';
    return next;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/subjects/${editing.id}`, { ...form, subject_count: parseInt(form.subject_count) || 0 });
        onSaved('수정 완료');
      } else {
        await api.post('/subjects', { ...form, subject_count: parseInt(form.subject_count) || 0 });
        onSaved('입력 완료');
      }
    } catch (err) {
      onError(err.response?.data?.error?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const deptOptions = DEPTS_BY_LAB[form.lab] || [];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{editing ? '시험대상자 수정' : '시험대상자 신규 입력'}</h3>
        <button type="button" onClick={onClose}><X size={18} className="text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
          <input type="date" value={form.date} onChange={e => update('date', e.target.value)} required disabled={!!editing}
            className="w-full px-2 py-1.5 border rounded-lg disabled:bg-gray-100" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">연구소</label>
          <select value={form.lab} onChange={e => update('lab', e.target.value)} disabled={!!editing}
            className="w-full px-2 py-1.5 border rounded-lg disabled:bg-gray-100">
            {LABS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">부서</label>
          <select value={form.department} onChange={e => update('department', e.target.value)} disabled={!!editing}
            className="w-full px-2 py-1.5 border rounded-lg disabled:bg-gray-100">
            {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">인원수 *</label>
          <input type="number" min="0" max="99999" value={form.subject_count} onChange={e => update('subject_count', e.target.value)} required
            className="w-full px-2 py-1.5 border rounded-lg" />
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">과제명</label>
          <input type="text" value={form.study_name} onChange={e => update('study_name', e.target.value)}
            className="w-full px-2 py-1.5 border rounded-lg" placeholder="선택사항" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-1.5 border rounded-lg hover:bg-gray-100 text-sm">취소</button>
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 text-sm">
          <Save size={14} /> {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}
