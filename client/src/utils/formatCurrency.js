/**
 * 금액 표시 포맷 (원 단위 → 표시용)
 * 1억 이상: X.X억 / 1천만 이상: X,XXX만 / 그 외: X,XXX,XXX원
 */
export function formatCurrency(amount) {
  if (amount === 0) return '0원';
  if (amount >= 100000000) {
    const billions = amount / 100000000;
    return billions % 1 === 0 ? `${billions}억` : `${billions.toFixed(1)}억`;
  }
  if (amount >= 10000000) {
    return `${Math.round(amount / 10000).toLocaleString()}만`;
  }
  return `${amount.toLocaleString()}원`;
}

/** 차트 Y축용 (항상 억 단위) */
export function formatAxisLabel(value) {
  return `${(value / 100000000).toFixed(0)}억`;
}

/** 차트 툴팁용 (소수점 2자리 억) */
export function formatTooltip(value) {
  return `${(value / 100000000).toFixed(2)}억`;
}
