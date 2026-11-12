import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';

interface TourRecord {
  id: number;
  operator_id: number;
  title: string;
  destination_id: number;
  departure_city: string;
  hotel_name: string;
  room_type: string;
  meal_types: string[];
  start_date: string;
  nights: number;
  tourists: number;
  description: string;
  is_available: boolean;
  client_price: number;
  commission_percent: number;
  agency_price: number;
  agency_commission: number;
}

interface TourOperator {
  id: number;
  name: string;
}

interface Country {
  id: number;
  name: string;
  slug: string;
}

interface Destination {
  id: number;
  name: string;
  slug: string;
  country_id: number;
  parent_id: number | null;
}

interface TourFormValues {
  operator_id: number;
  title: string;
  destination_id: number;
  departure_city: string;
  hotel_name: string;
  room_type: string;
  meal_type: string;
  start_date: Dayjs;
  nights: number;
  tourists: number;
  description?: string;
  is_available: boolean;
  client_price: number;
  commission_percent: number;
}

const MEAL_TYPES = [
  'Завтрак',
  'Полупансион',
  'Полный пансион',
  'Все включено',
  'Без питания',
];

function parseTour(value: unknown): TourRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const tour = value as Record<string, unknown>;
  const numericFields = [
    'client_price',
    'commission_percent',
    'agency_price',
    'agency_commission',
  ] as const;
  const parsedAmounts = Object.fromEntries(
    numericFields.map((field) => {
      const value = tour[field];
      const parsed =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim() !== ''
            ? Number(value)
            : Number.NaN;
      return [field, parsed];
    }),
  ) as Record<(typeof numericFields)[number], number>;

  if (
    typeof tour.id !== 'number' ||
    typeof tour.operator_id !== 'number' ||
    typeof tour.title !== 'string' ||
    typeof tour.destination_id !== 'number' ||
    typeof tour.departure_city !== 'string' ||
    typeof tour.hotel_name !== 'string' ||
    typeof tour.room_type !== 'string' ||
    !Array.isArray(tour.meal_types) ||
    !tour.meal_types.every((meal) => typeof meal === 'string') ||
    typeof tour.start_date !== 'string' ||
    typeof tour.nights !== 'number' ||
    typeof tour.tourists !== 'number' ||
    typeof tour.description !== 'string' ||
    typeof tour.is_available !== 'boolean' ||
    Object.values(parsedAmounts).some((amount) => !Number.isFinite(amount))
  ) {
    return null;
  }

  return {
    id: tour.id,
    operator_id: tour.operator_id,
    title: tour.title,
    destination_id: tour.destination_id,
    departure_city: tour.departure_city,
    hotel_name: tour.hotel_name,
    room_type: tour.room_type,
    meal_types: tour.meal_types,
    start_date: tour.start_date,
    nights: tour.nights,
    tourists: tour.tourists,
    description: tour.description,
    is_available: tour.is_available,
    ...parsedAmounts,
  };
}

function parseTourList(value: unknown): TourRecord[] | null {
  if (!Array.isArray(value)) return null;
  const tours = value.map(parseTour);
  if (tours.some((tour) => tour === null)) return null;
  return tours.filter((tour): tour is TourRecord => tour !== null);
}

function isOperatorList(value: unknown): value is TourOperator[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'number' &&
        typeof item.name === 'string',
    )
  );
}

function isCountryList(value: unknown): value is Country[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'number' &&
        typeof item.name === 'string' &&
        typeof item.slug === 'string',
    )
  );
}

function isDestinationList(value: unknown): value is Destination[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'number' &&
        typeof item.name === 'string' &&
        typeof item.slug === 'string' &&
        typeof item.country_id === 'number' &&
        (typeof item.parent_id === 'number' || item.parent_id === null),
    )
  );
}

function calculateCommission(price = 0, percent = 0): number {
  return Math.round((price * percent + Number.EPSILON) / 100 * 100) / 100;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(value);
}

function ToursPage() {
  const [tours, setTours] = useState<TourRecord[]>([]);
  const [operators, setOperators] = useState<TourOperator[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destinationSearch, setDestinationSearch] = useState('');
  const [destinationSearchActive, setDestinationSearchActive] = useState(false);
  const [catalogsLoaded, setCatalogsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState<TourRecord | null>(null);
  const [form] = Form.useForm<TourFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const clientPrice = Form.useWatch('client_price', form) ?? 0;
  const commissionPercent = Form.useWatch('commission_percent', form) ?? 0;
  const agencyCommission = calculateCommission(clientPrice, commissionPercent);
  const agencyPrice = Math.round((clientPrice - agencyCommission) * 100) / 100;

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setLoading(true);
      setCatalogsLoaded(false);
      setError(null);
      try {
        const [
          tourResponse,
          operatorResponse,
          countryResponse,
          destinationResponse,
        ] = await Promise.all([
          fetch('/api/tours/', { signal: controller.signal }),
          fetch('/api/tour-operators/', { signal: controller.signal }),
          fetch('/api/countries', { signal: controller.signal }),
          fetch('/api/destinations', { signal: controller.signal }),
        ]);
        if (
          !tourResponse.ok ||
          !operatorResponse.ok ||
          !countryResponse.ok ||
          !destinationResponse.ok
        ) {
          throw new Error('Не удалось загрузить туры или справочники');
        }

        const [tourData, operatorData, countryData, destinationData]: unknown[] =
          await Promise.all([
            tourResponse.json(),
            operatorResponse.json(),
            countryResponse.json(),
            destinationResponse.json(),
          ]);
        const parsedTours = parseTourList(tourData);
        if (
          !parsedTours ||
          !isOperatorList(operatorData) ||
          !isCountryList(countryData) ||
          !isDestinationList(destinationData)
        ) {
          throw new Error('Сервер вернул данные в неожиданном формате');
        }
        setTours(parsedTours);
        setOperators(operatorData);
        setCountries(countryData);
        setDestinations(destinationData);
        setCatalogsLoaded(true);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить туры',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadData();
    return () => controller.abort();
  }, [reloadKey]);

  const operatorNames = useMemo(
    () => new Map(operators.map((operator) => [operator.id, operator.name])),
    [operators],
  );
  const countryNames = useMemo(
    () => new Map(countries.map((country) => [country.id, country.name])),
    [countries],
  );
  const destinationsById = useMemo(
    () => new Map(destinations.map((destination) => [destination.id, destination])),
    [destinations],
  );
  const destinationNames = useMemo(
    () =>
      new Map(
        destinations.map((destination) => {
          const parent = destination.parent_id
            ? destinationsById.get(destination.parent_id)
            : undefined;
          const context = parent?.name
            ?? countryNames.get(destination.country_id)
            ?? 'Страна не найдена';
          return [destination.id, `${destination.name}, ${context}`];
        }),
      ),
    [countryNames, destinations, destinationsById],
  );
  const destinationOptions = useMemo(
    () => destinations.map((destination) => {
      const parent = destination.parent_id
        ? destinationsById.get(destination.parent_id)
        : undefined;
      const country = countryNames.get(destination.country_id);
      const context = [parent?.name, country].filter(Boolean).join(' · ');
      return {
        value: String(destination.id),
        label: (
          <div style={{ lineHeight: 1.4 }}>
            <div>{destination.name}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {context}
            </Typography.Text>
          </div>
        ),
      };
    }),
    [countryNames, destinations, destinationsById],
  );

  function openCreateModal() {
    setSelectedTour(null);
    form.resetFields();
    setDestinationSearch('');
    setDestinationSearchActive(false);
    form.setFieldsValue({ is_available: true, start_date: dayjs(), tourists: 2 });
    setModalOpen(true);
  }

  function openEditModal(tour: TourRecord) {
    setSelectedTour(tour);
    setDestinationSearch(
      destinationsById.get(tour.destination_id)?.name ?? '',
    );
    setDestinationSearchActive(false);
    form.setFieldsValue({
      ...tour,
      meal_type: tour.meal_types[0],
      start_date: dayjs(tour.start_date),
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
      typeof detail === 'string' ? detail : `${action} (HTTP ${response.status})`,
    );
  }

  async function saveTour(values: TourFormValues) {
    setSaving(true);
    setError(null);
    const { start_date, meal_type, ...rest } = values;
    const payload = {
      ...rest,
      meal_types: [meal_type],
      description: values.description ?? '',
      start_date: start_date.format('YYYY-MM-DD'),
    };
    try {
      const response = await fetch(
        selectedTour ? `/api/tours/${selectedTour.id}` : '/api/tours/',
        {
          method: selectedTour ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        throw await getRequestError(
          response,
          `Не удалось ${selectedTour ? 'обновить' : 'создать'} тур`,
        );
      }
      setModalOpen(false);
      setReloadKey((key) => key + 1);
      messageApi.success(selectedTour ? 'Данные тура обновлены' : 'Тур создан');
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Не удалось сохранить тур',
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTour(tour: TourRecord) {
    setError(null);
    try {
      const response = await fetch(`/api/tours/${tour.id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw await getRequestError(response, 'Не удалось удалить тур');
      }
      setReloadKey((key) => key + 1);
      messageApi.success('Тур удален');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Не удалось удалить тур',
      );
    }
  }

  const columns: ColumnsType<TourRecord> = [
    {
      title: 'Тур',
      dataIndex: 'title',
      key: 'title',
      width: 220,
      fixed: 'left',
      render: (title: string, tour) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{title}</Typography.Text>
          <Typography.Text type="secondary">
            {destinationNames.get(tour.destination_id) ?? 'Направление не найдено'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Туроператор',
      dataIndex: 'operator_id',
      key: 'operator_id',
      width: 160,
      render: (id: number) => operatorNames.get(id) ?? 'Не найден',
    },
    { title: 'Вылет', dataIndex: 'departure_city', key: 'departure_city', width: 130 },
    {
      title: 'Отель / номер',
      key: 'hotel',
      width: 190,
      render: (_, tour) => `${tour.hotel_name} / ${tour.room_type}`,
    },
    {
      title: 'Начало',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 110,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
    },
    { title: 'Ночей', dataIndex: 'nights', key: 'nights', width: 80 },
    { title: 'Туристов', dataIndex: 'tourists', key: 'tourists', width: 90 },
    {
      title: 'Питание',
      dataIndex: 'meal_types',
      key: 'meal_types',
      width: 160,
      render: (meals: string[]) => meals.join(', '),
    },
    {
      title: 'Цена клиенту',
      dataIndex: 'client_price',
      key: 'client_price',
      width: 140,
      render: formatCurrency,
    },
    {
      title: 'Цена агентству',
      dataIndex: 'agency_price',
      key: 'agency_price',
      width: 150,
      render: formatCurrency,
    },
    {
      title: 'Комиссия',
      dataIndex: 'agency_commission',
      key: 'agency_commission',
      width: 140,
      render: formatCurrency,
    },
    {
      title: 'Статус',
      dataIndex: 'is_available',
      key: 'is_available',
      width: 110,
      render: (available: boolean) =>
        available ? <Tag color="green">Доступен</Tag> : <Tag>Недоступен</Tag>,
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 110,
      fixed: 'right',
      render: (_, tour) => (
        <Space>
          <Button
            aria-label={`Редактировать ${tour.title}`}
            icon={<EditOutlined />}
            onClick={() => openEditModal(tour)}
          />
          <Popconfirm
            title="Удалить тур?"
            description={tour.title}
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => deleteTour(tour)}
          >
            <Button
              aria-label={`Удалить ${tour.title}`}
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space
          style={{
            width: '100%',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <Typography.Title level={2} style={{ margin: 0 }}>
              Туры
            </Typography.Title>
            <Typography.Text type="secondary">
              Каталог туров и расчеты агентской комиссии
            </Typography.Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            disabled={operators.length === 0 || destinations.length === 0}
          >
            Добавить тур
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
        {catalogsLoaded && operators.length === 0 && (
          <Alert
            type="warning"
            showIcon
            message="Добавьте активного туроператора, чтобы создавать туры."
          />
        )}
        {catalogsLoaded && destinations.length === 0 && (
          <Alert
            type="warning"
            showIcon
            message="Сначала добавьте направления в справочник."
          />
        )}
        <Table<TourRecord>
          rowKey="id"
          columns={columns}
          dataSource={tours}
          loading={loading}
          scroll={{ x: 1800 }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Space>

      <Modal
        title={selectedTour ? 'Редактировать тур' : 'Новый тур'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Сохранить"
        cancelText="Отмена"
        width={760}
        destroyOnHidden
      >
        <Form<TourFormValues>
          form={form}
          layout="vertical"
          onFinish={(values) => void saveTour(values)}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '0 16px',
            }}
          >
            <Form.Item
              name="title"
              label="Название тура"
              rules={[{ required: true, whitespace: true, message: 'Введите название тура' }]}
            >
              <Input maxLength={255} />
            </Form.Item>
            <Form.Item
              name="operator_id"
              label="Туроператор"
              rules={[{ required: true, message: 'Выберите туроператора' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={operators.map((operator) => ({
                  value: operator.id,
                  label: operator.name,
                }))}
              />
            </Form.Item>
            <Form.Item noStyle shouldUpdate>
              {({ getFieldError }) => {
                const errors = getFieldError('destination_id');
                return (
                  <Form.Item
                    label="Направление"
                    required
                    validateStatus={errors.length ? 'error' : undefined}
                    help={errors[0]}
                  >
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <AutoComplete
                        value={destinationSearch}
                        open={
                          destinationSearchActive &&
                          destinationSearch.trim().length > 0
                        }
                        options={
                          destinationSearch.trim()
                            ? destinationOptions
                            : []
                        }
                        placeholder="Начните вводить название направления"
                        filterOption={(input, option) => {
                          const destination = destinationsById.get(
                            Number(option?.value),
                          );
                          if (!destination) return false;
                          const parent = destination.parent_id
                            ? destinationsById.get(destination.parent_id)
                            : undefined;
                          const country = countryNames.get(destination.country_id);
                          return [destination.name, parent?.name, country]
                            .filter(Boolean)
                            .join(' ')
                            .toLocaleLowerCase()
                            .includes(input.toLocaleLowerCase());
                        }}
                        onChange={(value) => {
                          setDestinationSearch(value);
                          setDestinationSearchActive(true);
                          form.setFields([
                            { name: 'destination_id', value: undefined, errors: [] },
                          ]);
                        }}
                        onSelect={(value) => {
                          const destination = destinationsById.get(Number(value));
                          if (!destination) return;
                          setDestinationSearch(destination.name);
                          setDestinationSearchActive(false);
                          form.setFieldsValue({ destination_id: destination.id });
                        }}
                      />
                      {typeof form.getFieldValue('destination_id') === 'number' &&
                        (() => {
                          const destination = destinationsById.get(
                            form.getFieldValue('destination_id'),
                          );
                          if (!destination) return null;
                          const parent = destination.parent_id
                            ? destinationsById.get(destination.parent_id)
                            : undefined;
                          const context = [
                            parent?.name,
                            countryNames.get(destination.country_id),
                          ]
                            .filter(Boolean)
                            .join(' · ');
                          return (
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: 12, paddingInline: 11 }}
                            >
                              {context}
                            </Typography.Text>
                          );
                        })()}
                    </Space>
                  </Form.Item>
                );
              }}
            </Form.Item>
            <Form.Item
              name="destination_id"
              hidden
              rules={[{ required: true, message: 'Выберите направление из списка' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="departure_city"
              label="Город вылета"
              rules={[{ required: true, whitespace: true, message: 'Укажите город вылета' }]}
            >
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item
              name="hotel_name"
              label="Название отеля"
              rules={[{ required: true, whitespace: true, message: 'Укажите отель' }]}
            >
              <Input maxLength={255} />
            </Form.Item>
            <Form.Item
              name="room_type"
              label="Тип номера"
              rules={[{ required: true, whitespace: true, message: 'Укажите тип номера' }]}
            >
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item
              name="meal_type"
              label="Тип питания"
              rules={[{ required: true, message: 'Выберите питание' }]}
            >
              <Select
                placeholder="Выберите тип питания"
                options={MEAL_TYPES.map((meal) => ({ value: meal, label: meal }))}
              />
            </Form.Item>
            <Form.Item
              name="start_date"
              label="Дата начала"
              rules={[{ required: true, message: 'Выберите дату начала' }]}
            >
              <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="nights"
              label="Количество ночей"
              rules={[{ required: true, message: 'Укажите количество ночей' }]}
            >
              <InputNumber min={1} max={365} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="tourists"
              label="Количество туристов"
              rules={[{ required: true, message: 'Укажите количество туристов' }]}
            >
              <InputNumber min={1} max={100} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="client_price"
              label="Стоимость для клиента, ₽"
              rules={[{ required: true, message: 'Укажите стоимость' }]}
            >
              <InputNumber
                min={0.01}
                precision={2}
                step={1000}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              name="commission_percent"
              label="Комиссия оператора, %"
              rules={[{ required: true, message: 'Укажите комиссию' }]}
            >
              <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Alert
            type="info"
            showIcon
            message={
              <Space direction="vertical" size={0}>
                <span>Стоимость для агентства: {formatCurrency(agencyPrice)}</span>
                <span>Комиссия турагентства: {formatCurrency(agencyCommission)}</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="description"
            label="Описание"
            rules={[{ max: 5000, message: 'Максимум 5000 символов' }]}
          >
            <Input.TextArea rows={3} maxLength={5000} showCount />
          </Form.Item>
          <Form.Item
            name="is_available"
            label="Доступен для продажи"
            valuePropName="checked"
            initialValue
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default ToursPage;
