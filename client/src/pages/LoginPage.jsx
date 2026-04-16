import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogIn } from 'lucide-react';
import api from '../utils/api';

export default function LoginPage() {
  const { login, user } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState({ company_name: '한국피부과학연구원', company_abbr: 'KIDS', system_title: '경영정보현황시스템', logo_url: '' });

  const nextParam = new URLSearchParams(window.location.search).get('next');

  useEffect(() => {
    api.get('/settings').then(r => {
      const s = r.data.data || {};
      setBranding({
        company_name: s.company_name || '한국피부과학연구원',
        company_abbr: s.company_abbr || 'KIDS',
        system_title: s.system_title || '경영정보현황시스템',
        logo_url: s.logo_url || '',
      });
    }).catch(() => {});
  }, []);

  if (user) {
    window.location.href = nextParam || '/dashboard';
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(employeeId, password, nextParam);
    } catch (err) {
      setError(err.response?.data?.error?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-3 overflow-hidden">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="로고" className="max-w-full max-h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <span className="text-white text-lg font-bold">{branding.company_abbr}</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-800">{branding.system_title}</h1>
          <p className="text-sm text-gray-500 mt-1">{branding.company_name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사번</label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="사번 입력"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="비밀번호 입력"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-800 text-white py-2.5 rounded-lg hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn size={18} />
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
