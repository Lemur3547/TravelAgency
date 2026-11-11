import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Collapse,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import type { InputRef } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PhoneInput } from '../components/PhoneInput';
import { formatPhone, isValidPhone } from '../utils/phone';

interface ClientRecord {
  id: number;
  last_name: string;
  first_name: string;
  father_name: string | null;
  passport_number: string | null;
  birth_date: string | null;
  foreign_passport_number: string | null;
  latin_first_name: string | null;
  latin_last_name: string | null;
  foreign_passport_expire_date: string | null;
  phone: string;
  email: string;
}

interface ClientFormValues {
  last_name: string;
  first_name: string;
  father_name?: string;
  passport_number?: string | null;
  birth_date?: string | null;
  foreign_passport_number?: string | null;
  latin_first_name?: string | null;
  latin_last_name?: string | null;
  foreign_passport_expire_date?: string | null;
  phone: string;
  email: string;
}

interface ClientPageResponse {
  items: ClientRecord[];
  total: number;
}

const PAGE_SIZE_OPTIONS = [1, 2, 10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

function isClientRecord(value: unknown): value is ClientRecord {
  if (typeof value !== 'object' || value === null) return false;

  const client = value as Record<string, unknown>;
  return (
    typeof client.id === 'number' &&
    typeof client.last_name === 'string' &&
    typeof client.first_name === 'string' &&
    (typeof client.father_name === 'string' || client.father_name === null) &&
    (typeof client.passport_number === 'string' || client.passport_number === null) &&
    (typeof client.birth_date === 'string' || client.birth_date === null) &&
    (typeof client.foreign_passport_number === 'string' ||
      client.foreign_passport_number === null) &&
    (typeof client.latin_first_name === 'string' || client.latin_first_name === null) &&
    (typeof client.latin_last_name === 'string' || client.latin_last_name === null) &&
    (typeof client.foreign_passport_expire_date === 'string' ||
      client.foreign_passport_expire_date === null) &&
    typeof client.phone === 'string' &&
    typeof client.email === 'string'
  );
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function formatDocumentNumber(
  value: string | null | undefined,
  seriesLength: number,
  totalLength: number,
): string {
  const digits = (value ?? '').replace(/\D/g, '').slice(0, totalLength);
  return digits.length >= seriesLength
    ? `${digits.slice(0, seriesLength)} ${digits.slice(seriesLength)}`
    : digits;
}

function DocumentNumberInput({
  value,
  onChange,
  seriesLength,
  totalLength,
}: {
  value?: string | null;
  onChange?: (value: string) => void;
  seriesLength: number;
  totalLength: number;
}) {
  const inputRef = useRef<InputRef>(null);
  const pendingCaretDigits = useRef<number | null>(null);
  const digits = (value ?? '').replace(/\D/g, '').slice(0, totalLength);
  const formattedValue = formatDocumentNumber(digits, seriesLength, totalLength);

  useLayoutEffect(() => {
    if (pendingCaretDigits.current === null) return;
    const input = inputRef.current?.input;
    if (!input) return;

    const digitsBeforeCaret = pendingCaretDigits.current;
    const caretPosition =
      digitsBeforeCaret + (digitsBeforeCaret >= seriesLength ? 1 : 0);
    input.setSelectionRange(caretPosition, caretPosition);
    pendingCaretDigits.current = null;
  }, [digits, seriesLength]);

  function updateDigits(nextValue: string, caretDigits: number) {
    pendingCaretDigits.current = caretDigits;
    onChange?.(nextValue);
  }

  return (
    <Input
      ref={inputRef}
      aria-label="Серия и номер документа"
      inputMode="numeric"
      maxLength={totalLength + 1}
      placeholder={`${'0'.repeat(seriesLength)} ${'0'.repeat(totalLength - seriesLength)}`}
      value={formattedValue}
      onChange={(event) => {
        const inputValue = event.target.value;
        const selectionStart = event.target.selectionStart ?? inputValue.length;
        const caretDigits = inputValue.slice(0, selectionStart).replace(/\D/g, '').length;
        updateDigits(inputValue.replace(/\D/g, '').slice(0, totalLength), caretDigits);
      }}
      onKeyDown={(event) => {
        const input = event.currentTarget;
        if (input.selectionStart !== input.selectionEnd) return;

        if (
          event.key === 'Backspace' &&
          input.selectionStart === seriesLength + 1 &&
          digits.length >= seriesLength
        ) {
          event.preventDefault();
          const nextDigits = digits.slice(0, seriesLength - 1) + digits.slice(seriesLength);
          updateDigits(nextDigits, seriesLength - 1);
        } else if (
          event.key === 'Delete' &&
          input.selectionStart === seriesLength &&
          digits.length > seriesLength
        ) {
          event.preventDefault();
          const nextDigits = digits.slice(0, seriesLength) + digits.slice(seriesLength + 1);
          updateDigits(nextDigits, seriesLength);
        }
      }}
    />
  );
}

function isClientPageResponse(value: unknown): value is ClientPageResponse {
  if (typeof value !== 'object' || value === null) return false;
  const page = value as Record<string, unknown>;
  return (
    Array.isArray(page.items) &&
    page.items.every(isClientRecord) &&
    typeof page.total === 'number' &&
    Number.isInteger(page.total) &&
    page.total >= 0
  );
}

function getPositiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function ClientsPage() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [form] = Form.useForm<ClientFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const currentPage = getPositiveInteger(searchParams.get('page'), 1);
  const requestedPageSize = getPositiveInteger(
    searchParams.get('pageSize'),
    DEFAULT_PAGE_SIZE,
  );
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;
  const searchText = searchParams.get('search') ?? '';

  function openCreateModal() {
    setSelectedClient(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEditModal(client: ClientRecord) {
    setSelectedClient(client);
    form.setFieldsValue({
      ...client,
      father_name: client.father_name ?? undefined,
      passport_number: client.passport_number ?? undefined,
      birth_date: client.birth_date ?? undefined,
      foreign_passport_number: client.foreign_passport_number ?? undefined,
      latin_first_name: client.latin_first_name ?? undefined,
      latin_last_name: client.latin_last_name ?? undefined,
      foreign_passport_expire_date: client.foreign_passport_expire_date ?? undefined,
    });
    setModalOpen(true);
  }

  async function getRequestError(response: Response, action: string): Promise<Error> {
    let detail: unknown;
    try {
      const body: unknown = await response.json();
      if (typeof body === 'object' && body !== null && 'detail' in body) {
        detail = body.detail;
      }
    } catch {
      // The response may not contain JSON.
    }

    return new Error(
      typeof detail === 'string'
        ? detail
        : `${action} (HTTP ${response.status})`,
    );
  }

  async function saveClient(values: ClientFormValues) {
    setSaving(true);
    setError(null);
    const digits = values.phone.replace(/\D/g, '');
    const phoneNumber = digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
    const payload = {
      ...values,
      father_name: values.father_name?.trim() || null,
      phone: `+${phoneNumber}`,
      passport_number: values.passport_number?.replace(/\s/g, '') || null,
      birth_date: values.birth_date || null,
      foreign_passport_number:
        values.foreign_passport_number?.replace(/\s/g, '') || null,
      latin_first_name: values.latin_first_name || null,
      latin_last_name: values.latin_last_name || null,
      foreign_passport_expire_date: values.foreign_passport_expire_date || null,
    };

    try {
      const response = await fetch(
        selectedClient ? `/api/clients/${selectedClient.id}` : '/api/clients/',
        {
          method: selectedClient ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        throw await getRequestError(
          response,
          `Не удалось ${selectedClient ? 'обновить' : 'создать'} клиента`,
        );
      }

      setModalOpen(false);
      setReloadKey((key) => key + 1);
      messageApi.success(selectedClient ? 'Данные клиента обновлены' : 'Клиент создан');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Не удалось сохранить клиента',
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient(client: ClientRecord) {
    setError(null);
    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw await getRequestError(response, 'Не удалось удалить клиента');
      }
      setReloadKey((key) => key + 1);
      messageApi.success('Клиент удален');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Не удалось удалить клиента',
      );
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadClients() {
      setLoading(true);
      setError(null);

      try {
        const offset = (currentPage - 1) * pageSize;
        const params = new URLSearchParams({ limit: String(pageSize) });
        if (offset > 0) params.set('offset', String(offset));
        const search = searchText.trim();
        if (search) params.set('search', search);
        const response = await fetch(`/api/clients/?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Не удалось загрузить список клиентов (HTTP ${response.status})`);
        }

        const result: unknown = await response.json();
        if (!isClientPageResponse(result)) {
          throw new Error('Сервер вернул данные клиентов в неожиданном формате');
        }
        const lastPage = Math.max(1, Math.ceil(result.total / pageSize));
        if (currentPage > lastPage) {
          const nextParams = new URLSearchParams(searchParams);
          if (lastPage === 1) nextParams.delete('page');
          else nextParams.set('page', String(lastPage));
          setSearchParams(nextParams, { replace: true });
          return;
        }
        setClients(result.items);
        setTotalClients(result.total);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить список клиентов',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadClients();
    return () => controller.abort();
  }, [currentPage, pageSize, reloadKey, searchParams, searchText, setSearchParams]);

  const columns: ColumnsType<ClientRecord> = [
    {
      title: 'ФИО клиента',
      key: 'name',
      width: 180,
      ellipsis: true,
      render: (_, client) =>
        [client.last_name, client.first_name, client.father_name]
          .filter(Boolean)
          .join(' '),
      sorter: (a, b) =>
        `${a.last_name} ${a.first_name} ${a.father_name ?? ''}`.localeCompare(
          `${b.last_name} ${b.first_name} ${b.father_name ?? ''}`,
          'ru',
        ),
    },
    {
      title: 'Телефон',
      dataIndex: 'phone',
      key: 'phone',
      width: 180,
      render: formatPhone,
    },
    {
      title: 'Электронная почта',
      dataIndex: 'email',
      key: 'email',
      width: 220,
      ellipsis: true,
    },
    {
      title: 'Паспорт РФ',
      dataIndex: 'passport_number',
      key: 'passport_number',
      width: 140,
      ellipsis: true,
      render: (value: string | null) => value ? formatDocumentNumber(value, 4, 10) : '—',
    },
    {
      title: 'Загранпаспорт',
      dataIndex: 'foreign_passport_number',
      key: 'foreign_passport_number',
      width: 150,
      ellipsis: true,
      render: (value: string | null) => value ? formatDocumentNumber(value, 2, 9) : '—',
    },
    {
      title: 'Дата рождения',
      dataIndex: 'birth_date',
      key: 'birth_date',
      width: 130,
      render: (value: string | null) => value ? formatDate(value) : '—',
    },
    {
      title: 'Срок загранпаспорта',
      dataIndex: 'foreign_passport_expire_date',
      key: 'foreign_passport_expire_date',
      width: 190,
      render: (value: string | null) => value ? formatDate(value) : '—',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      render: (_, client) => (
        <Space>
          <Button
            aria-label={`Редактировать ${client.last_name} ${client.first_name}`}
            icon={<EditOutlined />}
            onClick={() => openEditModal(client)}
          />
          <Popconfirm
            title="Удалить клиента?"
            description={`${client.last_name} ${client.first_name}`}
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => deleteClient(client)}
          >
            <Button
              aria-label={`Удалить ${client.last_name} ${client.first_name}`}
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size="large" style={{ display: 'flex' }}>
      {contextHolder}
      <div>
        <Typography.Title level={2} style={{ margin: 0 }}>
          База клиентов
        </Typography.Title>
        <Typography.Text type="secondary">
          Клиенты, зарегистрированные в системе
        </Typography.Text>
      </div>

      <Space wrap>
        <Input
          aria-label="Поиск клиентов"
          placeholder="Поиск по ФИО, телефону, email или паспорту"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(event) => {
            const nextParams = new URLSearchParams(searchParams);
            const search = event.target.value;
            if (search.trim()) nextParams.set('search', search);
            else nextParams.delete('search');
            nextParams.delete('page');
            setSearchParams(nextParams, { replace: true });
          }}
          allowClear
          style={{ width: 420, maxWidth: '100%' }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          Добавить клиента
        </Button>
      </Space>

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

      <Table<ClientRecord>
        columns={columns}
        dataSource={clients}
        rowKey="id"
        loading={loading}
        tableLayout="fixed"
        pagination={{
          current: currentPage,
          pageSize,
          total: totalClients,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showSizeChanger: true,
          showTotal: (total, range) =>
            `${range[0]}–${range[1]} из ${total} клиентов`,
          onChange: (page, nextPageSize) => {
            const nextParams = new URLSearchParams(searchParams);
            if (nextPageSize !== pageSize) {
              nextParams.delete('page');
              if (nextPageSize === DEFAULT_PAGE_SIZE) {
                nextParams.delete('pageSize');
              } else {
                nextParams.set('pageSize', String(nextPageSize));
              }
            } else if (page === 1) {
              nextParams.delete('page');
            } else {
              nextParams.set('page', String(page));
            }
            setSearchParams(nextParams);
          },
        }}
        locale={{ emptyText: error ? 'Не удалось загрузить данные' : 'Клиенты не найдены' }}
        scroll={{ x: 1270 }}
      />

      <Modal
        title={selectedClient ? 'Редактировать клиента' : 'Новый клиент'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form<ClientFormValues>
          form={form}
          layout="vertical"
          validateTrigger="onBlur"
          onFinish={saveClient}
          style={{ width: '100%' }}
        >
          <Typography.Title level={5}>Основная информация</Typography.Title>
          <Row gutter={16}>
            <Col span={12}>
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
                <Input maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={12}>
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
                <Input maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={12}>
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
                <Input maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Телефон"
                rules={[
                  { required: true, message: 'Укажите телефон' },
                  {
                    validator: (_, value: string | undefined) =>
                      !value || isValidPhone(value)
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error('Введите корректный номер телефона'),
                          ),
                  },
                ]}
              >
                <PhoneInput />
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
                <Input maxLength={255} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ width: 'calc(100% + 48px)', marginInline: -24 }}>
            <Collapse
              defaultActiveKey={[]}
              style={{ width: '100%', boxSizing: 'border-box', borderRadius: '0px' }}
              items={[
              {
                key: 'passport',
                label: 'Паспортные данные',
                children: (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="passport_number"
                        label="Серия и номер паспорта"
                        rules={[
                          {
                            validator: (_, value: string | undefined) =>
                              !value || /^\d{10}$/.test(value)
                                ? Promise.resolve()
                                : Promise.reject(
                                    new Error(
                                      'Введите 10 цифр',
                                    ),
                                  ),
                          },
                        ]}
                      >
                        <DocumentNumberInput seriesLength={4} totalLength={10} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="birth_date" label="Дата рождения">
                        <Input type="date" />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'foreign-passport',
                label: 'Загранпаспорт',
                children: (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="latin_first_name"
                        label="Имя латиницей"
                        rules={[
                          {
                            pattern: /^[A-Za-z]+(?:[- ][A-Za-z]+)*$/,
                            message: 'Используйте только латинские буквы',
                          },
                        ]}
                      >
                        <Input maxLength={50} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="latin_last_name"
                        label="Фамилия латиницей"
                        rules={[
                          {
                            pattern: /^[A-Za-z]+(?:[- ][A-Za-z]+)*$/,
                            message: 'Используйте только латинские буквы',
                          },
                        ]}
                      >
                        <Input maxLength={50} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="foreign_passport_number"
                        label="Серия и номер загранпаспорта"
                        rules={[
                          {
                            validator: (_, value: string | undefined) =>
                              !value || /^\d{9}$/.test(value)
                                ? Promise.resolve()
                                : Promise.reject(
                                    new Error(
                                      'Введите 9 цифр',
                                    ),
                                  ),
                          },
                        ]}
                      >
                        <DocumentNumberInput seriesLength={2} totalLength={9} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="foreign_passport_expire_date"
                        label="Срок действия"
                      >
                        <Input type="date" />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
              ]}
            />
          </div>
        </Form>
      </Modal>
    </Space>
  );
}

export default ClientsPage;
