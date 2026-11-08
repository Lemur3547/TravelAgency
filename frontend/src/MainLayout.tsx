import { useState, type ReactNode } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  UserOutlined,
  CompassOutlined,
  DashboardOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

function MainLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  
  // Получаем встроенные токены темы Ant Design (для фонов и скруглений)
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // Описываем пункты нашего бокового меню АИС турагентства
  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Рабочий стол',
    },
    {
      key: 'clients',
      icon: <UserOutlined />,
      label: 'База клиентов',
    },
    {
      key: 'tours',
      icon: <CompassOutlined />,
      label: 'Заявки и Туры',
    },
    {
      key: 'documents',
      icon: <FileTextOutlined />,
      label: 'Договоры и учет',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Боковая панель (Меню) */}
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={(value) => setCollapsed(value)}
        theme="light"
      >
        {/* Логотип приложения */}
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
          fontSize: collapsed ? '12px' : '16px',
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}>
          {collapsed ? 'ТА' : 'ТурАгентство АИС'}
        </div>
        
        <Menu 
          theme="light" 
          defaultSelectedKeys={['dashboard']} 
          mode="inline" 
          items={menuItems} 
        />
      </Sider>

      {/* Основная часть страницы */}
      <Layout>
        {/* Шапка (Header) */}
        <Header style={{ 
          padding: '0 24px', 
          background: colorBgContainer, 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center' 
        }}>
          <div style={{ fontWeight: '500' }}>
            🧑‍💼 Менеджер: Алексей В.
          </div>
        </Header>

        {/* Рабочая область (Content) */}
        <Content style={{ margin: '24px 16px 0' }}>
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
    </Layout>
  );
}

export default MainLayout;
