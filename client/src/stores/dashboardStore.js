import { create } from 'zustand';

const useDashboardStore = create((set) => ({
  // 사용자
  user: null,
  setUser: (user) => set({ user }),

  // 필터
  selectedLab: '전체',
  setSelectedLab: (lab) => set({ selectedLab: lab }),
  selectedYear: new Date().getFullYear(),
  setSelectedYear: (year) => set({ selectedYear: year }),
  selectedMonth: new Date().getMonth() + 1,
  setSelectedMonth: (month) => set({ selectedMonth: month }),
  selectedQuarter: `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`,
  setSelectedQuarter: (q) => set({ selectedQuarter: q }),

  // Q1/Q2 매출 데이터
  salesData: null,
  setSalesData: (data) => set({ salesData: data }),
  quarterlyData: null,
  setQuarterlyData: (data) => set({ quarterlyData: data }),

  // Q3 시험건수
  testCountData: [],
  setTestCountData: (data) => set({ testCountData: data }),

  // Q4 시험대상자
  subjectData: [],
  setSubjectData: (data) => set({ subjectData: data }),

  // SSE 연결 상태
  connectionStatus: 'disconnected',
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));

export default useDashboardStore;
