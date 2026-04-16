import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { ArrowLeft, Settings, Users, Sliders, FilePlus } from 'lucide-react';
import BrandingTab from '../components/admin/BrandingTab';
import UsersTab from '../components/admin/UsersTab';
import DashboardSettingsTab from '../components/admin/DashboardSettingsTab';
import DataInputTab from '../components/admin/DataInputTab';

const TABS = [
  { key: 'branding', label: '브랜딩', icon: Settings },
  { key: 'dashboard', label: '대시보드 설정', icon: Sliders },
  { key: 'users', label: '사용자 관리', icon: Users },
  { key: 'data', label: '데이터 입력', icon: FilePlus },
];

export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('branding');
  const [settings, setSettings] = useState(null);

  // 설정 로드
  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data.data)).catch(() => {});
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">로딩 중...</div>;

  if (!user) {
    window.location.href = '/login?next=/admin';
    return null;
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <h1 className="text-xl font-bold text-red-600">접근 권한이 없습니다</h1>
        <p className="text-sm text-gray-600">관리자(admin) 권한이 필요합니다. 현재 역할: {user.role}</p>
        <button onClick={() => navigate('/dashboard')} className="mt-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">대시보드로 돌아가기</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="h-14 bg-slate-800 text-white flex items-center px-4 gap-4 shrink-0">
        <button onClick={() => navigate('/dashboard')} className="hover:bg-slate-700 rounded-md p-1.5" title="대시보드로">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold">관리자 페이지</h1>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span>{user.name} ({user.role})</span>
          <button onClick={logout} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded">로그아웃</button>
        </div>
      </header>

      {/* 탭 */}
      <nav className="bg-white border-b flex px-4 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
              tab === key ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500 hover:text-slate-600'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {/* 본문 */}
      <main className="flex-1 p-6 max-w-5xl w-full mx-auto">
        {tab === 'branding' && <BrandingTab settings={settings} onSaved={setSettings} />}
        {tab === 'dashboard' && <DashboardSettingsTab settings={settings} onSaved={setSettings} />}
        {tab === 'users' && <UsersTab />}
        {tab === 'data' && <DataInputTab />}
      </main>
    </div>
  );
}
