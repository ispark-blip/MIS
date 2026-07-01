import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Save } from 'lucide-react';

export default function DashboardSettingsTab({ settings, onSaved }) {
  const [form, setForm] = useState({
    default_lab: '전체', default_year: '', default_quarter: 'Q1',
    external_mj_sheet_id: '', external_mj_tab_name_filter: '',
    external_gs_sheet_id: '', external_gs_tab_name: '',
  });
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
        external_mj_sheet_id: settings.external_mj_sheet_id || '',
        external_mj_tab_name_filter: settings.external_mj_tab_name_filter || '',
        external_gs_sheet_id: settings.external_gs_sheet_id || '',
        external_gs_tab_name: settings.external_gs_tab_name || '',
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

      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-700">
        💡 매출 목표 금액은 Google Sheets(<code>전사목표</code>, <code>매출</code> 시트)에서 관리됩니다. 시트에서 직접 수정해주세요.
      </div>

      {/* 시험대상자 구글시트 연동 */}
      <div className="border-t pt-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold mb-1">시험대상자 구글시트 연동</h3>
          <p className="text-sm text-gray-500">외부 구글시트에서 시험대상자 인원수를 자동으로 동기화합니다. 비워두면 서버 기본값을 사용합니다.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">문정연구소 시트 ID</label>
            <input
              type="text"
              value={form.external_mj_sheet_id}
              onChange={(e) => update('external_mj_sheet_id', e.target.value)}
              placeholder="(서버 기본값 사용)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">문정 탭 필터 키워드</label>
            <input
              type="text"
              value={form.external_mj_tab_name_filter}
              onChange={(e) => update('external_mj_tab_name_filter', e.target.value)}
              placeholder="배정표"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">이 키워드가 포함된 탭만 읽습니다 (기본: 배정표)</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">가산연구소 시트 ID</label>
            <input
              type="text"
              value={form.external_gs_sheet_id}
              onChange={(e) => update('external_gs_sheet_id', e.target.value)}
              placeholder="(비워두면 문정 시트 ID 사용)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">가산 탭이 문정 시트에 통합된 경우 비워두세요</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">가산 탭명</label>
            <input
              type="text"
              value={form.external_gs_tab_name}
              onChange={(e) => update('external_gs_tab_name', e.target.value)}
              placeholder="[가산]230501~종료시험누적"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">정확한 탭명을 입력하세요 (기본: [가산]230501~종료시험누적)</p>
          </div>
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
    </div>
  );
}
