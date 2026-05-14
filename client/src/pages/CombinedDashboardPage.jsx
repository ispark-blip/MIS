import { useState, useEffect } from 'react';
import { useSSE } from '../hooks/useSSE';
import useDashboardStore from '../stores/dashboardStore';
import api from '../utils/api';
import SalesDonut from '../components/charts/SalesDonut';
import QuarterlyBar from '../components/charts/QuarterlyBar';
import TestCountTable from '../components/charts/TestCountTable';
import SubjectCards from '../components/charts/SubjectCards';
import ChartErrorBoundary from '../components/charts/ChartErrorBoundary';
import { TrendingUp, BarChart3, ClipboardList, Users } from 'lucide-react';

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
  newHire: 'linear-gradient(135deg, #10b981, #059669)',
  wedding: 'linear-gradient(135deg, #ec4899, #db2777)',
  condolence: 'linear-gradient(135deg, #94a3b8, #64748b)',
};

var LOCATION_COLORS = {
  '가산': 'linear-gradient(135deg, #6366f1, #4f46e5)',
  '문정': 'linear-gradient(135deg, #14b8a6, #0d9488)',
};

function getLocationBg(location) {
  if (!location) return null;
  var key = String(location).trim();
  if (LOCATION_COLORS[key]) return LOCATION_COLORS[key];
  var hash = 0;
  for (var i = 0; i < key.length; i++) hash = ((hash << 5) - hash) + key.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function MiniAvatar({ name, location, index, type }) {
  var label = (location && String(location).trim()) || (name ? name.charAt(0) : '?');
  var fontSize = label.length >= 2 ? 11 : 14;
  var bg = getLocationBg(location) || (type ? CATEGORY_COLORS[type] : AVATAR_COLORS[index % AVATAR_COLORS.length]);
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: fontSize, fontWeight: 700, color: '#fff', flexShrink: 0,
      letterSpacing: label.length >= 2 ? '-0.5px' : 0,
    }}>
      {label}
    </div>
  );
}

function MiniPersonRow({ person, index, type, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 7px', borderRadius: 6, background: '#f8fafc', marginBottom: 3,
    }}>
      <MiniAvatar name={person.name} location={person.location} index={index} type={type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {person.name}
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginLeft: 4 }}>{person.rank}</span>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{person.dept}</div>
        {children}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {person._dateDisplay && <div style={{ fontSize: 14, color: '#1e293b', fontWeight: 700, whiteSpace: 'nowrap' }}>{person._dateDisplay}</div>}
        {person._subDate && <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{person._subDate}</div>}
        {person._badge}
      </div>
    </div>
  );
}

function MiniCondolenceRow({ person, index }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 7px', borderRadius: 6, background: '#f8fafc', marginBottom: 3,
    }}>
      <MiniAvatar name={person.name} location={person.location} index={index} type="condolence" />
      <div style={{ flex: 1, minWidth: 0 }}>
        {person.detail && <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.detail}</div>}
        <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>{person.name}</span>
          <span style={{ marginLeft: 5 }}>{person.rank}</span>
          <span style={{ marginLeft: 5 }}>{person.dept}</span>
        </div>
      </div>
      <div style={{ fontSize: 14, color: '#1e293b', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>{person._dateDisplay}</div>
    </div>
  );
}

function MiniBadge({ text, bg, color }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10,
      fontSize: 11, fontWeight: 700, background: bg, color: color, whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  );
}

function CelebSection({ emoji, title, count, children }) {
  if (!count) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 15, fontWeight: 800, color: '#1e293b',
        padding: '5px 0', borderBottom: '1px solid #f1f5f9', marginBottom: 5,
      }}>
        <span style={{ fontSize: 16 }}>{emoji}</span> {title}
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginLeft: 'auto' }}>{count}명</span>
      </div>
      {children}
    </div>
  );
}

function ddayText(dday) {
  if (dday === 0) return '오늘';
  if (dday > 0) return 'D-' + dday;
  return 'D+' + Math.abs(dday);
}

function CelebrationPanel({ data }) {
  if (!data) return null;

  return (
    <div style={{
      flex: '0 0 20%', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      borderLeft: '5px solid #334155', minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>경조사 안내</span>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{data.year}년 {data.month}월</span>
      </div>
      <div style={{
        flex: 1, background: '#fff', borderRadius: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        padding: '10px 12px', overflow: 'hidden', margin: '0 10px 10px',
        display: 'flex', flexDirection: 'column',
      }}>
        <CelebSection emoji="🎂" title="이달의 생일" count={data.birthdays && data.birthdays.length}>
          {(data.birthdays || []).map(function (p, i) {
            var badge = null;
            if (p.dday === 0) badge = <MiniBadge text="🎉 오늘" bg="#fee2e2" color="#dc2626" />;
            else if (p.dday > 0 && p.dday <= 7) badge = <MiniBadge text={'D-' + p.dday} bg="#fef3c7" color="#b45309" />;
            return <MiniPersonRow key={i} person={{ ...p, _dateDisplay: p.month + '월 ' + p.day + '일', _badge: badge }} index={i} />;
          })}
        </CelebSection>

        <CelebSection emoji="🎉" title="신규입사" count={data.newHires && data.newHires.length}>
          {(data.newHires || []).map(function (p, i) {
            return <MiniPersonRow key={i} person={{ ...p, _dateDisplay: p.hireDate }} index={i} type="newHire" />;
          })}
        </CelebSection>

        <CelebSection emoji="🏢" title="입사기념일" count={data.anniversaries && data.anniversaries.length}>
          {(data.anniversaries || []).map(function (p, i) {
            var yearsLabel = p.years % 5 === 0 ? p.years + '주년 🎊' : p.years + '주년';
            return <MiniPersonRow key={i} person={{ ...p, _dateDisplay: yearsLabel, _subDate: p.hireDate }} index={i} type="anniversary" />;
          })}
        </CelebSection>

        <CelebSection emoji="💐" title="결혼" count={data.weddings && data.weddings.length}>
          {(data.weddings || []).map(function (p, i) {
            var badge = <MiniBadge text={ddayText(p.dday)} bg="#fce7f3" color="#be185d" />;
            return <MiniPersonRow key={i} person={{ ...p, _dateDisplay: p.date, _badge: badge }} index={i} type="wedding" />;
          })}
        </CelebSection>

        <CelebSection emoji="🕯️" title="부고" count={data.condolences && data.condolences.length}>
          {(data.condolences || []).map(function (p, i) {
            return <MiniCondolenceRow key={i} person={{ ...p, _dateDisplay: p.date }} index={i} />;
          })}
        </CelebSection>
      </div>
    </div>
  );
}

function NoticePanel({ notices }) {
  return (
    <div style={{
      flex: '0 0 20%', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      borderLeft: '5px solid #334155', minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>공지사항</span>
      </div>
      <div style={{
        flex: 1, background: '#fff', borderRadius: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        padding: '10px 12px', overflow: 'hidden', margin: '0 10px 10px',
        display: 'flex', flexDirection: 'column', gap: 5,
      }}>
        {(!notices || notices.length === 0) && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
            공지사항이 없습니다
          </div>
        )}
        {(notices || []).map(function (n, i) {
          var catStyle = { background: '#dbeafe', color: '#1d4ed8' };
          if (n.category === '긴급') catStyle = { background: '#fee2e2', color: '#dc2626' };
          else if (n.category === '안전') catStyle = { background: '#dcfce7', color: '#16a34a' };
          else if (n.category === '인사') catStyle = { background: '#fef3c7', color: '#b45309' };
          var borderColor = n.category === '긴급' ? '#ef4444' : '#3b82f6';
          return (
            <div key={i} style={{
              padding: '10px 12px', borderRadius: 8, background: '#f8fafc',
              borderLeft: '4px solid ' + borderColor,
            }}>
              {/* 1행: 카테고리 + 제목 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 10,
                  fontSize: 11, fontWeight: 700, flexShrink: 0, ...catStyle,
                }}>
                  {n.category || '일반'}
                </span>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                  {n.title}
                </div>
              </div>
              {/* 2행: 내용 */}
              {n.content && (
                <div style={{
                  fontSize: 14, color: '#334155', fontWeight: 500, lineHeight: 1.45, marginBottom: 6,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {n.content}
                </div>
              )}
              {/* 3행: 날짜 + 작성자 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
                <span>{n.date}</span>
                {n.author && <span>{n.author}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CombinedDashboardPage() {
  useSSE();

  var {
    selectedLab, selectedYear, selectedMonth, selectedDay, selectedQuarter,
    salesData, setSalesData, quarterlyData, setQuarterlyData,
    testCountData, setTestCountData, subjectData, setSubjectData,
  } = useDashboardStore();

  var [celebData, setCelebData] = useState(null);
  var [notices, setNotices] = useState([]);

  var pickRefDate = function (arr) {
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr.reduce(function (max, r) { return (r.todayDate && r.todayDate > max) ? r.todayDate : max; }, '');
  };
  var formatRefDate = function (iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    var parts = iso.split('-');
    return parseInt(parts[1]) + '/' + parseInt(parts[2]);
  };
  var testCountRefDate = formatRefDate(pickRefDate(testCountData));
  var subjectRefDate = formatRefDate(pickRefDate(subjectData));

  useEffect(function () {
    api.get('/sales/overview', { params: { lab: selectedLab, year: selectedYear } }).then(function (r) { setSalesData(r.data.data); }).catch(function () {});
  }, [selectedLab, selectedYear]);

  useEffect(function () {
    api.get('/sales/quarterly', { params: { q: selectedQuarter, year: selectedYear, lab: selectedLab } })
      .then(function (r) { setQuarterlyData(r.data.data); }).catch(function () {});
  }, [selectedLab, selectedQuarter, selectedYear]);

  useEffect(function () {
    var daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    var day = Math.min(selectedDay, daysInMonth);
    api.get('/test-counts/summary', { params: { month: selectedMonth, year: selectedYear, day: day } })
      .then(function (r) { setTestCountData(r.data.data); }).catch(function () {});
    api.get('/subjects/summary', { params: { month: selectedMonth, year: selectedYear, day: day } })
      .then(function (r) { setSubjectData(r.data.data); }).catch(function () {});
  }, [selectedMonth, selectedYear, selectedDay]);

  useEffect(function () {
    api.get('/celebrations').then(function (r) { setCelebData(r.data.data); }).catch(function () {});
    api.get('/notices').then(function (r) { setNotices(r.data.data || []); }).catch(function () {});
    var interval = setInterval(function () {
      api.get('/celebrations').then(function (r) { setCelebData(r.data.data); }).catch(function () {});
      api.get('/notices').then(function (r) { setNotices(r.data.data || []); }).catch(function () {});
    }, 60000);
    return function () { clearInterval(interval); };
  }, []);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {/* 대시보드 60% */}
      <div style={{
        flex: '0 0 60%', display: 'grid',
        gridTemplateColumns: '1fr 1fr', gridTemplateRows: '7fr 3fr',
        minWidth: 0, background: '#334155',
      }}>
        {/* Q1 */}
        <section style={{
          background: '#f9fafb', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
          borderRight: '5px solid #334155', borderBottom: '5px solid #334155',
        }}>
          <div className="bg-slate-50 px-3 py-2 flex items-center gap-2 border-b border-gray-200 shrink-0">
            <TrendingUp size={18} className="text-slate-600 shrink-0" />
            <span className="text-base font-bold text-slate-700">전사 목표 vs 누적매출</span>
          </div>
          <div style={{ flex: 1, padding: 8, minHeight: 0 }}>
            <ChartErrorBoundary resetKey={salesData}><SalesDonut data={salesData} layout="signage" /></ChartErrorBoundary>
          </div>
        </section>

        {/* Q2 */}
        <section style={{
          background: '#f9fafb', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
          borderBottom: '5px solid #334155',
        }}>
          <div className="bg-slate-50 px-3 py-2 flex items-center gap-2 border-b border-gray-200 shrink-0">
            <BarChart3 size={18} className="text-slate-600 shrink-0" />
            <span className="text-base font-bold text-slate-700">부서별 분기 매출</span>
          </div>
          <div style={{ flex: 1, padding: 8, minHeight: 0 }}>
            <ChartErrorBoundary resetKey={quarterlyData}><QuarterlyBar data={quarterlyData} horizontal /></ChartErrorBoundary>
          </div>
        </section>

        {/* Q3 */}
        <section style={{
          background: '#f9fafb', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
          borderRight: '5px solid #334155',
        }}>
          <div className="bg-slate-50 px-3 py-2 flex items-center gap-2 border-b border-gray-200 shrink-0">
            <ClipboardList size={18} className="text-slate-600 shrink-0" />
            <span className="text-base font-bold text-slate-700">일일 시험건수</span>
            {testCountRefDate && <span className="text-sm font-bold text-blue-600">(기준일: {testCountRefDate})</span>}
          </div>
          <div style={{ flex: 1, padding: 8, minHeight: 0 }}>
            <ChartErrorBoundary resetKey={testCountData}><TestCountTable data={testCountData} hideChart /></ChartErrorBoundary>
          </div>
        </section>

        {/* Q4 */}
        <section style={{
          background: '#f9fafb', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
        }}>
          <div className="bg-slate-50 px-3 py-2 flex items-center gap-2 border-b border-gray-200 shrink-0">
            <Users size={18} className="text-slate-600 shrink-0" />
            <span className="text-base font-bold text-slate-700">시험대상자 인원수</span>
            {subjectRefDate && <span className="text-sm font-bold text-blue-600">(기준일: {subjectRefDate})</span>}
          </div>
          <div style={{ flex: 1, padding: 8, minHeight: 0 }}>
            <ChartErrorBoundary resetKey={subjectData}><SubjectCards data={subjectData} hideChart /></ChartErrorBoundary>
          </div>
        </section>
      </div>

      {/* 경조사 20% */}
      <CelebrationPanel data={celebData} />

      {/* 공지사항 20% */}
      <NoticePanel notices={notices} />
    </div>
  );
}
