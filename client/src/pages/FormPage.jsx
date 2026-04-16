import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Plus, Trash2, CheckCircle } from 'lucide-react';
import api from '../utils/api';

const DEFAULT_TYPES = ['HET-CAM', '첩포시험', '인체적용시험', '안자극시험', '광독성시험'];

export default function FormPage() {
  const { token } = useParams();
  const [tokenInfo, setTokenInfo] = useState(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const minDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [date, setDate] = useState(today);
  const [employeeId, setEmployeeId] = useState('');
  const [rows, setRows] = useState(DEFAULT_TYPES.map(t => ({ test_type: t, count: '', notes: '' })));

  useEffect(() => {
    api.get(`/form-tokens/${token}/validate`)
      .then((res) => setTokenInfo(res.data.data))
      .catch((err) => setError(err.response?.data?.error?.message || '유효하지 않은 링크입니다.'))
      .finally(() => setLoading(false));
  }, [token]);

  const addRow = () => setRows([...rows, { test_type: '', count: '', notes: '' }]);
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));
  const updateRow = (i, field, value) => {
    const updated = [...rows];
    updated[i] = { ...updated[i], [field]: value };
    setRows(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId.trim()) { alert('입력자 사번을 입력해주세요.'); return; }

    const validRows = rows.filter(r => r.test_type && r.count !== '' && parseInt(r.count) >= 0);
    if (validRows.length === 0) { alert('시험유형과 건수를 1건 이상 입력해주세요.'); return; }

    setSubmitting(true);
    try {
      for (const row of validRows) {
        await api.post('/test-counts', {
          date,
          department: tokenInfo.department,
          lab: tokenInfo.lab,
          test_type: row.test_type,
          count: parseInt(row.count),
          submitted_by: employeeId,
          notes: row.notes || null,
          token,
        });
      }
      setSubmitted(true);
    } catch (err) {
      alert(err.response?.data?.error?.message || '제출에 실패했습니다.');
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setSubmitted(false);
    setRows(DEFAULT_TYPES.map(t => ({ test_type: t, count: '', notes: '' })));
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">확인 중...</div>;
  if (error) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center p-8"><p className="text-red-500 text-lg font-medium">{error}</p></div>
    </div>
  );
  if (submitted) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center p-8">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold mb-2">입력 완료</h2>
        <p className="text-gray-500 text-sm mb-4">시험건수가 정상적으로 등록되었습니다.</p>
        <button onClick={resetForm} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">추가 입력</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-xl shadow-lg p-6">
        <div className="text-center mb-5">
          <h1 className="text-lg font-bold text-slate-800">KDRI 일일 시험건수 입력폼</h1>
          <p className="text-sm text-gray-500 mt-1">{tokenInfo.lab}연구소 · {tokenInfo.department}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시험일자</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={minDate} max={today}
              className="w-full border rounded-lg px-3 py-2 text-sm" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">부서</label>
              <input type="text" value={tokenInfo.department} disabled className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">연구소</label>
              <input type="text" value={tokenInfo.lab} disabled className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" />
            </div>
          </div>

          {/* 시험유형 + 건수 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">시험유형 / 건수 / 비고</label>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input type="text" value={row.test_type} onChange={(e) => updateRow(i, 'test_type', e.target.value)}
                    className="flex-1 border rounded-md px-2 py-1.5 text-sm" placeholder="시험유형" />
                  <input type="number" value={row.count} onChange={(e) => updateRow(i, 'count', e.target.value)}
                    className="w-16 border rounded-md px-2 py-1.5 text-sm text-center" placeholder="건수" min="0" max="9999" />
                  <input type="text" value={row.notes} onChange={(e) => updateRow(i, 'notes', e.target.value)}
                    className="w-20 border rounded-md px-2 py-1.5 text-sm" placeholder="비고" />
                  {rows.length > 1 && <button type="button" onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>}
                </div>
              ))}
            </div>
            <button type="button" onClick={addRow} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
              <Plus size={14} /> 유형 추가
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">입력자 사번</label>
            <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="사번 입력" required />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting}
              className="flex-1 bg-slate-800 text-white py-2.5 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Send size={16} />
              {submitting ? '제출 중...' : '제출하기'}
            </button>
          </div>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          이 링크는 {new Date(tokenInfo.expires_at).toLocaleString('ko-KR')}에 만료됩니다
        </p>
      </div>
    </div>
  );
}
