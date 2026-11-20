import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Dropdown,
  Layout,
  Menu,
  Typography,
  message,
  theme,
} from 'antd';
import {
  UserOutlined,
  CompassOutlined,
  GlobalOutlined,
  LogoutOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { apiFetch } from './utils/api';

const { Sider, Content } = Layout;

interface CurrentEmployee {
  first_name: string;
  last_name: string;
  role: {
    name: string;
  };
}

function isCurrentEmployee(value: unknown): value is CurrentEmployee {
  if (typeof value !== 'object' || value === null) return false;
  const employee = value as Record<string, unknown>;
  if (typeof employee.role !== 'object' || employee.role === null) return false;
  const role = employee.role as Record<string, unknown>;
  return (
    typeof employee.first_name === 'string' &&
    typeof employee.last_name === 'string' &&
    typeof role.name === 'string'
  );
}

const pageTitles: Record<string, string> = {
  '/clients': 'База клиентов',
  '/requests': 'Заявки клиентов',
  '/tour-operators': 'Туроператоры',
  '/tours': 'Туры',
  '/orders': 'Заказы',
  '/employees': 'Сотрудники',
};

function MainLayout({
  children,
  onLogout,
}: {
  children: ReactNode;
  onLogout: () => void;
}) {
  const [employee, setEmployee] = useState<CurrentEmployee | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const pageTitle = pageTitles[location.pathname];
    document.title = pageTitle
      ? `${pageTitle} | ТурАгентство АИС`
      : 'ТурАгентство АИС';
  }, [location.pathname]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadEmployee() {
      try {
        const response = await apiFetch('/api/auth/me', {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Не удалось загрузить профиль сотрудника (HTTP ${response.status})`);
        }
        const result: unknown = await response.json();
        if (!isCurrentEmployee(result)) {
          throw new Error('Сервер вернул некорректные данные сотрудника');
        }
        setEmployee(result);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        messageApi.error(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить профиль сотрудника',
        );
      }
    }

    void loadEmployee();
    return () => controller.abort();
  }, [messageApi]);

  // Получаем встроенные токены темы Ant Design (для фонов и скруглений)
  const {
    token: { colorBgContainer, colorBorderSecondary, borderRadiusLG },
  } = theme.useToken();

  // Описываем пункты нашего бокового меню АИС турагентства
  const menuItems = [
    {
      key: 'clients',
      icon: <UserOutlined />,
      label: 'Клиенты',
    },
    {
      key: 'tour-operators',
      icon: <GlobalOutlined />,
      label: 'Туроператоры',
    },
    {
      key: 'requests',
      icon: <CompassOutlined />,
      label: 'Заявки',
    },
    {
      key: 'tours',
      icon: <GlobalOutlined />,
      label: 'Туры',
    },
    {
      key: 'orders',
      icon: <ShoppingCartOutlined />,
      label: 'Заказы',
    },
    {
      key: 'employees',
      icon: <TeamOutlined />,
      label: 'Сотрудники',
    },
  ];

  const logout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Не удалось завершить сеанс (${response.status})`);
      }
      onLogout();
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : 'Не удалось завершить сеанс',
      );
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {contextHolder}
      {/* Боковая панель (Меню) */}
      <Sider
        width={300}
        theme="light"
        style={{
          position: 'fixed',
          insetBlock: 0,
          insetInlineStart: 0,
          height: '100vh',
          overflowY: 'auto',
          zIndex: 10,
        }}
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            height: 32,
            margin: 16,
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '16px',
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          }}>
            ТурАгентство АИС
          </div>

          <Menu
            theme="light"
            selectedKeys={
              location.pathname === '/clients'
                ? ['clients']
                : location.pathname === '/tour-operators'
                  ? ['tour-operators']
                  : location.pathname === '/tours'
                    ? ['tours']
                    : location.pathname === '/requests'
                      ? ['requests']
                      : location.pathname === '/orders'
                        ? ['orders']
                        : location.pathname === '/employees'
                          ? ['employees']
                          : []
            }
            mode="inline"
            items={menuItems}
            style={{ flex: 1, minHeight: 0 }}
            onClick={({ key }) => {
              if (key === 'clients') navigate('/clients');
              if (key === 'requests') navigate('/requests');
              if (key === 'tour-operators') navigate('/tour-operators');
              if (key === 'tours') navigate('/tours');
              if (key === 'orders') navigate('/orders');
              if (key === 'employees') navigate('/employees');
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              borderTop: `1px solid ${colorBorderSecondary}`,
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0 }}>
              <Typography.Text
                strong
                ellipsis
                title={employee
                  ? `${employee.last_name} ${employee.first_name}`
                  : undefined}
              >
                {employee
                  ? `${employee.last_name} ${employee.first_name}`
                  : 'Загрузка...'}
              </Typography.Text>
              <Typography.Text type="secondary" ellipsis title={employee?.role.name}>
                {employee?.role.name ?? ''}
              </Typography.Text>
            </div>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'logout',
                    label: 'Выход',
                    icon: <LogoutOutlined />,
                    danger: true,
                  },
                ],
                onClick: ({ key }) => {
                  if (key === 'logout') void logout();
                },
              }}
            >
              <Button
                type="text"
                aria-label="Меню сотрудника"
                icon={<MoreOutlined />}
              />
            </Dropdown>
          </div>
        </div>
      </Sider>

      {/* Рабочая область (Content) */}
      <Content style={{ margin: '24px 16px 0 316px', minWidth: 0 }}>
        <div
          style={{
            padding: 24,
            minHeight: 360,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          {children}
        </div>
      </Content>
    </Layout>
  );
}

export default MainLayout;
