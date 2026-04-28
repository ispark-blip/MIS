import { useState, useEffect } from 'react';
import DashboardPage from './DashboardPage';
import CelebrationPage from './CelebrationPage';

var SCREENS = [
  { key: 'dashboard', component: DashboardPage },
  { key: 'celebration', component: CelebrationPage },
];

var DEFAULT_INTERVAL = 30;

export default function DashboardRotator() {
  var params = new URLSearchParams(window.location.search);
  var fixedScreen = params.get('screen');
  var intervalSec = parseInt(params.get('interval')) || DEFAULT_INTERVAL;

  var [current, setCurrent] = useState(0);
  var [fade, setFade] = useState(true);

  useEffect(function () {
    if (fixedScreen) return;
    var timer = setInterval(function () {
      setFade(false);
      setTimeout(function () {
        setCurrent(function (prev) { return (prev + 1) % SCREENS.length; });
        setFade(true);
      }, 400);
    }, intervalSec * 1000);
    return function () { clearInterval(timer); };
  }, [fixedScreen, intervalSec]);

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
