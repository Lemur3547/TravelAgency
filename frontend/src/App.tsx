import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './MainLayout';
import ClientsPage from './pages/ClientsPage';
import TourOperatorsPage from './pages/TourOperatorsPage';
import ToursPage from './pages/ToursPage';

function App() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/tour-operators" element={<TourOperatorsPage />} />
        <Route path="/tours" element={<ToursPage />} />
        <Route path="/" element={<Navigate to="/clients" replace />} />
        <Route path="*" element={<Navigate to="/clients" replace />} />
      </Routes>
    </MainLayout>
  );
}

export default App;
