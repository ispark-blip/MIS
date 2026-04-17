import { RefreshCw, LogOut, LogIn, Menu, X, Settings, ClipboardList, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useDashboardStore from '../../stores/dashboardStore';
import api from '../../utils/api';

export default function Header({ onLogout }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [branding, setBranding] = useState({ company_abbr: 'KIDS', system_title: '경영정보현황시스템', logo_url: '' });

  const {
    user, selectedLab, setSelectedLab,
    selectedYear, setSelectedYear,
    selectedMonth, setSelectedMonth,
    connectionStatus,
  } = useDashboardStore();

  // 브랜딩 로드
  useEffect(() => {
    api.get('/settings').then(r => {
      const s = r.data.data || {};
      setBranding({
        company_abbr: s.company_abbr || 'KIDS',
        system_title: s.system_title || '경영정보현황시스템',
        logo_url: s.logo_url || '',
      });
    }).catch(() => {});
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post('/sales/refresh');
    } catch { /* ignore */ }
    setRefreshing(false);
  };

  return (
    <header className="h-16 bg-slate-800 text-white flex items-center px-4 gap-4 shrink-0">
      {/* 로고 + 타이틀 */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-sm font-bold overflow-hidden">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt="로고" className="max-w-full max-h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <span>{branding.company_abbr}</span>
          )}
        </div>
        <h1 className="text-lg font-bold hidden sm:block">{branding.system_title}</h1>
      </div>

      {/* 모바일 메뉴 토글 */}
      <button className="md:hidden ml-auto" onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* 필터/액션 영역 */}
      <div className={`${mobileOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row absolute md:relative top-16 md:top-0 left-0 right-0 bg-slate-800 md:bg-transparent p-4 md:p-0 gap-3 md:gap-3 ml-auto items-stretch md:items-center z-50`}>
        {/* 연구소 선택 */}
        <select
          value={selectedLab}
          onChange={(e) => setSelectedLab(e.target.value)}
          className="bg-slate-700 text-white text-sm rounded-md px-2 py-1.5 border-0 focus:ring-1 focus:ring-white/30"
        >
          <option value="전체">전체</option>
          <option value="문정">문정</option>
          <option value="가산">가산</option>
        </select>

        {/* 연도/월 선택 */}
        <div className="flex gap-1">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-slate-700 text-white text-sm rounded-md px-2 py-1.5 border-0"
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="bg-slate-700 text-white text-sm rounded-md px-2 py-1.5 border-0"
          >
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}월</option>)}
          </select>
        </div>

        {/* 새로고침 */}
        <button onClick={handleRefresh} disabled={refreshing} className="hover:bg-slate-700 rounded-md p-1.5 transition-colors" title="새로고침">
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>

        {/* SSE 상태 */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="hidden lg:inline">{connectionStatus === 'connected' ? '실시간' : '연결끊김'}</span>
        </div>

        {/* 데이터 입력 / 사용자 */}
        <div className="flex items-center gap-2 md:ml-2">
          {user ? (
            <>
              {(user.role === 'admin' || user.can_input_test_counts) && (
                <button onClick={() => navigate('/input/test-counts')} className="hover:bg-slate-700 rounded-md p-1.5 transition-colors" title="시험건수 입력">
                  <ClipboardList size={18} />
                </button>
              )}
              {(user.role === 'admin' || user.can_input_subjects) && (
                <button onClick={() => navigate('/input/subjects')} className="hover:bg-slate-700 rounded-md p-1.5 transition-colors" title="시험대상자 입력">
                  <Users size={18} />
                </button>
              )}
              <span className="text-sm">{user.name}</span>
              {user.role === 'admin' && (
                <button onClick={() => navigate('/admin')} className="hover:bg-slate-700 rounded-md p-1.5 transition-colors" title="관리자 페이지">
                  <Settings size={18} />
                </button>
              )}
              {onLogout && (
                <button onClick={onLogout} className="hover:bg-slate-700 rounded-md p-1.5 transition-colors" title="로그아웃">
                  <LogOut size={18} />
                </button>
              )}
            </>
          ) : (
            <button onClick={() => navigate('/login')} className="hover:bg-slate-700 rounded-md p-1.5 transition-colors" title="어드민 로그인">
              <LogIn size={18} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
