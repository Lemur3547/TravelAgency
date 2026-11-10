import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
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

interface TourOperatorRecord {
  id: number;
  name: string;
  legal_name: string;
  inn: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  is_active: boolean;
  created_at: string;
}

interface TourOperatorFormValues {
  name: string;
  legal_name: string;
  inn: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  is_active: boolean;
}

function formatRussianNationalNumber(value: string): string {
  const digits = value.slice(0, 10);
  if (!digits) return '';

  const area = digits.slice(0, 3);
  const firstPart = digits.slice(3, 6);
  const secondPart = digits.slice(6, 8);
  const thirdPart = digits.slice(8, 10);
  let formatted = `(${area}`;
  if (area.length === 3) formatted += ')';
  if (firstPart) formatted += ` ${firstPart}`;
  if (secondPart) formatted += `-${secondPart}`;
  if (thirdPart) formatted += `-${thirdPart}`;
  return formatted;
}

function RussianPhoneInput({
  value = '',
  onChange,
}: {
  value?: string;
  onChange?: (value: string) => void;
}) {
  const inputRef = useRef<InputRef>(null);
  const caretDigitCount = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (caretDigitCount.current === null) return;
    const input = inputRef.current?.input;
    if (!input) return;

    let position = 0;
    let digitsSeen = 0;
    while (position < input.value.length && digitsSeen < caretDigitCount.current) {
      if (/\d/.test(input.value[position])) digitsSeen += 1;
      position += 1;
    }
    input.setSelectionRange(position, position);
    caretDigitCount.current = null;
  }, [value]);

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="tel"
      placeholder="+7 (___) ___-__-__"
      value={formatRussianPhone(value)}
      onChange={(event) => {
        const cursor = event.target.selectionStart ?? event.target.value.length;
        const textBeforeCursor = event.target.value.slice(0, cursor);
        const digitsBeforeCursor = textBeforeCursor.replace(/\D/g, '');
        const startsWithPrefix =
          event.target.value.trimStart().startsWith('+7') ||
          /^[78]/.test(event.target.value.trimStart());
        const nationalDigitsBeforeCursor = startsWithPrefix
          ? Math.max(0, digitsBeforeCursor.length - 1)
          : digitsBeforeCursor.length;
        const formattedValue = formatRussianPhone(event.target.value);
        caretDigitCount.current = 1 + Math.min(nationalDigitsBeforeCursor, 10);
        onChange?.(formattedValue);
      }}
    />
  );
}

function formatRussianPhone(value: string): string {
  const trimmedValue = value.trimStart();
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return trimmedValue.startsWith('+') ? '+' : '';

  if (trimmedValue.startsWith('+')) {
    if (digits[0] === '7') {
      return `+7 ${formatRussianNationalNumber(digits.slice(1, 11))}`;
    }
    return `+7 ${formatRussianNationalNumber(digits.slice(0, 10))}`;
  }

  if (digits[0] === '8') {
    return `8 ${formatRussianNationalNumber(digits.slice(1, 11))}`;
  }
  if (digits[0] === '7') {
    return `+7 ${formatRussianNationalNumber(digits.slice(1, 11))}`;
  }
  return `+7 ${formatRussianNationalNumber(digits.slice(0, 10))}`;
}

function isValidRussianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  const isNationalNumberValid = (number: string) => /^[3-9]\d{9}$/.test(number);

  if (digits.length !== 11) return false;
  if (value.trimStart().startsWith('8')) {
    return digits.startsWith('8') && isNationalNumberValid(digits.slice(1));
  }
  return digits.startsWith('7') && isNationalNumberValid(digits.slice(1));
}

function isTourOperatorRecord(value: unknown): value is TourOperatorRecord {
  if (typeof value !== 'object' || value === null) return false;

  const operator = value as Record<string, unknown>;
  return (
    typeof operator.id === 'number' &&
    typeof operator.name === 'string' &&
    typeof operator.legal_name === 'string' &&
    typeof operator.inn === 'string' &&
    typeof operator.address === 'string' &&
    typeof operator.phone === 'string' &&
    typeof operator.email === 'string' &&
    typeof operator.website === 'string' &&
    typeof operator.is_active === 'boolean' &&
    typeof operator.created_at === 'string'
  );
}

function isTourOperatorList(value: unknown): value is TourOperatorRecord[] {
  return Array.isArray(value) && value.every(isTourOperatorRecord);
}

function isValidLegalEntityInn(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  const checksum = weights.reduce(
    (sum, weight, index) => sum + Number(value[index]) * weight,
    0,
  );
  return (checksum % 11) % 10 === Number(value[9]);
}

function TourOperatorsPage() {
  const [operators, setOperators] = useState<TourOperatorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [form] = Form.useForm<TourOperatorFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOperator, setSelectedOperator] =
    useState<TourOperatorRecord | null>(null);

  const searchText = searchParams.get('search') ?? '';

  useEffect(() => {
    const controller = new AbortController();

    async function loadOperators() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        const search = searchText.trim();
        if (search) params.set('search', search);
        const response = await fetch(`/api/tour-operators/?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(
            `Не удалось загрузить список туроператоров (HTTP ${response.status})`,
          );
        }

        const result: unknown = await response.json();
        if (!isTourOperatorList(result)) {
          throw new Error('Сервер вернул данные туроператоров в неожиданном формате');
        }
        setOperators(result);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить список туроператоров',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadOperators();
    return () => controller.abort();
  }, [reloadKey, searchParams, searchText]);

  function openCreateModal() {
    setSelectedOperator(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setModalOpen(true);
  }

  function openEditModal(operator: TourOperatorRecord) {
    setSelectedOperator(operator);
    form.setFieldsValue({
      ...operator,
    });
    setModalOpen(true);
  }

  async function saveOperator(values: TourOperatorFormValues) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        selectedOperator
          ? `/api/tour-operators/${selectedOperator.id}`
          : '/api/tour-operators/',
        {
          method: selectedOperator ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        },
      );
      if (!response.ok) {
        throw new Error(
          `Не удалось ${selectedOperator ? 'обновить' : 'создать'} туроператора (HTTP ${response.status})`,
        );
      }

      setModalOpen(false);
      setReloadKey((key) => key + 1);
      messageApi.success(
        selectedOperator ? 'Данные туроператора обновлены' : 'Туроператор создан',
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Не удалось сохранить туроператора',
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteOperator(operator: TourOperatorRecord) {
    setError(null);
    try {
      const response = await fetch(`/api/tour-operators/${operator.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(
          `Не удалось удалить туроператора (HTTP ${response.status})`,
        );
      }
      setReloadKey((key) => key + 1);
      messageApi.success('Туроператор удален');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Не удалось удалить туроператора',
      );
    }
  }

  const columns: ColumnsType<TourOperatorRecord> = [
    {
      title: 'Туроператор',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'Юридическое наименование',
      dataIndex: 'legal_name',
      key: 'legal_name',
      width: 240,
      ellipsis: true,
    },
    {
      title: 'ИНН',
      dataIndex: 'inn',
      key: 'inn',
      width: 130,
    },
    {
      title: 'Телефон',
      dataIndex: 'phone',
      key: 'phone',
      width: 170,
      render: (phone: string) => formatRussianPhone(phone),
    },
    {
      title: 'Электронная почта',
      dataIndex: 'email',
      key: 'email',
      width: 210,
      ellipsis: true,
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 120,
      render: (isActive: boolean) =>
        isActive ? <Tag color="green">Активен</Tag> : <Tag>Неактивен</Tag>,
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      render: (_, operator) => (
        <Space>
          <Button
            aria-label={`Редактировать ${operator.name}`}
            icon={<EditOutlined />}
            onClick={() => openEditModal(operator)}
          />
          <Popconfirm
            title="Удалить туроператора?"
            description={operator.name}
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => deleteOperator(operator)}
          >
            <Button
              aria-label={`Удалить ${operator.name}`}
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
          Туроператоры
        </Typography.Title>
        <Typography.Text type="secondary">
          Компании, с которыми сотрудничает турагентство
        </Typography.Text>
      </div>

      <Space wrap>
        <Input
          aria-label="Поиск туроператоров"
          placeholder="Поиск по названию, ИНН или контактам"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(event) => {
            const nextParams = new URLSearchParams(searchParams);
            const search = event.target.value;
            if (search.trim()) nextParams.set('search', search);
            else nextParams.delete('search');
            setSearchParams(nextParams, { replace: true });
          }}
          allowClear
          style={{ width: 360, maxWidth: '100%' }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          Добавить туроператора
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

      <Table<TourOperatorRecord>
        columns={columns}
        dataSource={operators}
        rowKey="id"
        loading={loading}
        tableLayout="fixed"
        pagination={false}
        locale={{
          emptyText: error ? 'Не удалось загрузить данные' : 'Туроператоры не найдены',
        }}
        scroll={{ x: 1170 }}
      />

      <Modal
        title={selectedOperator ? 'Редактировать туроператора' : 'Новый туроператор'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form<TourOperatorFormValues>
          form={form}
          layout="vertical"
          validateTrigger="onBlur"
          onFinish={saveOperator}
          initialValues={{ is_active: true }}
        >
          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, whitespace: true, message: 'Укажите название' }]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item
            name="legal_name"
            label="Юридическое наименование"
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Укажите юридическое наименование',
              },
            ]}
          >
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item
            name="inn"
            label="ИНН"
            rules={[
              { required: true, whitespace: true, message: 'Укажите ИНН' },
              {
                validator: (_, value: string | undefined) =>
                  !value || isValidLegalEntityInn(value)
                    ? Promise.resolve()
                    : Promise.reject(new Error('Укажите корректный 10-значный ИНН')),
              },
            ]}
          >
            <Input maxLength={10} />
          </Form.Item>
          <Form.Item
            name="address"
            label="Юридический адрес"
            rules={[{ required: true, whitespace: true, message: 'Укажите адрес' }]}
          >
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Телефон"
            rules={[
              { required: true, message: 'Укажите телефон' },
              {
                validator: (_, value: string | undefined) =>
                  !value || isValidRussianPhone(value)
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error('Введите корректный номер телефона'),
                      ),
              },
            ]}
          >
            <RussianPhoneInput />
          </Form.Item>
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
          <Form.Item
            name="website"
            label="Сайт"
            rules={[{ required: true, whitespace: true, message: 'Укажите сайт' }]}
          >
            <Input maxLength={255} />
          </Form.Item>
          {selectedOperator && (
            <Form.Item
              name="is_active"
              label="Сотрудничество активно"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Space>
  );
}

export default TourOperatorsPage;
