import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { ClientForm } from '../components/ClientForm';
import type { ClientFormValues } from '../components/ClientForm';
import { apiFetch, ensureSession } from '../utils/api';
import { formatDocumentNumber } from '../utils/document';
import { formatPhone } from '../utils/phone';

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

interface ClientPageResponse {
  items: ClientRecord[];
  total: number;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
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

  async function openCreateModal() {
    try {
      if (!(await ensureSession())) return;
    } catch (sessionError) {
      messageApi.error(
        sessionError instanceof Error
          ? sessionError.message
          : 'Не удалось проверить сессию',
      );
      return;
    }
    setSelectedClient(null);
    form.resetFields();
    setModalOpen(true);
  }

  async function openEditModal(client: ClientRecord) {
    try {
      if (!(await ensureSession())) return;
    } catch (sessionError) {
      messageApi.error(
        sessionError instanceof Error
          ? sessionError.message
          : 'Не удалось проверить сессию',
      );
      return;
    }
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
      const response = await apiFetch(
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
      const response = await apiFetch(`/api/clients/${client.id}`, {
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
        const response = await apiFetch(`/api/clients/?${params}`, {
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
        <ClientForm form={form} onFinish={saveClient} />
      </Modal>
    </Space>
  );
}

export default ClientsPage;
