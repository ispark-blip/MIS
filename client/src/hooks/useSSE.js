import { useEffect, useRef } from 'react';
import api from '../utils/api';
import useDashboardStore from '../stores/dashboardStore';

export function useSSE() {
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT = 10;
  const store = useDashboardStore.getState;

  const refreshAllData = async () => {
    const s = store();
    try {
      const [sales, quarterly, testCounts, subjects] = await Promise.all([
        api.get('/sales/overview', { params: { lab: s.selectedLab, year: s.selectedYear } }),
        api.get('/sales/quarterly', { params: { q: s.selectedQuarter, year: s.selectedYear, lab: s.selectedLab } }),
        api.get('/test-counts/summary', { params: { month: s.selectedMonth, year: s.selectedYear } }),
        api.get('/subjects/summary', { params: { month: s.selectedMonth, year: s.selectedYear } }),
      ]);
      useDashboardStore.setState({
        salesData: sales.data.data,
        quarterlyData: quarterly.data.data,
        testCountData: testCounts.data.data,
        subjectData: subjects.data.data,
      });
    } catch (err) {
      console.error('[SSE] 데이터 재조회 실패:', err.message);
    }
  };

  useEffect(() => {
    let eventSource;

    const connect = () => {
      eventSource = new EventSource('/api/events', { withCredentials: true });

      eventSource.addEventListener('connected', () => {
        if (reconnectAttempts.current > 0) refreshAllData();
        reconnectAttempts.current = 0;
        useDashboardStore.setState({ connectionStatus: 'connected' });
      });

      eventSource.addEventListener('sales-update', () => {
        refreshAllData();
      });

      eventSource.addEventListener('test-count-update', () => {
        refreshAllData();
      });

      eventSource.addEventListener('subjects-update', () => {
        refreshAllData();
      });

      eventSource.addEventListener('celebrations-update', () => {
        refreshAllData();
      });

      eventSource.onerror = () => {
        eventSource.close();
        useDashboardStore.setState({ connectionStatus: 'disconnected' });
        if (reconnectAttempts.current < MAX_RECONNECT) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current += 1;
          setTimeout(connect, delay);
        }
      };
    };

    connect();
    return () => { if (eventSource) eventSource.close(); };
  }, []);
}
