import { Component } from 'react';

export default class ChartErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[차트 렌더 오류]', error, info);
  }

  componentDidUpdate(prevProps) {
    // data prop 변경 시 에러 상태 리셋 (새 데이터로 재시도)
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          일시적 표시 오류 — 데이터 갱신 대기 중
        </div>
      );
    }
    return this.props.children;
  }
}
