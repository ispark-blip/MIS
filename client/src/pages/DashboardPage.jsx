import { useEffect } from 'react';
import { useSSE } from '../hooks/useSSE';
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

  const {
    selectedLab, selectedYear, selectedMonth, selectedQuarter,
    salesData, setSalesData,
    quarterlyData, setQuarterlyData,
    testCountData, setTestCountData,
    subjectData, setSubjectData,
  } = useDashboardStore();

  // 데이터 로드
  useEffect(() => {
    api.get('/sales/overview', { params: { lab: selectedLab, year: selectedYear } }).then(r => setSalesData(r.data.data)).catch(() => {});
    api.get('/subjects/summary').then(r => setSubjectData(r.data.data)).catch(() => {});
  }, [selectedLab, selectedYear]);

  useEffect(() => {
    api.get('/sales/quarterly', { params: { q: selectedQuarter, year: selectedYear, lab: selectedLab } })
      .then(r => setQuarterlyData(r.data.data)).catch(() => {});
  }, [selectedLab, selectedQuarter, selectedYear]);

  useEffect(() => {
    api.get('/test-counts/summary')
      .then(r => setTestCountData(r.data.data)).catch(() => {});
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 grid-rows-[1fr_1fr] gap-0">
        {/* Q1: 전사 목표 vs 누적 */}
        <section className="border-b border-r border-gray-200 flex flex-col min-h-0">
          <div className="bg-slate-50 px-4 py-3 flex items-center gap-3 border-b border-gray-200 shrink-0">
            <TrendingUp size={28} className="text-slate-600" />
            <span className="text-2xl font-bold text-slate-700">전사 목표 vs 누적매출</span>
          </div>
          <div className="flex-1 p-3 min-h-0">
            <ChartErrorBoundary resetKey={salesData}><SalesDonut data={salesData} /></ChartErrorBoundary>
          </div>
        </section>

        {/* Q2: 부서별 분기 매출 */}
        <section className="border-b border-gray-200 flex flex-col min-h-0">
          <div className="bg-slate-50 px-4 py-3 flex items-center gap-3 border-b border-gray-200 shrink-0">
            <BarChart3 size={28} className="text-slate-600" />
            <span className="text-2xl font-bold text-slate-700">부서별 분기 매출</span>
          </div>
          <div className="flex-1 p-3 min-h-0">
            <ChartErrorBoundary resetKey={quarterlyData}><QuarterlyBar data={quarterlyData} /></ChartErrorBoundary>
          </div>
        </section>

        {/* Q3: 일일 시험건수 */}
        <section className="border-r border-gray-200 flex flex-col min-h-0">
          <div className="bg-slate-50 px-4 py-3 flex items-center gap-3 border-b border-gray-200 shrink-0">
            <ClipboardList size={28} className="text-slate-600" />
            <span className="text-2xl font-bold text-slate-700">일일 시험건수</span>
          </div>
          <div className="flex-1 p-3 min-h-0">
            <ChartErrorBoundary resetKey={testCountData}><TestCountTable data={testCountData} /></ChartErrorBoundary>
          </div>
        </section>

        {/* Q4: 시험대상자 인원수 */}
        <section className="flex flex-col min-h-0">
          <div className="bg-slate-50 px-4 py-3 flex items-center gap-3 border-b border-gray-200 shrink-0">
            <Users size={28} className="text-slate-600" />
            <span className="text-2xl font-bold text-slate-700">시험대상자 인원수</span>
          </div>
          <div className="flex-1 p-3 min-h-0">
            <ChartErrorBoundary resetKey={subjectData}><SubjectCards data={subjectData} /></ChartErrorBoundary>
          </div>
        </section>
      </div>
    </div>
  );
}
