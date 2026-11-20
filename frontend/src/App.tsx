import { useEffect, useState } from 'react';
import { Alert, Button, Result, Spin } from 'antd';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import MainLayout from './MainLayout';
import ClientsPage from './pages/ClientsPage';
import RequestsPage from './pages/RequestsPage';
import OrdersPage from './pages/OrdersPage';
import TourOperatorsPage from './pages/TourOperatorsPage';
import ToursPage from './pages/ToursPage';
import { ActivatePage, LoginPage, SetupPage } from './pages/AuthPages';
import { ensureSession } from './utils/api';

type AppState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; authenticated: boolean; setupAvailable: boolean };

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (
      typeof data === 'object' &&
      data !== null &&
      'detail' in data &&
      typeof data.detail === 'string'
    ) {
      return data.detail;
    }
  } catch {
    // The response may not contain JSON.
  }
  return `Ошибка сервера (${response.status})`;
}

function App() {
  const [state, setState] = useState<AppState>({ status: 'loading' });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleUnauthorized = () => {
      setState((current) =>
        current.status === 'ready'
          ? { ...current, authenticated: false }
          : current,
      );
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate]);

  useEffect(() => {
    const controller = new AbortController();
    const loadState = async () => {
      try {
        const [setupResponse, authenticated] = await Promise.all([
          fetch('/api/auth/setup', { signal: controller.signal }),
          ensureSession(),
        ]);
        if (!setupResponse.ok) {
          throw new Error(await getErrorMessage(setupResponse));
        }
        const setupData: unknown = await setupResponse.json();
        if (
          typeof setupData !== 'object' ||
          setupData === null ||
          !('available' in setupData) ||
          typeof setupData.available !== 'boolean'
        ) {
          throw new Error('Сервер вернул некорректный статус первоначальной настройки');
        }
        if (!controller.signal.aborted) {
          setState({
            status: 'ready',
            authenticated,
            setupAvailable: setupData.available,
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Не удалось проверить состояние авторизации',
          });
        }
      }
    };
    void loadState();
    return () => controller.abort();
  }, []);

  if (state.status === 'loading') {
    return <Spin fullscreen tip="Проверка доступа..." />;
  }
  if (state.status === 'error') {
    return (
      <div style={{ maxWidth: 560, margin: '15vh auto', padding: 24 }}>
        <Result
          status="error"
          title="Не удалось подключиться"
          subTitle={<Alert type="error" showIcon message={state.message} />}
          extra={
            <Button onClick={() => window.location.reload()}>
              Повторить
            </Button>
          }
        />
      </div>
    );
  }

  const isAuthPath = ['/setup', '/activate', '/login'].includes(location.pathname);
  if (state.authenticated) {
    if (isAuthPath) return <Navigate to="/" replace />;
    return (
      <MainLayout
        onLogout={() => {
          setState({ ...state, authenticated: false });
          navigate('/login', { replace: true });
        }}
      >
        <Routes>
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/tour-operators" element={<TourOperatorsPage />} />
          <Route path="/tours" element={<ToursPage />} />
          <Route path="/" element={<Navigate to="/clients" replace />} />
          <Route path="*" element={<Navigate to="/clients" replace />} />
        </Routes>
      </MainLayout>
    );
  }

  if (state.setupAvailable && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }
  if (!state.setupAvailable && location.pathname === '/setup') {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route
        path="/setup"
        element={
          <SetupPage
            onAuthenticated={() =>
              setState({
                status: 'ready',
                authenticated: true,
                setupAvailable: false,
              })
            }
          />
        }
      />
      <Route
        path="/activate"
        element={
          <ActivatePage
            onAuthenticated={() =>
              setState({
                status: 'ready',
                authenticated: true,
                setupAvailable: false,
              })
            }
          />
        }
      />
      <Route
        path="/login"
        element={
          <LoginPage
            onAuthenticated={() => {
              setState({ ...state, authenticated: true });
              navigate('/', { replace: true });
            }}
          />
        }
      />
      <Route
        path="*"
        element={<Navigate to={state.setupAvailable ? '/setup' : '/login'} replace />}
      />
    </Routes>
  );
}

export default App;
