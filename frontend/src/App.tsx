import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './MainLayout';
import ClientsPage from './pages/ClientsPage';

function App() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/" element={<Navigate to="/clients" replace />} />
        <Route path="*" element={<Navigate to="/clients" replace />} />
      </Routes>
    </MainLayout>
  );
}

export default App;
