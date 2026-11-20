import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Dropdown,
  message,
} from 'antd';
import {
  CopyOutlined,
  LockOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PhoneInput } from '../components/PhoneInput';
import { apiFetch } from '../utils/api';
import { isValidPhone } from '../utils/phone';

interface EmployeeRole {
  id: number;
  name: string;
  slug: string;
}

interface EmployeeRecord {
  id: number;
  last_name: string;
  first_name: string;
  father_name: string | null;
  passport_number: string;
  login: string;
  email: string;
  phone: string;
  role: EmployeeRole;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_blocked: boolean;
}

interface EmployeeFormValues {
  last_name: string;
  first_name: string;
  father_name?: string;
  passport_number: string;
  login: string;
  email: string;
  phone: string;
  role_id: number;
}

interface EmployeeInvite {
  employee: EmployeeRecord;
  activation_url: string;
}

interface CurrentEmployee {
  id: number;
  role: EmployeeRole;
}

const ROLE_HIERARCHY: Record<string, number> = {
  client_manager: 1,
  product_manager: 1,
  admin: 2,
  director: 3,
};

function isCurrentEmployee(value: unknown): value is CurrentEmployee {
  if (typeof value !== 'object' || value === null) return false;
  const employee = value as Record<string, unknown>;
  return typeof employee.id === 'number' && isRole(employee.role);
}

function isEmployeeInvite(value: unknown): value is EmployeeInvite {
  if (typeof value !== 'object' || value === null) return false;
  const invite = value as Record<string, unknown>;
  return (
    isEmployeeRecord(invite.employee) &&
    typeof invite.activation_url === 'string'
  );
}

function isRole(value: unknown): value is EmployeeRole {
  if (typeof value !== 'object' || value === null) return false;
  const role = value as Record<string, unknown>;
  return (
    typeof role.id === 'number' &&
    typeof role.name === 'string' &&
    typeof role.slug === 'string'
  );
}

function isEmployeeRecord(value: unknown): value is EmployeeRecord {
  if (typeof value !== 'object' || value === null) return false;
  const employee = value as Record<string, unknown>;
  return (
    typeof employee.id === 'number' &&
    typeof employee.last_name === 'string' &&
    typeof employee.first_name === 'string' &&
    (typeof employee.father_name === 'string' || employee.father_name === null) &&
    typeof employee.passport_number === 'string' &&
    typeof employee.login === 'string' &&
    typeof employee.email === 'string' &&
    typeof employee.phone === 'string' &&
    isRole(employee.role) &&
    typeof employee.created_at === 'string' &&
    typeof employee.updated_at === 'string' &&
    typeof employee.is_active === 'boolean' &&
    typeof employee.is_blocked === 'boolean'
  );
}

async function getResponseError(response: Response, action: string): Promise<Error> {
  let detail: unknown;
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'detail' in body) {
      detail = body.detail;
    }
  } catch {
    // The response may not contain JSON.
  }

  if (typeof detail === 'string') return new Error(detail);
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        typeof item === 'object' &&
        item !== null &&
        'msg' in item &&
        typeof item.msg === 'string'
          ? item.msg
          : null,
      )
      .filter((item): item is string => item !== null);
    if (messages.length) return new Error(messages.join('. '));
  }
  return new Error(`${action} (HTTP ${response.status})`);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(date);
}

function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<CurrentEmployee | null>(null);
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [activationUrls, setActivationUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regeneratingEmployeeId, setRegeneratingEmployeeId] = useState<number | null>(null);
  const [blockingEmployeeId, setBlockingEmployeeId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [form] = Form.useForm<EmployeeFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [formOpen, setFormOpen] = useState(false);
  const [invite, setInvite] = useState<EmployeeInvite | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPage() {
      setLoading(true);
      setError(null);
      try {
        const [employeeResponse, roleResponse, currentEmployeeResponse] = await Promise.all([
          apiFetch('/api/admin/employees', { signal: controller.signal }),
          apiFetch('/api/admin/roles', { signal: controller.signal }),
          apiFetch('/api/auth/me', { signal: controller.signal }),
        ]);
        if (!employeeResponse.ok) {
          throw await getResponseError(employeeResponse, 'Не удалось загрузить сотрудников');
        }
        if (!roleResponse.ok) {
          throw await getResponseError(roleResponse, 'Не удалось загрузить доступные роли');
        }
        if (!currentEmployeeResponse.ok) {
          throw await getResponseError(currentEmployeeResponse, 'Не удалось загрузить текущего сотрудника');
        }

        const [employeeData, roleData, currentEmployeeData]: [unknown, unknown, unknown] = await Promise.all([
          employeeResponse.json(),
          roleResponse.json(),
          currentEmployeeResponse.json(),
        ]);
        if (!Array.isArray(employeeData) || !employeeData.every(isEmployeeRecord)) {
          throw new Error('Сервер вернул список сотрудников в неожиданном формате');
        }
        if (!Array.isArray(roleData) || !roleData.every(isRole)) {
          throw new Error('Сервер вернул список ролей в неожиданном формате');
        }
        if (!isCurrentEmployee(currentEmployeeData)) {
          throw new Error('Сервер вернул некорректные данные текущего сотрудника');
        }
        setEmployees(employeeData);
        setRoles(roleData);
        setCurrentEmployee(currentEmployeeData);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить список сотрудников',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadPage();
    return () => controller.abort();
  }, [reloadKey]);

  function openForm() {
    form.resetFields();
    setError(null);
    setFormOpen(true);
  }

  async function registerEmployee(values: EmployeeFormValues) {
    setSaving(true);
    setError(null);
    const phoneDigits = values.phone.replace(/\D/g, '');
    const normalizedPhone = phoneDigits.startsWith('8')
      ? `+7${phoneDigits.slice(1)}`
      : phoneDigits.startsWith('7')
        ? `+${phoneDigits}`
        : `+7${phoneDigits}`;
    const payload = {
      ...values,
      last_name: values.last_name.trim(),
      first_name: values.first_name.trim(),
      father_name: values.father_name?.trim() || null,
      passport_number: values.passport_number.replace(/\D/g, ''),
      login: values.login.trim().toLowerCase(),
      email: values.email.trim(),
      phone: normalizedPhone,
    };

    try {
      const response = await apiFetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw await getResponseError(response, 'Не удалось зарегистрировать сотрудника');
      }

      const result: unknown = await response.json();
      if (!isEmployeeInvite(result)) {
        throw new Error('Сервер вернул некорректные данные приглашения');
      }

      const createdInvite = result;
      setActivationUrls((current) => ({
        ...current,
        [createdInvite.employee.id]: createdInvite.activation_url,
      }));
      setInvite(createdInvite);
      setFormOpen(false);
      setReloadKey((key) => key + 1);
      messageApi.success('Сотрудник зарегистрирован');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Не удалось зарегистрировать сотрудника',
      );
    } finally {
      setSaving(false);
    }
  }

  async function regenerateInvite(employee: EmployeeRecord) {
    setRegeneratingEmployeeId(employee.id);
    try {
      const response = await apiFetch(
        `/api/admin/employees/${employee.id}/activation-link`,
        { method: 'POST' },
      );
      if (!response.ok) {
        throw await getResponseError(response, 'Не удалось создать новую ссылку');
      }

      const result: unknown = await response.json();
      if (!isEmployeeInvite(result)) {
        throw new Error('Сервер вернул некорректные данные приглашения');
      }

      setActivationUrls((current) => ({
        ...current,
        [result.employee.id]: result.activation_url,
      }));
      setInvite(result);
      messageApi.success('Новая ссылка активации создана');
    } catch (regenerateError) {
      messageApi.error(
        regenerateError instanceof Error
          ? regenerateError.message
          : 'Не удалось создать новую ссылку',
      );
    } finally {
      setRegeneratingEmployeeId(null);
    }
  }

  async function blockEmployee(employee: EmployeeRecord) {
    setBlockingEmployeeId(employee.id);
    try {
      const response = await apiFetch(
        `/api/admin/employees/${employee.id}/block`,
        { method: 'POST' },
      );
      if (!response.ok) {
        throw await getResponseError(response, 'Не удалось заблокировать сотрудника');
      }

      const result: unknown = await response.json();
      if (!isEmployeeRecord(result) || !result.is_blocked) {
        throw new Error('Сервер вернул некорректный статус сотрудника');
      }

      setEmployees((current) =>
        current.map((item) => item.id === result.id ? result : item),
      );
      setActivationUrls((current) => {
        const next = { ...current };
        delete next[result.id];
        return next;
      });
      messageApi.success('Сотрудник заблокирован, все его сессии завершены');
    } catch (blockError) {
      messageApi.error(
        blockError instanceof Error
          ? blockError.message
          : 'Не удалось заблокировать сотрудника',
      );
    } finally {
      setBlockingEmployeeId(null);
    }
  }

  function confirmBlockEmployee(employee: EmployeeRecord) {
    Modal.confirm({
      title: 'Заблокировать сотрудника?',
      content: `${employee.last_name} ${employee.first_name} потеряет доступ к системе. Все его сессии будут завершены.`,
      okText: 'Заблокировать',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: () => blockEmployee(employee),
    });
  }

  function canBlockEmployee(employee: EmployeeRecord): boolean {
    if (
      !currentEmployee ||
      employee.id === currentEmployee.id ||
      employee.role.slug === 'director'
    ) {
      return false;
    }

    const employeeLevel = ROLE_HIERARCHY[employee.role.slug];
    const currentLevel = ROLE_HIERARCHY[currentEmployee.role.slug];
    return employeeLevel !== undefined &&
      currentLevel !== undefined &&
      employeeLevel < currentLevel;
  }

  async function copyInvite(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      messageApi.success('Ссылка скопирована');
    } catch {
      messageApi.error('Не удалось скопировать ссылку. Выделите ее и скопируйте вручную.');
    }
  }

  const columns: ColumnsType<EmployeeRecord> = [
    {
      title: 'Сотрудник',
      key: 'name',
      width: 220,
      render: (_, employee) =>
        [employee.last_name, employee.first_name, employee.father_name]
          .filter(Boolean)
          .join(' '),
    },
    { title: 'Роль', dataIndex: ['role', 'name'], key: 'role', width: 170 },
    { title: 'Логин', dataIndex: 'login', key: 'login', width: 150 },
    { title: 'Электронная почта', dataIndex: 'email', key: 'email', width: 230 },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone', width: 180 },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'status',
      width: 140,
      render: (_: boolean, employee) =>
        employee.is_blocked
          ? <Tag color="error">Заблокирован</Tag>
          : employee.is_active
            ? <Tag color="success">Активен</Tag>
            : <Tag color="default">Ожидает активации</Tag>,
    },
    {
      title: 'Зарегистрирован',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: formatDate,
    },
    {
      title: 'Ссылка-приглашение',
      key: 'activation_url',
      width: 220,
      render: (_, employee) => {
        const url = activationUrls[employee.id];
        return !employee.is_active && !employee.is_blocked ? (
          <Space>
            {url && (
              <>
                <Typography.Link href={url} target="_blank" rel="noreferrer">
                  Открыть
                </Typography.Link>
                <Button
                  aria-label={`Скопировать ссылку для ${employee.last_name} ${employee.first_name}`}
                  icon={<CopyOutlined />}
                  onClick={() => void copyInvite(url)}
                />
              </>
            )}
            <Button
              aria-label={`Создать новую ссылку для ${employee.last_name} ${employee.first_name}`}
              icon={<ReloadOutlined />}
              loading={regeneratingEmployeeId === employee.id}
              disabled={
                regeneratingEmployeeId !== null &&
                regeneratingEmployeeId !== employee.id
              }
              onClick={() => void regenerateInvite(employee)}
            >
              Новая ссылка
            </Button>
          </Space>
        ) : '—';
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 90,
      render: (_, employee) =>
        !employee.is_blocked && canBlockEmployee(employee) ? (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'block',
                  label: 'Заблокировать',
                  icon: <LockOutlined />,
                  danger: true,
                  disabled: blockingEmployeeId !== null,
                },
              ],
              onClick: ({ key }) => {
                if (key === 'block') confirmBlockEmployee(employee);
              },
            }}
          >
            <Button
              aria-label={`Действия для ${employee.last_name} ${employee.first_name}`}
              icon={<MoreOutlined />}
              loading={blockingEmployeeId === employee.id}
            />
          </Dropdown>
        ) : '—',
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ display: 'flex' }}>
      {contextHolder}
      <div>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Сотрудники
        </Typography.Title>
        <Typography.Text type="secondary">
          Учетные записи и приглашения сотрудников турагентства
        </Typography.Text>
      </div>

      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={openForm}
        disabled={loading || roles.length === 0}
      >
        Зарегистрировать сотрудника
      </Button>

      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={
            <Button
              icon={<ReloadOutlined />}
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Повторить
            </Button>
          }
        />
      )}

      <Table<EmployeeRecord>
        columns={columns}
        dataSource={employees}
        rowKey="id"
        loading={loading}
        tableLayout="fixed"
        scroll={{ x: 1560 }}
        locale={{
          emptyText: error ? 'Не удалось загрузить данные' : 'Сотрудники не найдены',
        }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (total) => `${total} сотрудников`,
        }}
      />

      <Modal
        title="Регистрация сотрудника"
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={() => form.submit()}
        okText="Зарегистрировать"
        cancelText="Отмена"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form<EmployeeFormValues>
          form={form}
          layout="vertical"
          onFinish={registerEmployee}
          requiredMark="optional"
        >
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="last_name"
                label="Фамилия"
                rules={[
                  { required: true, whitespace: true, message: 'Укажите фамилию' },
                  {
                    pattern: /^[А-Яа-яЁё]+(?:[- ][А-Яа-яЁё]+)*$/,
                    message: 'Используйте только русские буквы',
                  },
                ]}
              >
                <Input maxLength={50} autoComplete="family-name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="first_name"
                label="Имя"
                rules={[
                  { required: true, whitespace: true, message: 'Укажите имя' },
                  {
                    pattern: /^[А-Яа-яЁё]+(?:[- ][А-Яа-яЁё]+)*$/,
                    message: 'Используйте только русские буквы',
                  },
                ]}
              >
                <Input maxLength={50} autoComplete="given-name" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="father_name"
                label="Отчество"
                rules={[
                  {
                    pattern: /^[А-Яа-яЁё]+(?:[- ][А-Яа-яЁё]+)*$/,
                    message: 'Используйте только русские буквы',
                  },
                ]}
              >
                <Input maxLength={50} autoComplete="additional-name" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="passport_number"
                label="Серия и номер паспорта"
                rules={[
                  { required: true, message: 'Укажите серию и номер паспорта' },
                  {
                    validator: (_rule, value: string | undefined) =>
                      !value || /^\d{10}$/.test(value.replace(/\s/g, ''))
                        ? Promise.resolve()
                        : Promise.reject(new Error('Введите 10 цифр')),
                  },
                ]}
              >
                <Input
                  inputMode="numeric"
                  placeholder="0000 000000"
                  maxLength={11}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, '').slice(0, 10);
                    form.setFieldValue(
                      'passport_number',
                      digits.length > 4
                        ? `${digits.slice(0, 4)} ${digits.slice(4)}`
                        : digits,
                    );
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="login"
                label="Логин"
                rules={[
                  { required: true, whitespace: true, message: 'Укажите логин' },
                  {
                    pattern: /^[A-Za-z0-9._-]{3,100}$/,
                    message: 'Используйте 3–100 латинских букв, цифр, ., _ или -',
                  },
                ]}
              >
                <Input autoComplete="username" maxLength={100} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="email"
                label="Электронная почта"
                rules={[
                  { required: true, message: 'Укажите электронную почту' },
                  { type: 'email', message: 'Проверьте формат электронной почты' },
                ]}
              >
                <Input autoComplete="email" maxLength={255} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="phone"
                label="Телефон"
                rules={[
                  { required: true, message: 'Укажите телефон' },
                  {
                    validator: (_rule, value: string | undefined) =>
                      !value || isValidPhone(value)
                        ? Promise.resolve()
                        : Promise.reject(new Error('Введите корректный номер телефона')),
                  },
                ]}
              >
                <PhoneInput />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="role_id"
                label="Роль"
                rules={[{ required: true, message: 'Выберите роль сотрудника' }]}
              >
                <Select
                  placeholder="Выберите роль"
                  options={roles.map((role) => ({
                    value: role.id,
                    label: role.name,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Приглашение сотрудника"
        open={invite !== null}
        onCancel={() => setInvite(null)}
        footer={[
          <Button key="close" onClick={() => setInvite(null)}>
            Закрыть
          </Button>,
          <Button
            key="copy"
            type="primary"
            icon={<CopyOutlined />}
            onClick={() => invite && void copyInvite(invite.activation_url)}
          >
            Скопировать ссылку
          </Button>,
        ]}
        destroyOnHidden
      >
        {invite && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text>
              Сотрудник {invite.employee.first_name} {invite.employee.last_name} зарегистрирован.
              Передайте ему ссылку для активации аккаунта.
            </Typography.Text>
            <Input readOnly value={invite.activation_url} onFocus={(event) => event.target.select()} />
            <Typography.Text type="secondary">
              Ссылка не хранится в открытом виде. Если приглашение потеряется, создайте новую ссылку в списке сотрудников.
            </Typography.Text>
          </Space>
        )}
      </Modal>
    </Space>
  );
}

export default EmployeesPage;
