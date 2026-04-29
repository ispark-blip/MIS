import { useState, useEffect } from 'react';
import DashboardPage from './DashboardPage';
import CelebrationPage from './CelebrationPage';
import NoticePage from './NoticePage';

// weight: 회전 1주기에서 차지하는 시간 비율 (대시보드:경조사:공지 = 2:1:1)
var SCREENS = [
  { key: 'dashboard', component: DashboardPage, weight: 2 },
  { key: 'celebration', component: CelebrationPage, weight: 1 },
  { key: 'notice', component: NoticePage, weight: 1 },
];

// 1단위(=weight 1) 노출 시간(초). DEFAULT 300 → 대시보드 600초(10분), 나머지 300초(5분)씩.
var DEFAULT_UNIT_SEC = 300;

export default function DashboardRotator() {
  var params = new URLSearchParams(window.location.search);
  var fixedScreen = params.get('screen');
  var unitSec = parseInt(params.get('interval')) || DEFAULT_UNIT_SEC;

  var [current, setCurrent] = useState(0);
  var [fade, setFade] = useState(true);

  useEffect(function () {
    if (fixedScreen) return;
    var timer = null;
    var schedule = function (idx) {
      var holdMs = SCREENS[idx].weight * unitSec * 1000;
      timer = setTimeout(function () {
        setFade(false);
        setTimeout(function () {
          var next = (idx + 1) % SCREENS.length;
          setCurrent(next);
          setFade(true);
          schedule(next);
        }, 400);
      }, holdMs);
    };
    schedule(current);
    return function () { if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedScreen, unitSec]);

  var screenIndex = current;
  if (fixedScreen) {
    var idx = parseInt(fixedScreen);
    if (!isNaN(idx) && idx >= 0 && idx < SCREENS.length) {
      screenIndex = idx;
    } else {
      var found = SCREENS.findIndex(function (s) { return s.key === fixedScreen; });
      if (found >= 0) screenIndex = found;
    }
  }

  var Screen = SCREENS[screenIndex].component;

  return (
    <div style={{
      width: '100%', height: '100vh', overflow: 'hidden',
      opacity: fade ? 1 : 0,
      transition: 'opacity 0.4s ease-in-out',
    }}>
      <Screen />
    </div>
  );
}
