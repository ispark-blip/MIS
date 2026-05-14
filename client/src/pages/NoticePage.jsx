import { useState, useEffect } from 'react';
import api from '../utils/api';

var CATEGORY_STYLES = {
  '긴급': { bg: '#fee2e2', color: '#dc2626', border: '#ef4444' },
  '안전': { bg: '#dcfce7', color: '#16a34a', border: '#22c55e' },
  '인사': { bg: '#fef3c7', color: '#b45309', border: '#f59e0b' },
  '일반': { bg: '#dbeafe', color: '#1d4ed8', border: '#3b82f6' },
};

function getCategoryStyle(category) {
  if (!category) return CATEGORY_STYLES['일반'];
  return CATEGORY_STYLES[category] || CATEGORY_STYLES['일반'];
}

function getScale(count) {
  if (count <= 3) return 'lg';
  if (count <= 5) return 'md';
  if (count <= 8) return 'sm';
  return 'xs';
}

var SIZES = {
  lg: { title: 36, content: 22, contentLines: 5, meta: 18, badge: 18, badgePad: '6px 18px', cardPad: '22px 28px', cardGap: 14, borderW: 6 },
  md: { title: 30, content: 19, contentLines: 4, meta: 16, badge: 16, badgePad: '5px 15px', cardPad: '18px 24px', cardGap: 11, borderW: 5 },
  sm: { title: 24, content: 16, contentLines: 3, meta: 14, badge: 14, badgePad: '4px 12px', cardPad: '14px 20px', cardGap: 9, borderW: 5 },
  xs: { title: 20, content: 14, contentLines: 2, meta: 12, badge: 12, badgePad: '3px 10px', cardPad: '11px 16px', cardGap: 7, borderW: 4 },
};

function NoticeCard({ notice, s }) {
  var cat = getCategoryStyle(notice.category);
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
      borderLeft: s.borderW + 'px solid ' + cat.border,
      padding: s.cardPad, display: 'flex', flexDirection: 'column', gap: 8,
      overflow: 'hidden',
    }}>
      {/* 1행: 카테고리 + 제목 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          display: 'inline-block', padding: s.badgePad, borderRadius: 12,
          fontSize: s.badge, fontWeight: 700, background: cat.bg, color: cat.color,
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {notice.category || '일반'}
        </span>
        <div style={{
          fontSize: s.title, fontWeight: 800, color: '#0f172a',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1, minWidth: 0,
        }}>
          {notice.title}
        </div>
      </div>

      {/* 2행: 내용 */}
      {notice.content && (
        <div style={{
          fontSize: s.content, color: '#334155', fontWeight: 500, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: s.contentLines, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {notice.content}
        </div>
      )}

      {/* 3행: 날짜 + 작성자 */}
      {(notice.date || notice.author) && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: s.meta, color: '#94a3b8', fontWeight: 500, marginTop: 2,
        }}>
          <span>{notice.date}</span>
          {notice.author && <span>{notice.author}</span>}
        </div>
      )}
    </div>
  );
}

export default function NoticePage() {
  var [notices, setNotices] = useState([]);
  var [loaded, setLoaded] = useState(false);

  useEffect(function () {
    var load = function () {
      api.get('/notices').then(function (r) {
        setNotices(r.data.data || []);
        setLoaded(true);
      }).catch(function () { setLoaded(true); });
    };
    load();
    var interval = setInterval(load, 60000);
    return function () { clearInterval(interval); };
  }, []);

  var scale = getScale(notices.length);
  var s = SIZES[scale];

  return (
    <div style={{
      width: '100%', height: '100vh', overflow: 'hidden',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 타이틀 */}
      <div style={{
        padding: '20px 32px 12px', display: 'flex', alignItems: 'baseline', gap: 14, flexShrink: 0,
      }}>
        <span style={{ fontSize: 36, fontWeight: 800, color: '#0f172a' }}>📢 공지사항</span>
        <span style={{ fontSize: 16, color: '#64748b', fontWeight: 500 }}>전체 {notices.length}건</span>
      </div>

      {/* 컨텐츠 영역 */}
      <div style={{ flex: 1, padding: '0 28px 24px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {!loaded && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 22 }}>
            데이터 로딩 중...
          </div>
        )}
        {loaded && notices.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 22 }}>
            등록된 공지사항이 없습니다
          </div>
        )}
        {loaded && notices.length > 0 && (
          <div style={{
            flex: 1, minHeight: 0, overflow: 'hidden',
            display: 'flex', flexDirection: 'column', gap: s.cardGap,
          }}>
            {notices.map(function (n, i) {
              return <NoticeCard key={i} notice={n} s={s} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
