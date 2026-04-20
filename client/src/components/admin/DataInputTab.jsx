import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Send } from 'lucide-react';

export default function DataInputTab() {
  const [mode, setMode] = useState('test'); // 'test' | 'subject'
  const [deptConfig, setDeptConfig] = useState({ labs: [], departments: {}, testTypes: [] });

  useEffect(() => {
    api.get('/config/departments').then(r => setDeptConfig(r.data.data || {})).catch(() => {});
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold mb-1">데이터 직접 입력</h2>
        <p className="text-sm text-gray-500">
          Google Sheets 미연동 또는 보정 입력 용도. 입력값은 SQLite(<code>daily_test_counts</code> / <code>daily_subject_counts</code>)에 저장되며, Sheets 데이터가 있으면 Sheets 값이 우선 표시됩니다.
        </p>
      </div>

      <div className="inline-flex rounded-lg border bg-gray-50 p-1">
        {[
          { k: 'test', l: '일일 시험건수' },
          { k: 'subject', l: '시험대상자 인원수' },
        ].map(({ k, l }) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === k ? 'bg-white shadow text-slate-800' : 'text-gray-500 hover:text-slate-700'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {mode === 'test' ? <TestCountForm deptConfig={deptConfig} /> : <SubjectForm deptConfig={deptConfig} />}
    </div>
  );
}

function TestCountForm({ deptConfig }) {
  const labs = deptConfig?.labs || [];
  const deptsBy = deptConfig?.departments || {};
  const testTypes = deptConfig?.testTypes || [];
  const today = new Date().toISOString().slice(0, 10);
  const initLab = labs[0] || '';
  const initDept = (deptsBy[initLab] || [])[0] || '';
  const initType = testTypes[0] || '';
  const [form, setForm] = useState({ date: today, lab: initLab, department: initDept, test_type: initType, count: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!form.lab && labs.length > 0) {
      setForm(f => ({
        ...f,
        lab: labs[0],
        department: (deptsBy[labs[0]] || [])[0] || '',
        test_type: testTypes[0] || '',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labs.length, testTypes.length]);

  const update = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === 'lab') next.department = (deptsBy[v] || [])[0] || '';
    return next;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      await api.post('/test-counts', {
        date: form.date,
        lab: form.lab,
        department: form.department,
        test_type: form.test_type,
        count: parseInt(form.count) || 0,
        notes: form.notes || undefined,
      });
      setMsg({ type: 'ok', text: '입력 완료' });
      setForm(f => ({ ...f, count: '', notes: '' }));
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error?.message || '입력 실패' });
    } finally {
      setSaving(false);
    }
  };

  const deptOptions = deptsBy[form.lab] || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <h3 className="font-semibold">일일 시험건수 입력</h3>
      {msg && <div className={`text-sm p-3 rounded ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

      <div className="grid md:grid-cols-3 gap-3">
        <Field label="일자" type="date" value={form.date} onChange={(v) => update('date', v)} />
        <SelectField label="연구소" value={form.lab} onChange={(v) => update('lab', v)} options={labs} />
        <SelectField label="부서" value={form.department} onChange={(v) => update('department', v)} options={deptOptions} />
        <SelectField label="시험유형" value={form.test_type} onChange={(v) => update('test_type', v)} options={testTypes} />
        <Field label="건수" type="number" min="0" max="9999" value={form.count} onChange={(v) => update('count', v)} />
        <Field label="비고" type="text" value={form.notes} onChange={(v) => update('notes', v)} />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
          <Send size={16} /> {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}

function SubjectForm({ deptConfig }) {
  const labs = deptConfig?.labs || [];
  const deptsBy = deptConfig?.departments || {};
  const today = new Date().toISOString().slice(0, 10);
  const initLab = labs[0] || '';
  const initDept = (deptsBy[initLab] || [])[0] || '';
  const [form, setForm] = useState({ date: today, lab: initLab, department: initDept, subject_count: '', study_name: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!form.lab && labs.length > 0) {
      setForm(f => ({ ...f, lab: labs[0], department: (deptsBy[labs[0]] || [])[0] || '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labs.length]);

  const update = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === 'lab') next.department = (deptsBy[v] || [])[0] || '';
    return next;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      await api.post('/subjects', {
        date: form.date,
        lab: form.lab,
        department: form.department,
        subject_count: parseInt(form.subject_count) || 0,
        study_name: form.study_name || undefined,
      });
      setMsg({ type: 'ok', text: '입력 완료' });
      setForm(f => ({ ...f, subject_count: '', study_name: '' }));
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error?.message || '입력 실패' });
    } finally {
      setSaving(false);
    }
  };

  const deptOptions = deptsBy[form.lab] || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <h3 className="font-semibold">시험대상자 인원수 입력</h3>
      {msg && <div className={`text-sm p-3 rounded ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

      <div className="grid md:grid-cols-3 gap-3">
        <Field label="일자" type="date" value={form.date} onChange={(v) => update('date', v)} />
        <SelectField label="연구소" value={form.lab} onChange={(v) => update('lab', v)} options={labs} />
        <SelectField label="부서" value={form.department} onChange={(v) => update('department', v)} options={deptOptions} />
        <Field label="인원수" type="number" min="0" max="99999" value={form.subject_count} onChange={(v) => update('subject_count', v)} />
        <Field label="과제명 (선택)" type="text" value={form.study_name} onChange={(v) => update('study_name', v)} />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
          <Send size={16} /> {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, type, value, onChange, min, max }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        required={type !== 'text'}
        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
