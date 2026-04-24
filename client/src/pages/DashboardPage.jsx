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

function SectionHeader({ icon: Icon, title, badge }) {
  return (
    <div className="px-4 sm:px-5 py-2.5 sm:py-3 flex items-center gap-2.5 border-b border-gray-200 shrink-0">
      <Icon size={20} className="text-slate-500 shrink-0" strokeWidth={2.2} />
      <span className="text-base sm:text-lg font-semibold text-slate-600 tracking-tight">{title}</span>
      {badge}
    </div>
  );
}

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

  const refDateBadge = (date) => date ? (
    <span className="text-sm font-medium text-slate-400 ml-1">({date} 기준)</span>
  ) : null;

  return (
    <div className="min-h-screen md:h-screen flex flex-col bg-gray-100">
      <Header onLogout={logout} />

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 auto-rows-[minmax(60vh,1fr)] md:grid-rows-[3fr_2fr] md:auto-rows-auto gap-0 bg-slate-300">
        {/* Q1: 전사 목표 vs 누적 */}
        <section className="bg-white border-b-[3px] md:border-r-[3px] md:border-b-[3px] border-slate-300 flex flex-col min-h-0">
          <SectionHeader icon={TrendingUp} title="전사 목표 vs 누적매출" />
          <div className="flex-1 p-3 sm:p-4 min-h-0">
            <ChartErrorBoundary resetKey={salesData}><SalesDonut data={salesData} /></ChartErrorBoundary>
          </div>
        </section>

        {/* Q2: 부서별 분기 매출 */}
        <section className="bg-white border-b-[3px] md:border-b-[3px] border-slate-300 flex flex-col min-h-0">
          <SectionHeader icon={BarChart3} title="부서별 분기 매출" />
          <div className="flex-1 p-3 sm:p-4 min-h-0">
            <ChartErrorBoundary resetKey={quarterlyData}><QuarterlyBar data={quarterlyData} /></ChartErrorBoundary>
          </div>
        </section>

        {/* Q3: 일일 시험건수 */}
        <section className="bg-white border-b-[3px] md:border-b-0 md:border-r-[3px] border-slate-300 flex flex-col min-h-0">
          <SectionHeader icon={ClipboardList} title="일일 시험건수" badge={refDateBadge(testCountRefDate)} />
          <div className="flex-1 p-3 sm:p-4 min-h-0">
            <ChartErrorBoundary resetKey={testCountData}><TestCountTable data={testCountData} /></ChartErrorBoundary>
          </div>
        </section>

        {/* Q4: 시험대상자 인원수 */}
        <section className="bg-white flex flex-col min-h-0">
          <SectionHeader icon={Users} title="시험대상자 인원수" badge={refDateBadge(subjectRefDate)} />
          <div className="flex-1 p-3 sm:p-4 min-h-0">
            <ChartErrorBoundary resetKey={subjectData}><SubjectCards data={subjectData} /></ChartErrorBoundary>
          </div>
        </section>
      </div>
    </div>
  );
}
