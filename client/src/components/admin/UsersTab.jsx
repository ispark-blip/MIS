import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Plus, UserCheck, UserX, Pencil } from 'lucide-react';

const ROLE_LABELS = { admin: '관리자', manager: '매니저', staff: '일반' };

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deptConfig, setDeptConfig] = useState({ labs: ['문정', '가산'], departments: {} });

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/users');
      setUsers(r.data.data || []);
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error?.message || '목록 조회 실패' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.get('/config/departments')
      .then(r => setDeptConfig(r.data.data || {}))
      .catch(() => {});
  }, []);

  const handleToggleActive = async (u) => {
    try {
      await api.put(`/admin/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error?.message || '변경 실패' });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold mb-1">사용자 관리</h2>
          <p className="text-sm text-gray-500">관리자(admin) 권한을 가진 사람만 이 페이지 및 수정 기능을 이용할 수 있습니다.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-sm"
        >
          <Plus size={16} /> 신규 등록
        </button>
      </div>

      {msg && (
        <div className={`text-sm p-3 rounded ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <UserForm
          editing={editing}
          deptConfig={deptConfig}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); setMsg({ type: 'ok', text: '저장되었습니다.' }); }}
        />
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-8">로딩 중...</div>
      ) : users.length === 0 ? (
        <div className="text-center text-gray-400 py-8">등록된 사용자가 없습니다.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 px-2">사번</th>
              <th className="py-2 px-2">이름</th>
              <th className="py-2 px-2">부서</th>
              <th className="py-2 px-2">연구소</th>
              <th className="py-2 px-2">역할</th>
              <th className="py-2 px-2">입력 권한</th>
              <th className="py-2 px-2">상태</th>
              <th className="py-2 px-2 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-2 font-mono">{u.employee_id}</td>
                <td className="py-2 px-2 font-medium">{u.name}</td>
                <td className="py-2 px-2">{u.department}</td>
                <td className="py-2 px-2">{u.lab}</td>
                <td className="py-2 px-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
                <td className="py-2 px-2">
                  <div className="flex flex-col gap-0.5 text-xs">
                    {(u.role === 'admin' || u.can_input_test_counts) ? <span className="text-blue-600">시험건수</span> : null}
                    {(u.role === 'admin' || u.can_input_subjects) ? <span className="text-teal-600">시험대상자</span> : null}
                    {u.role !== 'admin' && !u.can_input_test_counts && !u.can_input_subjects && <span className="text-gray-400">없음</span>}
                  </div>
                </td>
                <td className="py-2 px-2">
                  {u.is_active ? <span className="text-green-600">활성</span> : <span className="text-gray-400">비활성</span>}
                </td>
                <td className="py-2 px-2">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => { setEditing(u); setShowForm(true); }} className="p-1.5 hover:bg-gray-200 rounded" title="수정">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleToggleActive(u)} className="p-1.5 hover:bg-gray-200 rounded" title={u.is_active ? '비활성화' : '활성화'}>
                      {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function UserForm({ editing, deptConfig, onClose, onSaved }) {
  const labs = deptConfig?.labs?.length ? deptConfig.labs : ['문정', '가산'];
  const deptsBy = deptConfig?.departments || {};
  const defaultLab = editing?.lab || labs[0];
  const defaultDept = editing?.department || (deptsBy[defaultLab]?.[0] ?? '');
  const [form, setForm] = useState({
    employee_id: editing?.employee_id || '',
    name: editing?.name || '',
    department: defaultDept,
    lab: defaultLab,
    role: editing?.role || 'staff',
    password: '',
    can_input_test_counts: editing?.can_input_test_counts ? true : false,
    can_input_subjects: editing?.can_input_subjects ? true : false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      if (editing) {
        const body = { name: form.name, department: form.department, lab: form.lab, role: form.role, can_input_test_counts: form.can_input_test_counts, can_input_subjects: form.can_input_subjects };
        if (form.password) body.password = form.password;
        await api.put(`/admin/users/${editing.id}`, body);
      } else {
        if (!form.password) { setErr('신규 등록 시 비밀번호는 필수입니다.'); setSaving(false); return; }
        await api.post('/admin/users', form);
      }
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.error?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const deptOptions = deptsBy[form.lab] || [];

  return (
    <form onSubmit={handleSubmit} className="border border-slate-300 rounded-lg p-4 bg-slate-50 space-y-3">
      <h3 className="font-semibold">{editing ? '사용자 수정' : '신규 사용자 등록'}</h3>
      {err && <div className="text-red-600 text-sm">{err}</div>}

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">사번 {editing ? '(변경불가)' : '*'}</label>
          <input
            type="text"
            value={form.employee_id}
            onChange={(e) => update('employee_id', e.target.value)}
            disabled={!!editing}
            required
            className="w-full px-2 py-1.5 border rounded disabled:bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">이름 *</label>
          <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} required className="w-full px-2 py-1.5 border rounded" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">연구소 *</label>
          <select value={form.lab} onChange={(e) => { const nv = e.target.value; update('lab', nv); update('department', (deptsBy[nv] || [])[0] || ''); }} className="w-full px-2 py-1.5 border rounded">
            {labs.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">부서 *</label>
          <select value={form.department} onChange={(e) => update('department', e.target.value)} className="w-full px-2 py-1.5 border rounded">
            {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">권한 *</label>
          <select value={form.role} onChange={(e) => update('role', e.target.value)} className="w-full px-2 py-1.5 border rounded">
            <option value="staff">일반 (staff)</option>
            <option value="manager">매니저 (manager)</option>
            <option value="admin">관리자 (admin)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">비밀번호 {editing ? '(변경 시에만 입력)' : '*'}</label>
          <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} className="w-full px-2 py-1.5 border rounded" />
        </div>
      </div>

      <div className="border-t pt-3">
        <label className="block text-xs font-medium text-gray-600 mb-2">입력 권한 {form.role === 'admin' && <span className="text-purple-600">(관리자는 자동 부여)</span>}</label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.role === 'admin' || form.can_input_test_counts} disabled={form.role === 'admin'} onChange={(e) => update('can_input_test_counts', e.target.checked)} className="rounded" />
            시험건수 입력
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.role === 'admin' || form.can_input_subjects} disabled={form.role === 'admin'} onChange={(e) => update('can_input_subjects', e.target.checked)} className="rounded" />
            시험대상자 입력
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-1.5 border rounded hover:bg-gray-100 text-sm">취소</button>
        <button type="submit" disabled={saving} className="px-4 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 text-sm">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}
