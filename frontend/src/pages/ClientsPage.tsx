import React, { useState } from 'react';
import { Table, Input, Button, Space, Tag, Modal, Form, Input as AntInput, message } from 'antd';
import { SearchOutlined, UserAddOutlined, PhoneOutlined, IdcardOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

// 1. Описываем интерфейс для сущности Клиента
interface ClientRecord {
  id: number;
  name: string;
  phone: string;
  passport: string;
  status: 'Постоянный' | 'Новый' | 'Проблемный';
}

// 2. Типизируем форму добавления
interface FormValues {
  name: string;
  phone: string;
  passport?: string;
}

// Тестовые данные с явным указанием типа
const initialData: ClientRecord[] = [
  { id: 1, name: 'Иванов Иван Иванович', phone: '+7 (999) 123-45-67', passport: '4510 №123456', status: 'Постоянный' },
  { id: 2, name: 'Петрова Анна Сергеевна', phone: '+7 (999) 765-43-21', passport: '4612 №654321', status: 'Новый' },
  { id: 3, name: 'Сидоров Дмитрий Владимирович', phone: '+7 (900) 555-33-22', passport: '5015 №789012', status: 'Проблемный' },
];

function ClientsPage(): React.ReactElement {
  const [data, setData] = useState<ClientRecord[]>(initialData);
  const [searchText, setSearchText] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [form] = Form.useForm<FormValues>();

  // 3. Строго типизируем колонки таблицы
  const columns: ColumnsType<ClientRecord> = [
    {
      title: 'ФИО Клиента',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Телефон',
      dataIndex: 'phone',
      key: 'phone',
      render: (text: string) => (
        <span>
          <PhoneOutlined style={{ color: '#bfbfbf', marginRight: 8 }} />
          {text}
        </span>
      ),
    },
    {
      title: 'Паспортные данные',
      dataIndex: 'passport',
      key: 'passport',
      render: (text: string) => 
        text ? (
          <span>
            <IdcardOutlined style={{ color: '#bfbfbf', marginRight: 8 }} />
            {text}
          </span>
        ) : (
          <span style={{ color: '#bfbfbf' }}>Не указан</span>
        ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: ClientRecord['status']) => {
        let color = 'blue';
        if (status === 'Постоянный') color = 'green';
        if (status === 'Проблемный') color = 'volcano';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
  ];

  // Фильтрация данных при поиске
  const filteredData = data.filter((item) =>
    item.name.toLowerCase().includes(searchText.toLowerCase()) ||
    item.phone.includes(searchText)
  );

  // 4. Типизируем обработчик отправки формы
  const handleAddClient = (values: FormValues) => {
    const newClient: ClientRecord = {
      id: data.length + 1,
      name: values.name,
      phone: values.phone,
      passport: values.passport || '',
      status: 'Новый',
    };
    
    setData([...data, newClient]);
    setIsModalOpen(false);
    form.resetFields();
    message.success('Клиент успешно добавлен в базу!');
  };

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '16px' }}>
          <Input
            placeholder="Поиск по ФИО или телефону..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Button 
            type="primary" 
            icon={<UserAddOutlined />} 
            onClick={() => setIsModalOpen(true)}
            style={{ marginLeft: 'auto' }}
          >
            Добавить клиента
          </Button>
        </div>

        <Table 
          columns={columns} 
          dataSource={filteredData} 
          rowKey="id" 
          pagination={{ pageSize: 5 }}
        />
      </Space>

      <Modal
        title="Регистрация нового клиента"
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalOpen(false)}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" onFinish={handleAddClient} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="ФИО клиента"
            rules={[{ required: true, message: 'Пожалуйста, введите ФИО!' }]}
          >
            <AntInput placeholder="Иванов Петр Сергеевич" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Номер телефона"
            rules={[{ required: true, message: 'Пожалуйста, введите телефон!' }]}
          >
            <AntInput placeholder="+7 (999) 000-00-00" />
          </Form.Item>
          <Form.Item name="passport" label="Паспортные данные">
            <AntInput placeholder="Серия, номер, кем и когда выдан" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ClientsPage;
