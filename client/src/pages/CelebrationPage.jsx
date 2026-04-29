import { useState, useEffect } from 'react';
import api from '../utils/api';

var AVATAR_COLORS = [
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  'linear-gradient(135deg, #14b8a6, #0d9488)',
  'linear-gradient(135deg, #f97316, #ea580c)',
  'linear-gradient(135deg, #06b6d4, #0891b2)',
  'linear-gradient(135deg, #ec4899, #db2777)',
];

var CATEGORY_COLORS = {
  birthday: 'linear-gradient(135deg, #f59e0b, #d97706)',
  anniversary: 'linear-gradient(135deg, #3b82f6, #2563eb)',
  wedding: 'linear-gradient(135deg, #ec4899, #db2777)',
  condolence: 'linear-gradient(135deg, #94a3b8, #64748b)',
};

function getCols(count) {
  if (count <= 3) return 1;
  return 2;
}

function getSize(count, cols) {
  var rows = Math.ceil(count / cols);
  if (rows <= 3) return 'lg';
  if (rows <= 5) return 'md';
  if (rows <= 8) return 'sm';
  return 'xs';
}

var SIZES = {
  lg: { avatar: 44, avatarFont: 20, name: 20, rank: 14, dept: 14, rowPad: 12, rowGap: 14, date: 18, badgeFont: 15, badgePad: '4px 14px', rowRadius: 10 },
  md: { avatar: 38, avatarFont: 17, name: 18, rank: 13, dept: 13, rowPad: 9, rowGap: 11, date: 16, badgeFont: 14, badgePad: '3px 11px', rowRadius: 9 },
  sm: { avatar: 32, avatarFont: 14, name: 16, rank: 12, dept: 12, rowPad: 6, rowGap: 9, date: 14, badgeFont: 12, badgePad: '3px 9px', rowRadius: 8 },
  xs: { avatar: 26, avatarFont: 12, name: 14, rank: 11, dept: 11, rowPad: 4, rowGap: 7, date: 13, badgeFont: 11, badgePad: '2px 7px', rowRadius: 6 },
};

function Avatar({ name, location, index, type, s }) {
  var label = (location && String(location).trim()) || (name ? name.charAt(0) : '?');
  var fontSize = label.length >= 2 ? Math.round(s.avatarFont * 0.75) : s.avatarFont;
  var bg = type ? CATEGORY_COLORS[type] : AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <div style={{
      width: s.avatar, height: s.avatar, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: fontSize, fontWeight: 700, color: '#fff', flexShrink: 0,
      letterSpacing: label.length >= 2 ? '-0.5px' : 0,
    }}>
      {label}
    </div>
  );
}

function Badge({ text, color, bg, s }) {
  return (
    <span style={{
      display: 'inline-block', padding: s.badgePad, borderRadius: 20,
      fontSize: s.badgeFont, fontWeight: 700, background: bg, color: color,
      whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  );
}

function PersonRow({ person, index, type, s, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: s.rowGap,
      padding: s.rowPad + 'px ' + (s.rowPad + 4) + 'px', borderRadius: s.rowRadius, background: '#f8fafc',
    }}>
      <Avatar name={person.name} location={person.location} index={index} type={type} s={s} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: s.name, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {person.name}
          <span style={{ fontSize: s.rank, color: '#94a3b8', fontWeight: 500, marginLeft: 6 }}>{person.rank}</span>
        </div>
        <div style={{ fontSize: s.dept, color: '#64748b', fontWeight: 500, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.dept}</div>

        {children}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {person._dateDisplay && <div style={{ fontSize: s.date, color: '#1e293b', fontWeight: 700, whiteSpace: 'nowrap' }}>{person._dateDisplay}</div>}
        {person._badge}
        {person._subDate && <div style={{ fontSize: s.dept, color: '#94a3b8', fontWeight: 500, marginTop: 2, whiteSpace: 'nowrap' }}>{person._subDate}</div>}
      </div>
    </div>
  );
}

function CondolenceRow({ person, index, s }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: s.rowGap,
      padding: s.rowPad + 'px ' + (s.rowPad + 4) + 'px', borderRadius: s.rowRadius, background: '#f8fafc',
    }}>
      <Avatar name={person.name} location={person.location} index={index} type="condolence" s={s} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {person.detail && <div style={{ fontSize: s.name, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.detail}</div>}
        <div style={{ fontSize: s.dept, color: '#64748b', fontWeight: 500, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ fontSize: s.name - 2, fontWeight: 700, color: '#1e293b' }}>{person.name}</span>
          <span style={{ marginLeft: 6 }}>{person.rank}</span>
          <span style={{ marginLeft: 6 }}>{person.dept}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {person._dateDisplay && <div style={{ fontSize: s.date, color: '#1e293b', fontWeight: 700, whiteSpace: 'nowrap' }}>{person._dateDisplay}</div>}
      </div>
    </div>
  );
}

function Card({ icon, title, subtitle, borderColor, iconBg, items, cols, scale }) {
  if (!items || items.length === 0) return null;
  var headerPad = scale === 'xs' ? '10px 18px 8px' : scale === 'sm' ? '12px 22px 10px' : '16px 28px 12px';
  var titleFont = scale === 'xs' ? 19 : scale === 'sm' ? 21 : 24;
  var subtitleFont = scale === 'xs' ? 12 : 14;
  var iconSize = scale === 'xs' ? 36 : scale === 'sm' ? 40 : 48;
  var iconFont = scale === 'xs' ? 18 : scale === 'sm' ? 22 : 26;
  var bodyPad = scale === 'xs' ? '0 14px 6px' : scale === 'sm' ? '0 18px 8px' : '0 28px 14px';
  var rows = Math.ceil(items.length / cols);
  var gap = rows > 6 ? 2 : rows > 4 ? 3 : rows > 2 ? 5 : 8;

  var gridBodyStyle = {
    display: 'grid',
    gridTemplateColumns: cols === 2 ? '1fr 1fr' : '1fr',
    gap: gap,
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, height: '100%',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: headerPad, flexShrink: 0,
        borderBottom: '2px solid ' + (borderColor || '#f1f5f9'),
      }}>
        <div style={{
          width: iconSize, height: iconSize, borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: iconFont, flexShrink: 0, background: iconBg || '#f1f5f9',
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: titleFont, fontWeight: 700, color: '#1e293b' }}>{title}</div>
          <div style={{ fontSize: subtitleFont, color: '#94a3b8', fontWeight: 500, marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ flex: 1, padding: bodyPad, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: 12 }}>
        <div style={gridBodyStyle}>
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

  // 1행: 생일, 신규입사, 입사기념일
  var row1 = [];

  if (data.birthdays && data.birthdays.length > 0) {
    var bCols = getCols(data.birthdays.length);
    var bScale = getSize(data.birthdays.length, bCols);
    var bS = SIZES[bScale];
    row1.push({
      key: 'birthday',
      icon: '🎂',
      title: '이달의 생일',
      subtitle: data.month + '월 생일자 ' + data.birthdays.length + '명',
      iconBg: '#fef3c7',
      borderColor: '#fef9ee',
      scale: bScale,
      cols: bCols,
      items: data.birthdays.map(function (p, i) {
        var badge = null;
        if (p.dday === 0) badge = <Badge text="🎉 오늘" bg="#fee2e2" color="#dc2626" s={bS} />;
        else if (p.dday > 0 && p.dday <= 7) badge = <Badge text={'D-' + p.dday} bg="#fef3c7" color="#b45309" s={bS} />;
        return (
          <PersonRow key={i} person={{ ...p, _dateDisplay: p.month + '월 ' + p.day + '일', _badge: badge }} index={i} s={bS} />
        );
      }),
    });
  }

  if (data.newHires && data.newHires.length > 0) {
    var nCols = getCols(data.newHires.length);
    var nScale = getSize(data.newHires.length, nCols);
    var nS = SIZES[nScale];
    row1.push({
      key: 'newHire',
      icon: '🎉',
      title: '신규입사',
      subtitle: data.month + '월 신규입사 ' + data.newHires.length + '명',
      iconBg: '#dcfce7',
      borderColor: '#f0fdf4',
      scale: nScale,
      cols: nCols,
      items: data.newHires.map(function (p, i) {
        return (
          <PersonRow key={i} person={{ ...p, _dateDisplay: p.hireDate, _badge: null }} index={i} type="anniversary" s={nS} />
        );
      }),
    });
  }

  if (data.anniversaries && data.anniversaries.length > 0) {
    var aCols = getCols(data.anniversaries.length);
    var aScale = getSize(data.anniversaries.length, aCols);
    var aS = SIZES[aScale];
    row1.push({
      key: 'anniversary',
      icon: '🏢',
      title: '입사기념일',
      subtitle: data.month + '월 입사기념 ' + data.anniversaries.length + '명',
      iconBg: '#dbeafe',
      borderColor: '#eff6ff',
      scale: aScale,
      cols: aCols,
      items: data.anniversaries.map(function (p, i) {
        var yearsLabel = p.years % 5 === 0 ? p.years + '주년 🎊' : p.years + '주년';
        return (
          <PersonRow key={i} person={{ ...p, _dateDisplay: yearsLabel, _badge: null, _subDate: p.hireDate }} index={i} type="anniversary" s={aS} />
        );
      }),
    });
  }

  // 2행: 결혼, 부고
  var row2 = [];

  if (data.weddings && data.weddings.length > 0) {
    var wCols = getCols(data.weddings.length);
    var wScale = getSize(data.weddings.length, wCols);
    var wS = SIZES[wScale];
    row2.push({
      key: 'wedding',
      icon: '💐',
      title: '결혼',
      subtitle: '축하드립니다',
      iconBg: '#fce7f3',
      borderColor: '#fdf2f8',
      scale: wScale,
      cols: wCols,
      items: data.weddings.map(function (p, i) {
        var badge = <Badge text={ddayText(p.dday)} bg="#fce7f3" color="#be185d" s={wS} />;
        return (
          <PersonRow key={i} person={{ ...p, _dateDisplay: p.date, _badge: badge }} index={i} type="wedding" s={wS} />
        );
      }),
    });
  }

  if (data.condolences && data.condolences.length > 0) {
    var cCols = getCols(data.condolences.length);
    var cScale = getSize(data.condolences.length, cCols);
    var cS = SIZES[cScale];
    row2.push({
      key: 'condolence',
      icon: '🕯️',
      title: '부고',
      subtitle: '삼가 고인의 명복을 빕니다',
      iconBg: '#f1f5f9',
      borderColor: '#f8fafc',
      scale: cScale,
      cols: cCols,
      items: data.condolences.map(function (p, i) {
        return (
          <CondolenceRow key={i} person={{ ...p, _dateDisplay: p.date }} index={i} s={cS} />
        );
      }),
    });
  }

  if (row1.length === 0 && row2.length === 0) {
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

  var hasRow1 = row1.length > 0;
  var hasRow2 = row2.length > 0;
  var rowTemplate = hasRow1 && hasRow2 ? '3fr 2fr' : '1fr';

  function renderRow(cards) {
    return cards.map(function (c) {
      return (
        <div key={c.key} style={{ minHeight: 0 }}>
          <Card icon={c.icon} title={c.title} subtitle={c.subtitle} iconBg={c.iconBg} borderColor={c.borderColor} items={c.items} cols={c.cols} scale={c.scale} />
        </div>
      );
    });
  }

  return (
    <div style={{
      width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
      padding: '32px 40px 28px',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 28, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 38, fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: -0.5 }}>경조사 안내</h1>
          <span style={{ fontSize: 20, color: '#64748b', fontWeight: 500 }}>{data.year}년 {data.month}월</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateRows: rowTemplate, gap: 24, minHeight: 0 }}>
        {hasRow1 && (
          <div style={{ display: 'grid', gridTemplateColumns: row1.map(function () { return '1fr'; }).join(' '), gap: 24, minHeight: 0 }}>
            {renderRow(row1)}
          </div>
        )}
        {hasRow2 && (
          <div style={{ display: 'grid', gridTemplateColumns: row2.map(function () { return '1fr'; }).join(' '), gap: 24, minHeight: 0 }}>
            {renderRow(row2)}
          </div>
        )}
      </div>
    </div>
  );
}
