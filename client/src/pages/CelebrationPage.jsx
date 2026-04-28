import { useState, useEffect } from 'react';
import api from '../utils/api';

const AVATAR_COLORS = [
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  'linear-gradient(135deg, #14b8a6, #0d9488)',
  'linear-gradient(135deg, #f97316, #ea580c)',
  'linear-gradient(135deg, #06b6d4, #0891b2)',
  'linear-gradient(135deg, #ec4899, #db2777)',
];

const CATEGORY_COLORS = {
  birthday: 'linear-gradient(135deg, #f59e0b, #d97706)',
  anniversary: 'linear-gradient(135deg, #3b82f6, #2563eb)',
  wedding: 'linear-gradient(135deg, #ec4899, #db2777)',
  condolence: 'linear-gradient(135deg, #94a3b8, #64748b)',
};

function Avatar({ name, index, type }) {
  var initial = name ? name.charAt(0) : '?';
  var bg = type ? CATEGORY_COLORS[type] : AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <div style={{
      width: 48, height: 48, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {initial}
    </div>
  );
}

function Badge({ text, color, bg }) {
  return (
    <span style={{
      display: 'inline-block', padding: '5px 16px', borderRadius: 20,
      fontSize: 17, fontWeight: 700, marginTop: 6, background: bg, color: color,
    }}>
      {text}
    </span>
  );
}

function PersonRow({ person, index, type, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 18px', borderRadius: 12, background: '#f8fafc',
    }}>
      <Avatar name={person.name} index={index} type={type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
          {person.name}
          <span style={{ fontSize: 15, color: '#94a3b8', fontWeight: 500, marginLeft: 8 }}>{person.rank}</span>
        </div>
        <div style={{ fontSize: 15, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{person.dept}</div>
        {children}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {person._dateDisplay && <div style={{ fontSize: 20, color: '#1e293b', fontWeight: 700 }}>{person._dateDisplay}</div>}
        {person._badge}
      </div>
    </div>
  );
}

function Card({ icon, title, subtitle, borderColor, iconBg, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{
      background: '#fff', borderRadius: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, height: '100%',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '22px 28px 18px', flexShrink: 0,
        borderBottom: '2px solid ' + (borderColor || '#f1f5f9'),
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, flexShrink: 0, background: iconBg || '#f1f5f9',
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1e293b' }}>{title}</div>
          <div style={{ fontSize: 15, color: '#94a3b8', fontWeight: 500, marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ flex: 1, padding: '0 28px 24px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items}
        </div>
      </div>
    </div>
  );
}

function ddayText(dday) {
  if (dday === 0) return '오늘';
  if (dday > 0) return 'D-' + dday;
  return 'D+' + Math.abs(dday);
}

export default function CelebrationPage() {
  var [data, setData] = useState(null);

  useEffect(function () {
    api.get('/celebrations').then(function (r) { setData(r.data.data); }).catch(function () {});
    var interval = setInterval(function () {
      api.get('/celebrations').then(function (r) { setData(r.data.data); }).catch(function () {});
    }, 60000);
    return function () { clearInterval(interval); };
  }, []);

  if (!data) {
    return (
      <div style={{
        width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        color: '#94a3b8', fontSize: 20,
      }}>
        데이터 로딩 중...
      </div>
    );
  }

  var cards = [];

  // 생일
  if (data.birthdays && data.birthdays.length > 0) {
    cards.push({
      key: 'birthday',
      icon: '🎂',
      title: '이달의 생일',
      subtitle: data.month + '월 생일자 ' + data.birthdays.length + '명',
      iconBg: '#fef3c7',
      borderColor: '#fef9ee',
      items: data.birthdays.map(function (p, i) {
        var badge = null;
        if (p.dday === 0) badge = <Badge text="🎉 오늘" bg="#fee2e2" color="#dc2626" />;
        else if (p.dday > 0 && p.dday <= 7) badge = <Badge text={'D-' + p.dday} bg="#fef3c7" color="#b45309" />;
        return (
          <PersonRow key={i} person={{ ...p, _dateDisplay: p.month + '월 ' + p.day + '일', _badge: badge }} index={i} />
        );
      }),
    });
  }

  // 입사기념일
  if (data.anniversaries && data.anniversaries.length > 0) {
    cards.push({
      key: 'anniversary',
      icon: '🏢',
      title: '입사기념일',
      subtitle: data.month + '월 입사기념 ' + data.anniversaries.length + '명',
      iconBg: '#dbeafe',
      borderColor: '#eff6ff',
      items: data.anniversaries.map(function (p, i) {
        var badge = <Badge text={p.years + '주년'} bg="#dbeafe" color="#1d4ed8" />;
        if (p.years % 5 === 0) badge = <Badge text={p.years + '주년 🎊'} bg="#dbeafe" color="#1d4ed8" />;
        return (
          <PersonRow key={i} person={{ ...p, _dateDisplay: p.hireDate, _badge: badge }} index={i} type="anniversary" />
        );
      }),
    });
  }

  // 결혼
  if (data.weddings && data.weddings.length > 0) {
    cards.push({
      key: 'wedding',
      icon: '💐',
      title: '결혼',
      subtitle: '축하드립니다',
      iconBg: '#fce7f3',
      borderColor: '#fdf2f8',
      items: data.weddings.map(function (p, i) {
        var badge = <Badge text={ddayText(p.dday)} bg="#fce7f3" color="#be185d" />;
        return (
          <PersonRow key={i} person={{ ...p, _dateDisplay: p.date, _badge: badge }} index={i} type="wedding" />
        );
      }),
    });
  }

  // 부고
  if (data.condolences && data.condolences.length > 0) {
    cards.push({
      key: 'condolence',
      icon: '🕯️',
      title: '부고',
      subtitle: '삼가 고인의 명복을 빕니다',
      iconBg: '#f1f5f9',
      borderColor: '#f8fafc',
      items: data.condolences.map(function (p, i) {
        return (
          <PersonRow key={i} person={{ ...p, _dateDisplay: p.date, _badge: null }} index={i} type="condolence">
            {p.detail && <div style={{ fontSize: 15, color: '#475569', marginTop: 4 }}>{p.detail}</div>}
          </PersonRow>
        );
      }),
    });
  }

  var count = cards.length;
  var gridStyle = { flex: 1, display: 'grid', gap: 24, minHeight: 0 };
  if (count === 1) {
    gridStyle.gridTemplateColumns = '1fr';
    gridStyle.gridTemplateRows = '1fr';
  } else if (count === 2) {
    gridStyle.gridTemplateColumns = '1fr 1fr';
    gridStyle.gridTemplateRows = '1fr';
  } else if (count === 3) {
    gridStyle.gridTemplateColumns = '1fr 1fr';
    gridStyle.gridTemplateRows = '1fr 1fr';
  } else {
    gridStyle.gridTemplateColumns = '1fr 1fr';
    gridStyle.gridTemplateRows = '1fr 1fr';
  }

  if (count === 0) {
    return (
      <div style={{
        width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        color: '#94a3b8', fontSize: 24,
      }}>
        이번 달 경조사 일정이 없습니다
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
      padding: '32px 40px 28px',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      overflow: 'hidden',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 28, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 38, fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: -0.5 }}>경조사 안내</h1>
          <span style={{ fontSize: 20, color: '#64748b', fontWeight: 500 }}>{data.year}년 {data.month}월</span>
        </div>
      </div>

      {/* 동적 그리드 */}
      <div style={gridStyle}>
        {cards.map(function (c, idx) {
          var wrapStyle = { minHeight: 0 };
          if (count === 3 && idx === 2) wrapStyle.gridColumn = '1 / -1';
          return (
            <div key={c.key} style={wrapStyle}>
              <Card icon={c.icon} title={c.title} subtitle={c.subtitle} iconBg={c.iconBg} borderColor={c.borderColor} items={c.items} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
