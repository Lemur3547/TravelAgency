import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, Input, Space, Table, Typography } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { formatPhone } from '../utils/phone';

interface ClientRecord {
  id: number;
  last_name: string;
  first_name: string;
  father_name: string | null;
  passport_number: string;
  birth_date: string;
  foreign_passport_number: string;
  latin_first_name: string;
  latin_last_name: string;
  foreign_passport_expire_date: string;
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
    typeof client.passport_number === 'string' &&
    typeof client.birth_date === 'string' &&
    typeof client.foreign_passport_number === 'string' &&
    typeof client.latin_first_name === 'string' &&
    typeof client.latin_last_name === 'string' &&
    typeof client.foreign_passport_expire_date === 'string' &&
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
  const currentPage = getPositiveInteger(searchParams.get('page'), 1);
  const requestedPageSize = getPositiveInteger(
    searchParams.get('pageSize'),
    DEFAULT_PAGE_SIZE,
  );
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;
  const searchText = searchParams.get('search') ?? '';

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
    },
    {
      title: 'Загранпаспорт',
      dataIndex: 'foreign_passport_number',
      key: 'foreign_passport_number',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Дата рождения',
      dataIndex: 'birth_date',
      key: 'birth_date',
      width: 130,
      render: formatDate,
    },
    {
      title: 'Срок загранпаспорта',
      dataIndex: 'foreign_passport_expire_date',
      key: 'foreign_passport_expire_date',
      width: 190,
      render: formatDate,
    },
  ];

  return (
    <Space orientation="vertical" size="large" style={{ display: 'flex' }}>
      <div>
        <Typography.Title level={2} style={{ margin: 0 }}>
          База клиентов
        </Typography.Title>
        <Typography.Text type="secondary">
          Клиенты, зарегистрированные в системе
        </Typography.Text>
      </div>

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
        style={{ maxWidth: 480 }}
      />

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
        scroll={{ x: 1150 }}
      />
    </Space>
  );
}

export default ClientsPage;
