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

const COLOR_POOL = [
  '#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444',
  '#6366f1', '#06b6d4', '#f97316', '#ec4899', '#84cc16',
  '#a855f7', '#0ea5e9', '#d946ef', '#10b981', '#f43f5e',
  '#78716c', '#0d9488', '#7c3aed', '#e11d48', '#ca8a04',
];

const usedColorsInSession = new Set();
const dynamicAssignments = {};

export function getDeptColor(name, _fallbackIndex = 0) {
  if (DEPT_COLORS[name]) return DEPT_COLORS[name];
  if (dynamicAssignments[name]) return dynamicAssignments[name];

  const taken = new Set([
    ...Object.values(DEPT_COLORS),
    ...usedColorsInSession,
  ]);
  const available = COLOR_POOL.find(c => !taken.has(c));
  const color = available || COLOR_POOL[Object.keys(dynamicAssignments).length % COLOR_POOL.length];

  dynamicAssignments[name] = color;
  usedColorsInSession.add(color);
  return color;
}

export function getDeptColors(deptNames) {
  return deptNames.map((name, i) => getDeptColor(name, i));
}
