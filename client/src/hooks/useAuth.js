import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import useDashboardStore from '../stores/dashboardStore';

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const setUser = useDashboardStore((s) => s.setUser);
  const user = useDashboardStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/me')
      .then((res) => {
        setUser(res.data.data.user);
        if (res.data.data.csrfToken) localStorage.setItem('csrfToken', res.data.data.csrfToken);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (employee_id, password, next) => {
    const res = await api.post('/auth/login', { employee_id, password });
    setUser(res.data.data.user);
    if (res.data.data.csrfToken) localStorage.setItem('csrfToken', res.data.data.csrfToken);
    navigate(next || '/dashboard');
    return res.data;
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    localStorage.removeItem('csrfToken');
    navigate('/login');
  };

  return { user, loading, login, logout };
}
