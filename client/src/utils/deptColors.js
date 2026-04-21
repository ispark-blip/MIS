// 부서별 고정 색상 매핑 (전사/분기/시험건수 차트에서 공용)
export const DEPT_COLORS = {
  '가산 임상팀': '#3b82f6',
  '문정 임상팀': '#14b8a6',
  '비임상': '#8b5cf6',
  '원료개발팀': '#f59e0b',
  '자외선실': '#ef4444',
  '임상1팀': '#3b82f6',
  '임상2팀': '#14b8a6',
  '비임상팀': '#8b5cf6',
  '경영지원팀': '#f59e0b',
  '시험검사팀': '#ef4444',
  '특수시험팀': '#6366f1',
};

// 신규 부서용 색상 풀 (DEPT_COLORS와 중복되지 않는 색상)
const EXTRA_COLOR_POOL = [
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#a855f7',
  '#0ea5e9', '#d946ef', '#10b981', '#f43f5e', '#78716c',
  '#0d9488', '#7c3aed', '#e11d48', '#ca8a04', '#0369a1',
  '#be185d', '#15803d', '#7e22ce', '#b91c1c', '#a16207',
];

// 부서명 → 결정적 해시. 호출 순서/시점에 무관하게 항상 같은 색을 반환.
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getDeptColor(name) {
  if (DEPT_COLORS[name]) return DEPT_COLORS[name];
  if (!name) return EXTRA_COLOR_POOL[0];
  const idx = hashString(name) % EXTRA_COLOR_POOL.length;
  return EXTRA_COLOR_POOL[idx];
}
