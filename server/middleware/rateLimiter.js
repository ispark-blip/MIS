// 간단한 인메모리 rate limiter (Express 레벨 보조)
const requests = new Map();

function rateLimiter({ windowMs = 60000, max = 60 } = {}) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!requests.has(key)) {
      requests.set(key, []);
    }

    const timestamps = requests.get(key).filter(t => t > windowStart);
    timestamps.push(now);
    requests.set(key, timestamps);

    if (timestamps.length > max) {
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMIT', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
      });
    }
    next();
  };
}

// 주기적으로 오래된 기록 정리 (5분마다)
setInterval(() => {
  const cutoff = Date.now() - 120000;
  for (const [key, timestamps] of requests) {
    const filtered = timestamps.filter(t => t > cutoff);
    if (filtered.length === 0) requests.delete(key);
    else requests.set(key, filtered);
  }
}, 300000);

module.exports = { rateLimiter };
