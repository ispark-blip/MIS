// departments.js의 require 캐시를 매 호출마다 비워 파일 변경을 즉시 반영하기 위한 헬퍼.
// 사용처: routes/config.js, routes/testCounts.js, routes/subjects.js, services/googleSheets.js
const path = require('path');

const TARGET = path.resolve(__dirname, 'departments.js');

function getDepartments() {
  delete require.cache[TARGET];
  // eslint-disable-next-line global-require
  return require('./departments');
}

module.exports = getDepartments;
