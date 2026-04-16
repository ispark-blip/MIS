// 부서별 고정 색상 매핑 (전사/분기/시험건수 차트에서 공용)
export const DEPT_COLORS = {
  // Google Sheets 실제 부서명
  '가산 임상팀': '#3b82f6',
  '문정 임상팀': '#14b8a6',
  '비임상': '#8b5cf6',
  '원료개발팀': '#f59e0b',
  '자외선실': '#ef4444',
  // 기존 호환용
  '임상1팀': '#3b82f6',
  '임상2팀': '#14b8a6',
  '비임상팀': '#8b5cf6',
  '경영지원팀': '#f59e0b',
  '시험검사팀': '#ef4444',
  '특수시험팀': '#6366f1',
};

const FALLBACK = ['#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4', '#f97316'];

export function getDeptColor(name, fallbackIndex = 0) {
  return DEPT_COLORS[name] || FALLBACK[fallbackIndex % FALLBACK.length];
}
