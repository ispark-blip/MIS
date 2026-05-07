import { useEffect } from 'react';
import { useSSE } from '../hooks/useSSE';
import { useAuth } from '../hooks/useAuth';
import useDashboardStore from '../stores/dashboardStore';
import api from '../utils/api';
import Header from '../components/layout/Header';
import DualSalesDonut from '../components/charts/DualSalesDonut';
import QuarterlyBar from '../components/charts/QuarterlyBar';
import ChartErrorBoundary from '../components/charts/ChartErrorBoundary';
import { TrendingUp, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  useSSE();
  const { logout } = useAuth();

  const {
    selectedLab, selectedYear, selectedQuarter,
    salesData, setSalesData,
    quarterlyData, setQuarterlyData,
  } = useDashboardStore();

  // Q1은 한피연/얼트루를 모두 보여줘야 하므로 selectedLab과 무관하게 '전체'로 조회
  useEffect(() => {
    api.get('/sales/overview', { params: { lab: '전체', year: selectedYear } })
      .then(r => setSalesData(r.data.data)).catch(() => {});
  }, [selectedYear]);

  useEffect(() => {
    api.get('/sales/quarterly', { params: { q: selectedQuarter, year: selectedYear, lab: selectedLab } })
      .then(r => setQuarterlyData(r.data.data)).catch(() => {});
  }, [selectedLab, selectedQuarter, selectedYear]);

  return (
    <div className="min-h-screen md:h-screen flex flex-col bg-gray-50">
      <Header onLogout={logout} />

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 bg-slate-700" style={{ gap: 5 }}>
        {/* Q1: 전사 목표 vs 누적매출 (한피연 + 얼트루) */}
        <section className="bg-gray-50 flex flex-col min-h-0">
          <div className="bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 border-b border-gray-200 shrink-0">
            <TrendingUp size={22} className="text-slate-600 shrink-0 sm:w-7 sm:h-7" />
            <span className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-700">전사 목표 vs 누적매출</span>
          </div>
          <div className="flex-1 p-2 sm:p-3 min-h-0">
            <ChartErrorBoundary resetKey={salesData}><DualSalesDonut data={salesData} /></ChartErrorBoundary>
          </div>
        </section>

        {/* Q2: 부서별 분기 매출 */}
        <section className="bg-gray-50 flex flex-col min-h-0">
          <div className="bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 border-b border-gray-200 shrink-0">
            <BarChart3 size={22} className="text-slate-600 shrink-0 sm:w-7 sm:h-7" />
            <span className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-700">부서별 분기 매출</span>
          </div>
          <div className="flex-1 p-2 sm:p-3 min-h-0">
            <ChartErrorBoundary resetKey={quarterlyData}><QuarterlyBar data={quarterlyData} /></ChartErrorBoundary>
          </div>
        </section>
      </div>
    </div>
  );
}
