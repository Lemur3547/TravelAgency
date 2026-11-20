import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Col,
  Select,
  Space,
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
import { apiFetch } from '../utils/api';

const ORDER_STATUSES = [
  'Новый',
  'В работе',
  'Подтверждён',
  'Завершён',
  'Отменён',
] as const;
const PAYMENT_STATUSES = [
  'Не оплачено',
  'Частично оплачено',
  'Оплачено',
  'Возврат',
] as const;

interface RequestRecord {
  id: number;
  client_id: number;
  client_name: string;
}

interface TourRecord {
  id: number;
  title: string;
  is_available: boolean;
  client_price: number;
  commission_percent: number;
  agency_price: number;
  agency_commission: number;
}

interface OrderRecord {
  id: number;
  request_id: number;
  client_id: number;
  tour_id: number;
  client_name: string;
  employee_name: string;
  tour_title: string;
  client_price: number;
  commission_percent: number;
  agency_price: number;
  agency_commission: number;
  status: string;
  payment_status: string;
  note: string | null;
  created_at: string;
}

interface OrderFormValues {
  request_id: number;
  client_id: number;
  tour_id: number;
  note?: string;
  status?: string;
  payment_status?: string;
}

function parseAmount(value: unknown): number | null {
  const amount =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(amount) ? amount : null;
}

function parseRequest(value: unknown): RequestRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const request = value as Record<string, unknown>;
  if (
    typeof request.id !== 'number' ||
    typeof request.client_id !== 'number' ||
    typeof request.client_name !== 'string'
  ) {
    return null;
  }
  return {
    id: request.id,
    client_id: request.client_id,
    client_name: request.client_name,
  };
}

function parseTour(value: unknown): TourRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const tour = value as Record<string, unknown>;
  const amounts = {
    client_price: parseAmount(tour.client_price),
    commission_percent: parseAmount(tour.commission_percent),
    agency_price: parseAmount(tour.agency_price),
    agency_commission: parseAmount(tour.agency_commission),
  };
  const { client_price, commission_percent, agency_price, agency_commission } = amounts;
  if (
    typeof tour.id !== 'number' ||
    typeof tour.title !== 'string' ||
    typeof tour.is_available !== 'boolean' ||
    client_price === null ||
    commission_percent === null ||
    agency_price === null ||
    agency_commission === null
  ) {
    return null;
  }
  return {
    id: tour.id,
    title: tour.title,
    is_available: tour.is_available,
    client_price,
    commission_percent,
    agency_price,
    agency_commission,
  };
}

function parseOrder(value: unknown): OrderRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const order = value as Record<string, unknown>;
  const amounts = {
    client_price: parseAmount(order.client_price),
    commission_percent: parseAmount(order.commission_percent),
    agency_price: parseAmount(order.agency_price),
    agency_commission: parseAmount(order.agency_commission),
  };
  const { client_price, commission_percent, agency_price, agency_commission } = amounts;
  if (
    typeof order.id !== 'number' ||
    typeof order.request_id !== 'number' ||
    typeof order.client_id !== 'number' ||
    typeof order.tour_id !== 'number' ||
    typeof order.client_name !== 'string' ||
    typeof order.employee_name !== 'string' ||
    typeof order.tour_title !== 'string' ||
    client_price === null ||
    commission_percent === null ||
    agency_price === null ||
    agency_commission === null ||
    typeof order.status !== 'string' ||
    typeof order.payment_status !== 'string' ||
    (typeof order.note !== 'string' && order.note !== null) ||
    typeof order.created_at !== 'string'
  ) {
    return null;
  }
  return {
    id: order.id,
    request_id: order.request_id,
    client_id: order.client_id,
    tour_id: order.tour_id,
    client_name: order.client_name,
    employee_name: order.employee_name,
    tour_title: order.tour_title,
    client_price,
    commission_percent,
    agency_price,
    agency_commission,
    status: order.status,
    payment_status: order.payment_status,
    note: order.note,
    created_at: order.created_at,
  };
}

function parseList<T>(
  value: unknown,
  parse: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value)) return null;
  const records = value.map(parse);
  return records.some((record) => record === null)
    ? null
    : records.filter((record): record is T => record !== null);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ru-RU');
}

function OrdersPage() {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [tours, setTours] = useState<TourRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(() =>
    /^[1-9]\d*$/.test(searchParams.get('requestId') ?? ''),
  );
  const [selectedRequestId, setSelectedRequestId] = useState<number | undefined>(() => {
    const requestId = Number(searchParams.get('requestId'));
    return Number.isSafeInteger(requestId) && requestId > 0 ? requestId : undefined;
  });
  const [form] = Form.useForm<OrderFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const autoOpened = useRef(false);
  const requestIdParam = searchParams.get('requestId');
  const clientIdParam = searchParams.get('clientId');

  useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [requestResponse, tourResponse, orderResponse] = await Promise.all([
          apiFetch('/api/requests/', { signal: controller.signal }),
          apiFetch('/api/tours/', { signal: controller.signal }),
          apiFetch('/api/orders/', { signal: controller.signal }),
        ]);
        if (!requestResponse.ok || !tourResponse.ok || !orderResponse.ok) {
          throw new Error('Не удалось загрузить заказы или справочники');
        }
        const [requestData, tourData, orderData]: unknown[] = await Promise.all([
          requestResponse.json(),
          tourResponse.json(),
          orderResponse.json(),
        ]);
        const parsedRequests = parseList(requestData, parseRequest);
        const parsedTours = parseList(tourData, parseTour);
        const parsedOrders = parseList(orderData, parseOrder);
        if (!parsedRequests || !parsedTours || !parsedOrders) {
          throw new Error('Сервер вернул данные в неожиданном формате');
        }
        setRequests(parsedRequests);
        setTours(parsedTours);
        setOrders(parsedOrders);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error ? loadError.message : 'Не удалось загрузить заказы',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadData();
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (loading || error || autoOpened.current || !requestIdParam) return;
    autoOpened.current = true;
    const requestId = Number(requestIdParam);
    const request = requests.find((item) => item.id === requestId);
    if (!Number.isSafeInteger(requestId) || !request) {
      messageApi.error('Заявка для оформления заказа не найдена');
    } else {
      const requestedClientId = Number(clientIdParam);
      if (clientIdParam && requestedClientId !== request.client_id) {
        messageApi.error('Клиент не соответствует выбранной заявке');
      } else {
        form.resetFields();
        form.setFieldsValue({
          request_id: request.id,
          client_id: request.client_id,
        });
      }
    }
    setSearchParams({}, { replace: true });
  }, [
    clientIdParam,
    error,
    form,
    loading,
    messageApi,
    requestIdParam,
    requests,
    setSearchParams,
  ]);

  function openCreateModal(request?: RequestRecord) {
    setSelectedOrder(null);
    setSelectedRequestId(request?.id);
    form.resetFields();
    if (request) {
      form.setFieldsValue({
        request_id: request.id,
        client_id: request.client_id,
      });
    }
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(order: OrderRecord) {
    setSelectedOrder(order);
    setSelectedRequestId(order.request_id);
    setError(null);
    form.setFieldsValue({
      request_id: order.request_id,
      client_id: order.client_id,
      tour_id: order.tour_id,
      note: order.note ?? '',
      status: order.status,
      payment_status: order.payment_status,
    });
    setModalOpen(true);
  }

  const selectedRequest = requests.find((item) => item.id === selectedRequestId);
  const selectedTourId = Form.useWatch('tour_id', form);
  const selectedTour = tours.find((item) => item.id === selectedTourId);
  const selectedAmounts =
    selectedTour && selectedOrder?.tour_id === selectedTour.id
      ? selectedOrder
      : selectedTour;

  async function saveOrder(values: OrderFormValues) {
    const action = selectedOrder ? 'обновить' : 'оформить';
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(
        selectedOrder ? `/api/orders/${selectedOrder.id}` : '/api/orders/',
        {
          method: selectedOrder ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...values,
            note: values.note?.trim() || null,
          }),
        },
      );
      if (!response.ok) {
        let detail = `Не удалось ${action} заказ (HTTP ${response.status})`;
        try {
          const body: unknown = await response.json();
          if (
            typeof body === 'object' &&
            body !== null &&
            'detail' in body &&
            typeof body.detail === 'string'
          ) {
            detail = body.detail;
          }
        } catch {
          // Use the HTTP status when the server response is not JSON.
        }
        throw new Error(detail);
      }
      const data: unknown = await response.json();
      if (!parseOrder(data)) {
        throw new Error('Сервер вернул данные заказа в неожиданном формате');
      }
      setModalOpen(false);
      setReloadKey((key) => key + 1);
      setSelectedOrder(null);
      messageApi.success(selectedOrder ? 'Заказ обновлен' : 'Заказ оформлен');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : `Не удалось ${action} заказ`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder(order: OrderRecord) {
    setError(null);
    try {
      const response = await apiFetch(`/api/orders/${order.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Не удалось удалить заказ (HTTP ${response.status})`);
      }
      setReloadKey((key) => key + 1);
      messageApi.success('Заказ удален');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Не удалось удалить заказ',
      );
    }
  }

  const columns: ColumnsType<OrderRecord> = [
    { title: '№', dataIndex: 'id', key: 'id', width: 70 },
    {
      title: 'Заявка',
      dataIndex: 'request_id',
      key: 'request_id',
      width: 100,
      render: (id: number) => `№${id}`,
    },
    { title: 'Клиент', dataIndex: 'client_name', key: 'client_name', width: 200 },
    { title: 'Тур', dataIndex: 'tour_title', key: 'tour_title', width: 220 },
    {
      title: 'Стоимость для клиента',
      dataIndex: 'client_price',
      key: 'client_price',
      width: 180,
      render: formatCurrency,
    },
    {
      title: 'Комиссия',
      key: 'commission',
      width: 180,
      render: (_, order) =>
        `${order.commission_percent}% (${formatCurrency(order.agency_commission)})`,
    },
    {
      title: 'Стоимость для агентства',
      dataIndex: 'agency_price',
      key: 'agency_price',
      width: 190,
      render: formatCurrency,
    },
    {
      title: 'Статус заказа',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: 'Статус оплаты',
      dataIndex: 'payment_status',
      key: 'payment_status',
      width: 150,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    { title: 'Сотрудник', dataIndex: 'employee_name', key: 'employee_name', width: 180 },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: formatDate,
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 110,
      fixed: 'right',
      render: (_, order) => (
        <Space>
          <Button
            aria-label={`Редактировать заказ ${order.id}`}
            icon={<EditOutlined />}
            onClick={() => openEditModal(order)}
          />
          <Popconfirm
            title="Удалить заказ?"
            description={`Заказ №${order.id}`}
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => deleteOrder(order)}
          >
            <Button
              aria-label={`Удалить заказ ${order.id}`}
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
          Заказы
        </Typography.Title>
        <Typography.Text type="secondary">
          Заказы клиентов и зафиксированные финансовые условия тура
        </Typography.Text>
      </div>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => openCreateModal()}
      >
        Оформить заказ
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
      <Table<OrderRecord>
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        tableLayout="fixed"
        scroll={{ x: 1800 }}
        locale={{
          emptyText: error ? 'Не удалось загрузить данные' : 'Заказы не найдены',
        }}
      />
      <Modal
        title={selectedOrder ? 'Редактирование заказа' : 'Оформление заказа'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText={selectedOrder ? 'Сохранить' : 'Оформить'}
        cancelText="Отмена"
        confirmLoading={saving}
        width={760}
        destroyOnHidden
      >
        {error && (
          <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
        )}
        <Form<OrderFormValues>
          form={form}
          layout="vertical"
          onFinish={saveOrder}
          onValuesChange={(changedValues: Partial<OrderFormValues>) => {
            if (typeof changedValues.request_id === 'number') {
              const request = requests.find(
                (item) => item.id === changedValues.request_id,
              );
              setSelectedRequestId(request?.id);
              form.setFieldValue('client_id', request?.client_id);
            }
          }}
        >
          <Form.Item
            name="request_id"
            label="Заявка"
            rules={[{ required: true, message: 'Выберите заявку' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Выберите заявку"
              options={requests.map((request) => ({
                value: request.id,
                label: `№${request.id} — ${request.client_name}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="client_id"
            label="Клиент"
            rules={[{ required: true, message: 'Выберите заявку для клиента' }]}
          >
            <Select
              disabled
              placeholder="Клиент заполнится из заявки"
              options={
                selectedRequest
                  ? [
                      {
                        value: selectedRequest.client_id,
                        label: selectedRequest.client_name,
                      },
                    ]
                  : []
              }
            />
          </Form.Item>
          <Form.Item
            name="tour_id"
            label="Тур"
            rules={[{ required: true, message: 'Выберите тур' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Выберите доступный тур"
              options={tours
                .filter(
                  (tour) =>
                    tour.is_available || tour.id === selectedOrder?.tour_id,
                )
                .map((tour) => ({ value: tour.id, label: tour.title }))}
            />
          </Form.Item>
          {selectedAmounts && (
            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, sm: 2 }}
              style={{ marginBottom: 24 }}
              items={[
                {
                  key: 'client-price',
                  label: 'Стоимость для клиента',
                  children: formatCurrency(selectedAmounts.client_price),
                },
                {
                  key: 'commission-percent',
                  label: 'Процент комиссии',
                  children: `${selectedAmounts.commission_percent}%`,
                },
                {
                  key: 'agency-price',
                  label: 'Стоимость для агентства',
                  children: formatCurrency(selectedAmounts.agency_price),
                },
                {
                  key: 'agency-commission',
                  label: 'Комиссия турагентства',
                  children: formatCurrency(selectedAmounts.agency_commission),
                },
              ]}
            />
          )}
          {selectedOrder && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="status"
                  label="Статус заказа"
                  rules={[{ required: true, message: 'Укажите статус заказа' }]}
                >
                  <Select
                    options={ORDER_STATUSES.map((status) => ({
                      value: status,
                      label: status,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="payment_status"
                  label="Статус оплаты"
                  rules={[{ required: true, message: 'Укажите статус оплаты' }]}
                >
                  <Select
                    options={PAYMENT_STATUSES.map((status) => ({
                      value: status,
                      label: status,
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>
          )}
          <Form.Item name="note" label="Примечание">
            <Input.TextArea rows={3} maxLength={5000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default OrdersPage;
