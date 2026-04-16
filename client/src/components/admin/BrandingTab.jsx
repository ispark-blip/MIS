import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { Upload, Trash2, Save } from 'lucide-react';

export default function BrandingTab({ settings, onSaved }) {
  const [form, setForm] = useState({ company_name: '', company_abbr: '', system_title: '', logo_url: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name || '',
        company_abbr: settings.company_abbr || '',
        system_title: settings.system_title || '',
        logo_url: settings.logo_url || '',
      });
    }
  }, [settings]);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await api.put('/settings', {
        company_name: form.company_name,
        company_abbr: form.company_abbr,
        system_title: form.system_title,
      });
      onSaved(r.data.data);
      setMsg({ type: 'ok', text: '저장되었습니다.' });
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error?.message || '저장 실패' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    setSaving(true); setMsg(null);
    try {
      const r = await api.post('/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      // 전체 설정 재조회
      const s = await api.get('/settings');
      onSaved(s.data.data);
      setForm(f => ({ ...f, logo_url: r.data.data.logo_url }));
      setMsg({ type: 'ok', text: '로고 업로드 완료' });
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error?.message || '업로드 실패' });
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('로고를 삭제하시겠습니까?')) return;
    setSaving(true); setMsg(null);
    try {
      await api.delete('/settings/logo');
      const s = await api.get('/settings');
      onSaved(s.data.data);
      setForm(f => ({ ...f, logo_url: '' }));
      setMsg({ type: 'ok', text: '로고 삭제 완료' });
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error?.message || '삭제 실패' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1">브랜딩 설정</h2>
        <p className="text-sm text-gray-500">상단 헤더 및 로그인 화면에 표시되는 회사 정보·로고를 관리합니다.</p>
      </div>

      {msg && (
        <div className={`text-sm p-3 rounded ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="회사명" value={form.company_name} onChange={(v) => update('company_name', v)} placeholder="한국피부과학연구원" />
        <Field label="약칭 (로고 대체 텍스트)" value={form.company_abbr} onChange={(v) => update('company_abbr', v)} placeholder="KIDS" maxLength={8} />
        <Field label="시스템 타이틀" value={form.system_title} onChange={(v) => update('system_title', v)} placeholder="경영정보현황시스템" />
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

      <hr />

      <div>
        <h3 className="font-semibold mb-2">로고 이미지</h3>
        <p className="text-xs text-gray-500 mb-3">PNG / JPG / GIF / WEBP / SVG, 최대 2MB. 업로드 시 기존 로고가 교체됩니다.</p>

        <div className="flex items-start gap-4">
          <div className="w-24 h-24 bg-slate-100 rounded-lg border flex items-center justify-center overflow-hidden">
            {form.logo_url ? (
              <img src={form.logo_url} alt="로고" className="max-w-full max-h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
            ) : (
              <span className="text-slate-400 text-sm">로고 없음</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 cursor-pointer w-fit">
              <Upload size={16} /> 로고 업로드
              <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={saving} />
            </label>
            {form.logo_url && (
              <button
                onClick={handleDeleteLogo}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 w-fit"
              >
                <Trash2 size={16} /> 로고 삭제
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, maxLength }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
      />
    </div>
  );
}
