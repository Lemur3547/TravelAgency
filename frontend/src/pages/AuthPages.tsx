import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Typography,
} from 'antd';
import type { FormInstance } from 'antd';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PhoneInput } from '../components/PhoneInput';
import { isValidPhone } from '../utils/phone';

const { Title, Text } = Typography;

type AuthPageProps = {
  onAuthenticated: () => void;
};

type EmployeeCredentials = {
  login: string;
  password: string;
};

type DirectorDetails = {
  last_name: string;
  first_name: string;
  father_name?: string;
  passport_number: string;
  login: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
};

type PasswordValues = {
  password: string;
  password_confirmation: string;
};

function formatApiError(response: Response, detail: unknown): string {
  if (typeof detail === 'string') return detail;
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
    if (messages.length) return messages.join('. ');
  }
  return `Ошибка сервера (${response.status})`;
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: '100vh',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background:
          'radial-gradient(circle at 18% 18%, #dcecff 0, transparent 38%), linear-gradient(135deg, #f8fbff 0%, #e9eef7 100%)',
      }}
    >
      <Card
        bordered={false}
        style={{
          width: 'min(100%, 560px)',
          boxShadow: '0 18px 55px rgba(27, 55, 94, 0.13)',
        }}
        styles={{ body: { padding: '32px clamp(20px, 6vw, 40px)' } }}
      >
        <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 20 }}>
          <Text type="secondary">ТурАгентство АИС</Text>
          <Title level={2} style={{ margin: 0 }}>{title}</Title>
          <Text type="secondary">{subtitle}</Text>
        </Space>
        {children}
      </Card>
    </main>
  );
}

function passwordRules() {
  return [
    { required: true, message: 'Укажите пароль' },
    { min: 12, message: 'Пароль должен содержать не менее 12 символов' },
    { max: 128, message: 'Пароль должен содержать не более 128 символов' },
  ];
}

function passwordConfirmationRules(form: FormInstance) {
  return [
    { required: true, message: 'Подтвердите пароль' },
    {
      validator: (_: unknown, value: string | undefined) =>
        !value || value === form.getFieldValue('password')
          ? Promise.resolve()
          : Promise.reject(new Error('Пароли не совпадают')),
    },
  ];
}

function PasswordFields({ form }: { form: FormInstance }) {
  return (
    <>
      <Form.Item
        name="password"
        label="Пароль"
        rules={passwordRules()}
        hasFeedback
      >
        <Input.Password autoComplete="new-password" maxLength={128} />
      </Form.Item>
      <Form.Item
        name="password_confirmation"
        label="Подтверждение пароля"
        dependencies={['password']}
        rules={passwordConfirmationRules(form)}
        hasFeedback
      >
        <Input.Password autoComplete="new-password" maxLength={128} />
      </Form.Item>
    </>
  );
}

function PassportInput({
  value = '',
  onChange,
}: {
  value?: string;
  onChange?: (value: string) => void;
}) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  const formatted = digits.length > 4
    ? `${digits.slice(0, 4)} ${digits.slice(4)}`
    : digits;
  return (
    <Input
      inputMode="numeric"
      placeholder="0000 000000"
      maxLength={11}
      value={formatted}
      onChange={(event) =>
        onChange?.(event.target.value.replace(/\D/g, '').slice(0, 10))
      }
    />
  );
}

function getPasswordError(response: Response, body: unknown): string {
  let detail: unknown;
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    detail = body.detail;
  }
  return formatApiError(response, detail);
}

export function SetupPage({ onAuthenticated }: AuthPageProps) {
  const [form] = Form.useForm<DirectorDetails>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const createDirector = async (values: DirectorDetails) => {
    setSubmitting(true);
    setError('');
    try {
      const response = await postJson('/api/auth/setup', {
        ...values,
        father_name: values.father_name || null,
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(getPasswordError(response, body));
      }
      onAuthenticated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось создать аккаунт');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Первоначальная настройка"
      subtitle="Создайте учетную запись директора турагентства"
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 20 }} />}
      <Form form={form} layout="vertical" onFinish={createDirector} requiredMark="optional">
        <Title level={5}>Данные сотрудника</Title>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="last_name"
              label="Фамилия"
              rules={[
                { required: true, whitespace: true, message: 'Укажите фамилию' },
                { pattern: /^[А-Яа-яЁё]+(?:[- ][А-Яа-яЁё]+)*$/, message: 'Используйте русские буквы' },
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
                { pattern: /^[А-Яа-яЁё]+(?:[- ][А-Яа-яЁё]+)*$/, message: 'Используйте русские буквы' },
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
                { pattern: /^[А-Яа-яЁё]+(?:[- ][А-Яа-яЁё]+)*$/, message: 'Используйте русские буквы' },
              ]}
            >
              <Input maxLength={50} />
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
              <PassportInput />
            </Form.Item>
          </Col>
        </Row>

        <Divider />
        <Title level={5}>Данные для входа</Title>
        <Form.Item
          name="login"
          label="Логин"
          rules={[
            { required: true, whitespace: true, message: 'Укажите логин' },
            { pattern: /^[A-Za-z0-9._-]{3,100}$/, message: 'Используйте 3–100 латинских букв, цифр, ., _ или -' },
          ]}
        >
          <Input autoComplete="username" maxLength={100} />
        </Form.Item>
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

        <Divider />
        <Title level={5}>Защита аккаунта</Title>
        <PasswordFields form={form} />
        <Button type="primary" htmlType="submit" block loading={submitting}>
          Создать аккаунт директора
        </Button>
      </Form>
    </AuthShell>
  );
}

export function ActivatePage({ onAuthenticated }: AuthPageProps) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [form] = Form.useForm<PasswordValues>();
  const [employeeName, setEmployeeName] = useState('');
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    if (!token) {
      return () => controller.abort();
    }
    const validateToken = async () => {
      try {
        const response = await fetch(
          `/api/auth/activate?${new URLSearchParams({ token })}`,
          { signal: controller.signal },
        );
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(getPasswordError(response, body));
        if (
          typeof body !== 'object' ||
          body === null ||
          !('first_name' in body) ||
          !('last_name' in body) ||
          typeof body.first_name !== 'string' ||
          typeof body.last_name !== 'string'
        ) {
          throw new Error('Сервер вернул некорректные данные приглашения');
        }
        setEmployeeName(`${body.first_name} ${body.last_name}`);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Не удалось проверить ссылку');
        }
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    };
    void validateToken();
    return () => controller.abort();
  }, [token]);

  const activate = async (values: PasswordValues) => {
    setSubmitting(true);
    setError('');
    try {
      const response = await postJson('/api/auth/activate', {
        invite_token: token,
        ...values,
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(getPasswordError(response, body));
      }
      onAuthenticated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось активировать аккаунт');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Добро пожаловать!"
      subtitle={
        employeeName
          ? `${employeeName}, установите пароль для своего аккаунта`
          : 'Установите и подтвердите пароль для своего аккаунта'
      }
    >
      {!token ? (
        <Alert
          type="error"
          showIcon
          message="В ссылке отсутствует токен активации"
          description="Попросите администратора отправить новое приглашение."
        />
      ) : checking ? (
        <Text type="secondary">Проверяем ссылку активации...</Text>
      ) : error ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert type="error" showIcon message={error} />
          <Text type="secondary">Попросите администратора отправить новое приглашение.</Text>
        </Space>
      ) : (
        <Form form={form} layout="vertical" onFinish={activate}>
          <PasswordFields form={form} />
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Активировать аккаунт
          </Button>
        </Form>
      )}
    </AuthShell>
  );
}

export function LoginPage({ onAuthenticated }: AuthPageProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const login = async (credentials: EmployeeCredentials) => {
    setSubmitting(true);
    setError('');
    try {
      const response = await postJson('/api/auth/login', credentials);
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(getPasswordError(response, body));
      }
      onAuthenticated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось войти в систему');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Вход в систему" subtitle="Введите учетные данные сотрудника">
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 20 }} />}
      <Form<EmployeeCredentials> layout="vertical" onFinish={login}>
        <Form.Item
          name="login"
          label="Логин"
          rules={[{ required: true, whitespace: true, message: 'Укажите логин' }]}
        >
          <Input autoComplete="username" maxLength={100} />
        </Form.Item>
        <Form.Item
          name="password"
          label="Пароль"
          rules={[{ required: true, message: 'Укажите пароль' }]}
        >
          <Input.Password autoComplete="current-password" maxLength={128} />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          Войти
        </Button>
      </Form>
      <Divider />
      <Text type="secondary">
        Нет доступа к аккаунту? Обратитесь к администратору.
      </Text>
    </AuthShell>
  );
}
