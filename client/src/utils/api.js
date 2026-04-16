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

// 401 응답 시 로그인 페이지로 리다이렉트
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('csrfToken');
      if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/form/')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
