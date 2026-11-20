import { useEffect, useState } from 'react';
import { Alert, Button, Result, Spin } from 'antd';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import MainLayout from './MainLayout';
import ClientsPage from './pages/ClientsPage';
import RequestsPage from './pages/RequestsPage';
import OrdersPage from './pages/OrdersPage';
import TourOperatorsPage from './pages/TourOperatorsPage';
import ToursPage from './pages/ToursPage';
import EmployeesPage from './pages/EmployeesPage';
import { ActivatePage, LoginPage, SetupPage } from './pages/AuthPages';
import { ensureSession } from './utils/api';

type AppState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      authenticated: true;
      setupAvailable: boolean;
      roleSlug: EmployeeRoleSlug;
    }
  | { status: 'ready'; authenticated: false; setupAvailable: boolean };

type EmployeeRoleSlug =
  | 'client_manager'
  | 'product_manager'
  | 'admin'
  | 'director';

const roleRoutes: Record<EmployeeRoleSlug, string[]> = {
  client_manager: ['/clients', '/requests', '/orders', '/tours'],
  product_manager: ['/tour-operators', '/tours'],
  admin: ['/employees'],
  director: [
    '/clients',
    '/requests',
    '/orders',
    '/tour-operators',
    '/tours',
    '/employees',
  ],
};

const roleHome: Record<EmployeeRoleSlug, string> = {
  client_manager: '/clients',
  product_manager: '/tours',
  admin: '/employees',
  director: '/clients',
};

async function getCurrentRole(signal?: AbortSignal): Promise<EmployeeRoleSlug> {
  const response = await fetch('/api/auth/me', { signal });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  const data: unknown = await response.json();
  if (
    typeof data !== 'object' ||
    data === null ||
    !('role' in data) ||
    typeof data.role !== 'object' ||
    data.role === null ||
    !('slug' in data.role) ||
    typeof data.role.slug !== 'string' ||
    !Object.hasOwn(roleRoutes, data.role.slug)
  ) {
    throw new Error('Сервер вернул неизвестную роль сотрудника');
  }
  switch (data.role.slug) {
    case 'client_manager':
    case 'product_manager':
    case 'admin':
    case 'director':
      return data.role.slug;
    default:
      throw new Error('Сервер вернул неизвестную роль сотрудника');
  }
}

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
        current.status === 'ready' && current.authenticated
          ? {
              status: 'ready',
              authenticated: false,
              setupAvailable: current.setupAvailable,
            }
          : current,
      );
      if (!['/setup', '/activate', '/login'].includes(location.pathname)) {
        navigate('/login', { replace: true });
      }
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [location.pathname, navigate]);

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
          if (authenticated) {
            const roleSlug = await getCurrentRole(controller.signal);
            if (controller.signal.aborted) return;
            setState({
              status: 'ready',
              authenticated: true,
              setupAvailable: setupData.available,
              roleSlug,
            });
          } else {
            setState({
              status: 'ready',
              authenticated: false,
              setupAvailable: setupData.available,
            });
          }
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

  async function completeAuthentication() {
    try {
      const roleSlug = await getCurrentRole();
      setState({
        status: 'ready',
        authenticated: true,
        setupAvailable: false,
        roleSlug,
      });
      navigate(roleHome[roleSlug], { replace: true });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить роль сотрудника',
      });
    }
  }

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
    const home = roleHome[state.roleSlug];
    if (isAuthPath || location.pathname === '/') {
      return <Navigate to={home} replace />;
    }
    if (!roleRoutes[state.roleSlug].includes(location.pathname)) {
      return <Navigate to={home} replace />;
    }
    return (
      <MainLayout
        roleSlug={state.roleSlug}
        onLogout={() => {
          setState({
            status: 'ready',
            authenticated: false,
            setupAvailable: state.setupAvailable,
          });
          navigate('/login', { replace: true });
        }}
      >
        <Routes>
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/tour-operators" element={<TourOperatorsPage />} />
          <Route
            path="/tours"
            element={<ToursPage canManage={state.roleSlug !== 'client_manager'} />}
          />
          <Route
            path="/"
            element={<Navigate to={home} replace />}
          />
          <Route path="*" element={<Navigate to={home} replace />} />
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
            onAuthenticated={() => void completeAuthentication()}
          />
        }
      />
      <Route
        path="/activate"
        element={
          <ActivatePage
            onAuthenticated={() => void completeAuthentication()}
          />
        }
      />
      <Route
        path="/login"
        element={
          <LoginPage
            onAuthenticated={() => void completeAuthentication()}
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
