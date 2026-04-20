import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Save } from 'lucide-react';

export default function DashboardSettingsTab({ settings, onSaved }) {
  const [form, setForm] = useState({ default_lab: '전체', default_year: '', default_quarter: 'Q1' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [labs, setLabs] = useState([]);

  useEffect(() => {
    api.get('/config/departments').then(r => setLabs(r.data.data?.labs || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (settings) {
      setForm({
        default_lab: settings.default_lab || '전체',
        default_year: settings.default_year || String(new Date().getFullYear()),
        default_quarter: settings.default_quarter || 'Q1',
      });
    }
  }, [settings]);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await api.put('/settings', form);
      onSaved(r.data.data);
      setMsg({ type: 'ok', text: '저장되었습니다.' });
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error?.message || '저장 실패' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1">대시보드 기본값 설정</h2>
        <p className="text-sm text-gray-500">대시보드 접속 시 초기 표시되는 연구소·연도·분기 기본값입니다.</p>
      </div>

      {msg && (
        <div className={`text-sm p-3 rounded ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">기본 연구소</label>
          <select
            value={form.default_lab}
            onChange={(e) => update('default_lab', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <option value="전체">전체</option>
            {labs.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">기본 연도</label>
          <select
            value={form.default_year}
            onChange={(e) => update('default_year', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">기본 분기</label>
          <select
            value={form.default_quarter}
            onChange={(e) => update('default_quarter', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            {['Q1', 'Q2', 'Q3', 'Q4'].map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
        >
          <Save size={16} /> 저장
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-700">
        💡 매출 목표 금액은 Google Sheets(<code>전사목표</code>, <code>매출</code> 시트)에서 관리됩니다. 시트에서 직접 수정해주세요.
      </div>
    </div>
  );
}
