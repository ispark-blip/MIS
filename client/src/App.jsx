import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DashboardRotator from './pages/DashboardRotator';
import CelebrationPage from './pages/CelebrationPage';
import CombinedDashboardPage from './pages/CombinedDashboardPage';
import AdminPage from './pages/AdminPage';
import TestCountInputPage from './pages/TestCountInputPage';
import SubjectInputPage from './pages/SubjectInputPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/signage" element={<CombinedDashboardPage />} />
      <Route path="/celebration" element={<CelebrationPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/input/test-counts" element={<TestCountInputPage />} />
      <Route path="/input/subjects" element={<SubjectInputPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
