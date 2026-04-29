import { useEffect } from 'react';
import { useSSE } from '../hooks/useSSE';
import { useAuth } from '../hooks/useAuth';
import useDashboardStore from '../stores/dashboardStore';
import api from '../utils/api';
import Header from '../components/layout/Header';
import SalesDonut from '../components/charts/SalesDonut';
import QuarterlyBar from '../components/charts/QuarterlyBar';
import TestCountTable from '../components/charts/TestCountTable';
import SubjectCards from '../components/charts/SubjectCards';
import ChartErrorBoundary from '../components/charts/ChartErrorBoundary';
import { TrendingUp, BarChart3, ClipboardList, Users } from 'lucide-react';

export default function DashboardPage() {
  useSSE();
  const { logout } = useAuth();

  const {
    selectedLab, selectedYear,
    selectedMonth, selectedDay, selectedQuarter,
    salesData, setSalesData,
    quarterlyData, setQuarterlyData,
    testCountData, setTestCountData,
    subjectData, setSubjectData,
  } = useDashboardStore();

  // 기준일자: 데이터에 포함된 todayDate 중 최신값
  const pickRefDate = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr.reduce((max, r) => (r.todayDate && r.todayDate > max) ? r.todayDate : max, '');
  };
  const formatRefDate = (iso) => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const [, m, d] = iso.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
  };
  const testCountRefDate = formatRefDate(pickRefDate(testCountData));
  const subjectRefDate = formatRefDate(pickRefDate(subjectData));

  // 데이터 로드
  useEffect(() => {
    api.get('/sales/overview', { params: { lab: selectedLab, year: selectedYear } }).then(r => setSalesData(r.data.data)).catch(() => {});
  }, [selectedLab, selectedYear]);

  useEffect(() => {
    api.get('/sales/quarterly', { params: { q: selectedQuarter, year: selectedYear, lab: selectedLab } })
      .then(r => setQuarterlyData(r.data.data)).catch(() => {});
  }, [selectedLab, selectedQuarter, selectedYear]);

  useEffect(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const day = Math.min(selectedDay, daysInMonth);
    api.get('/test-counts/summary', { params: { month: selectedMonth, year: selectedYear, day } })
      .then(r => setTestCountData(r.data.data)).catch(() => {});
    api.get('/subjects/summary', { params: { month: selectedMonth, year: selectedYear, day } })
      .then(r => setSubjectData(r.data.data)).catch(() => {});
  }, [selectedMonth, selectedYear, selectedDay]);

  return (
    <div className="min-h-screen md:h-screen flex flex-col bg-gray-50">
      <Header onLogout={logout} />

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 auto-rows-[minmax(60vh,1fr)] md:grid-rows-[3fr_2fr] md:auto-rows-auto bg-slate-700" style={{ gap: 5 }}>
        {/* Q1: 전사 목표 vs 누적 */}
        <section className="bg-gray-50 flex flex-col min-h-0">
          <div className="bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 border-b border-gray-200 shrink-0">
            <TrendingUp size={22} className="text-slate-600 shrink-0 sm:w-7 sm:h-7" />
            <span className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-700">전사 목표 vs 누적매출</span>
          </div>
          <div className="flex-1 p-2 sm:p-3 min-h-0">
            <ChartErrorBoundary resetKey={salesData}><SalesDonut data={salesData} /></ChartErrorBoundary>
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

        {/* Q3: 일일 시험건수 */}
        <section className="bg-gray-50 flex flex-col min-h-0">
          <div className="bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 border-b border-gray-200 shrink-0">
            <ClipboardList size={22} className="text-slate-600 shrink-0 sm:w-7 sm:h-7" />
            <span className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-700">일일 시험건수</span>
            {testCountRefDate && (
              <span className="text-sm sm:text-base lg:text-lg font-bold text-blue-600">(기준일: {testCountRefDate})</span>
            )}
          </div>
          <div className="flex-1 p-2 sm:p-3 min-h-0">
            <ChartErrorBoundary resetKey={testCountData}><TestCountTable data={testCountData} /></ChartErrorBoundary>
          </div>
        </section>

        {/* Q4: 시험대상자 인원수 */}
        <section className="bg-gray-50 flex flex-col min-h-0">
          <div className="bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 border-b border-gray-200 shrink-0">
            <Users size={22} className="text-slate-600 shrink-0 sm:w-7 sm:h-7" />
            <span className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-700">시험대상자 인원수</span>
            {subjectRefDate && (
              <span className="text-sm sm:text-base lg:text-lg font-bold text-blue-600">(기준일: {subjectRefDate})</span>
            )}
          </div>
          <div className="flex-1 p-2 sm:p-3 min-h-0">
            <ChartErrorBoundary resetKey={subjectData}><SubjectCards data={subjectData} /></ChartErrorBoundary>
          </div>
        </section>
      </div>
    </div>
  );
}
