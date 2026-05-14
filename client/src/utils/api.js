import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// CSRF 토큰 자동 첨부
api.interceptors.request.use((config) => {
  const csrfToken = localStorage.getItem('csrfToken');
  if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
  return config;
});

// 401 응답 시 CSRF 토큰만 정리 (대시보드는 공개이므로 자동 리다이렉트 없음)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('csrfToken');
    }
    return Promise.reject(err);
  }
);

export default api;
