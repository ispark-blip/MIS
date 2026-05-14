/**
 * 금액 표시 포맷 (원 단위 → 항상 억 단위로 표시)
 * 100억 이상: 1,234억 / 1억 이상: 12.3억 / 1억 미만: 0.12억
 */
export function formatCurrency(amount) {
  if (!amount || amount === 0) return '0억';
  const billions = amount / 100000000;

  if (Math.abs(billions) >= 100) {
    return `${Math.round(billions).toLocaleString()}억`;
  }
  if (Math.abs(billions) >= 1) {
    return billions % 1 === 0 ? `${billions}억` : `${billions.toFixed(1)}억`;
  }
  if (Math.abs(billions) >= 0.01) {
    return `${billions.toFixed(2)}억`;
  }
  return `${billions.toFixed(3)}억`;
}

/** 차트 Y축용 (항상 억 단위 정수) */
export function formatAxisLabel(value) {
  if (!value) return '0억';
  const b = value / 100000000;
  if (Math.abs(b) >= 100) return `${Math.round(b).toLocaleString()}억`;
  if (Math.abs(b) >= 1) return `${Math.round(b)}억`;
  return `${b.toFixed(1)}억`;
}

/** 차트 툴팁용 (소수점 1자리 억) */
export function formatTooltip(value) {
  return formatCurrency(value);
}
