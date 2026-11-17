import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popover,
  Popconfirm,
  Radio,
  Select,
  Col,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import { ClientForm } from '../components/ClientForm';
import type { ClientFormValues } from '../components/ClientForm';
import { CurrencyInput } from '../components/CurrencyInput';
import { apiFetch, ensureSession } from '../utils/api';

const REQUEST_STATUSES = ['Новая', 'В работе', 'Оформлена', 'Отменена'] as const;
const MAX_REQUEST_BUDGET = 9999999999.99;
type RequestStatus = (typeof REQUEST_STATUSES)[number];
type DirectionKind = 'country' | 'destination';

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

interface Direction {
  kind: DirectionKind;
  id: number;
}

interface RequestRecord {
  id: number;
  client_id: number;
  employee_id: number;
  client_name: string;
  client_phone: string;
  employee_name: string;
  departure_city_id: number;
  departure_city: string;
  desired_direction: Direction[];
  desired_direction_names: string[];
  desired_start_date: string | null;
  desired_end_date: string | null;
  min_nights: number | null;
  max_nights: number | null;
  tourists: number;
  min_budget: number | null;
  max_budget: number | null;
  wishes: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
}

interface RequestFormValues {
  client_id: number;
  departure_city_id: number;
  desired_direction: string[];
  desired_range?: [Dayjs, Dayjs] | null;
  night_range?: [number, number] | null;
  tourists: number;
  min_budget?: string | null;
  max_budget?: string | null;
  wishes?: string | null;
  status?: RequestStatus;
}

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

function parseRequest(value: unknown): RequestRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== 'number' ||
    typeof item.client_id !== 'number' ||
    typeof item.employee_id !== 'number' ||
    typeof item.client_name !== 'string' ||
    typeof item.client_phone !== 'string' ||
    typeof item.employee_name !== 'string' ||
    typeof item.departure_city_id !== 'number' ||
    typeof item.departure_city !== 'string' ||
    !Array.isArray(item.desired_direction) ||
    !item.desired_direction.every(
      (direction) =>
        typeof direction === 'object' &&
        direction !== null &&
        ((direction as Record<string, unknown>).kind === 'country' ||
          (direction as Record<string, unknown>).kind === 'destination') &&
        typeof (direction as Record<string, unknown>).id === 'number',
    ) ||
    !Array.isArray(item.desired_direction_names) ||
    !item.desired_direction_names.every((name) => typeof name === 'string') ||
    (typeof item.desired_start_date !== 'string' && item.desired_start_date !== null) ||
    (typeof item.desired_end_date !== 'string' && item.desired_end_date !== null) ||
    (typeof item.min_nights !== 'number' && item.min_nights !== null) ||
    (typeof item.max_nights !== 'number' && item.max_nights !== null) ||
    typeof item.tourists !== 'number' ||
    (typeof item.min_budget !== 'number' &&
      typeof item.min_budget !== 'string' &&
      item.min_budget !== null) ||
    (typeof item.max_budget !== 'number' &&
      typeof item.max_budget !== 'string' &&
      item.max_budget !== null) ||
    (typeof item.wishes !== 'string' && item.wishes !== null) ||
    !REQUEST_STATUSES.includes(item.status as RequestStatus) ||
    typeof item.created_at !== 'string' ||
    typeof item.updated_at !== 'string'
  ) {
    return null;
  }
  return {
    ...item,
    min_budget:
      item.min_budget === null ? null : Number(item.min_budget),
    max_budget:
      item.max_budget === null ? null : Number(item.max_budget),
  } as RequestRecord;
}

function parseRequestList(value: unknown): RequestRecord[] | null {
  if (!Array.isArray(value)) return null;
  const records = value.map(parseRequest);
  return records.some((record) => record === null)
    ? null
    : records.filter((record): record is RequestRecord => record !== null);
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

function isDepartureCityList(value: unknown): value is DepartureCity[] {
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

interface DepartureCity {
  id: number;
  name: string;
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

function getClientName(client: ClientRecord): string {
  return [client.last_name, client.first_name, client.father_name]
    .filter(Boolean)
    .join(' ');
}

function requestDirectionKey(direction: Direction): string {
  return `${direction.kind}:${direction.id}`;
}

function formatDateWithCapitalizedMonth(date: Dayjs, format: string): string {
  return date.format(format).replace(/[а-яё]+/i, (month) =>
    month.charAt(0).toLocaleUpperCase('ru') + month.slice(1),
  );
}

function formatPeriod(value: RequestRecord): string {
  if (!value.desired_start_date || !value.desired_end_date) return 'Не указан';
  const start = dayjs(value.desired_start_date).locale('ru');
  const end = dayjs(value.desired_end_date).locale('ru');
  if (start.date() === 1 && end.isSame(start.endOf('month'), 'day')) {
    return start.format('MMMM YYYY').replace(/^\p{L}/u, char => char.toUpperCase()); 
  }
  if (start.isSame(end, 'day')) {
    return start.format('D MMMM YYYY');
  }
  if (start.isSame(end, 'month')) {
    return `С ${start.date()} по ${end.format('D MMMM YYYY')}`;
  }
  if (start.isSame(end, 'year')) {
    return `С ${start.format('D MMMM')} по ${end.format('D MMMM YYYY')}`;
  }
  return `С ${start.format('D MMMM YYYY')} по ${end.format('D MMMM YYYY')}`;
}

function formatNights(min: number | null, max: number | null): string {
  if (min === null || max === null) return 'Не указана';
  return min === max ? `${min} ночей` : `от ${min} до ${max} ночей`;
}

function formatBudget(min: number | null, max: number | null): string {
  const currency = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  if (min === null && max === null) return 'Не указан';
  if (min === null) return `до ${currency.format(max ?? 0)} ₽`;
  if (max === null) return `от ${currency.format(min)} ₽`;
  return `${currency.format(min)}–${currency.format(max)} ₽`;
}

function parseBudgetInput(value: string | null | undefined): number | null {
  if (value == null || value === '') return null;
  return Number(value.replace(',', '.'));
}

function getApiError(response: Response, action: string): Promise<Error> {
  return response
    .json()
    .then((body: unknown) => {
      const detail =
        typeof body === 'object' && body !== null && 'detail' in body
          ? body.detail
          : null;
      return new Error(
        typeof detail === 'string' ? detail : `${action} (HTTP ${response.status})`,
      );
    })
    .catch(() => new Error(`${action} (HTTP ${response.status})`));
}

function DirectionAutocomplete({
  value = [],
  onChange,
  directionNames,
}: {
  value?: string[];
  onChange?: (value: string[]) => void;
  directionNames: Map<string, string>;
}) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [matches, setMatches] = useState<Array<{ value: string; label: string }>>([]);
  const [matchesFor, setMatchesFor] = useState('');
  const [knownNames, setKnownNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const search = input.trim();

  useEffect(() => {
    if (search.length < 2) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ search, limit: '10' });
        const [countryResponse, destinationResponse] = await Promise.all([
          apiFetch(`/api/countries?${params}`, { signal: controller.signal }),
          apiFetch(`/api/destinations?${params}`, { signal: controller.signal }),
        ]);
        if (!countryResponse.ok || !destinationResponse.ok) {
          throw new Error('Не удалось выполнить поиск направлений');
        }
        const [countryData, destinationData]: unknown[] = await Promise.all([
          countryResponse.json(),
          destinationResponse.json(),
        ]);
        if (!isCountryList(countryData) || !isDestinationList(destinationData)) {
          throw new Error('Сервер вернул некорректный список направлений');
        }
        const options = [
          ...countryData.map((country) => ({
            value: `country:${country.id}`,
            label: country.name,
          })),
          ...destinationData.map((destination) => ({
            value: `destination:${destination.id}`,
            label: destination.name,
          })),
        ];
        setMatches(options);
        setMatchesFor(search);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        message.error(
          error instanceof Error ? error.message : 'Не удалось найти направления',
        );
        setMatches([]);
        setMatchesFor(search);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  const availableMatches = matchesFor === search
    ? matches.filter((match) => !value.includes(match.value))
    : [];

  return (
    <Select
      mode="multiple"
      value={value}
      options={availableMatches}
      open={isFocused && search.length > 0}
      menuItemSelectedIcon={null}
      placeholder="Введите страну или направление"
      suffixIcon={<SearchOutlined />}
      notFoundContent={loading ? 'Поиск...' : search.length < 2 ? null : 'Ничего не найдено'}
      filterOption={false}
      onFocus={() => {
        setIsFocused(true);
        setInput('');
        setMatchesFor('');
        setLoading(false);
      }}
      onBlur={() => setIsFocused(false)}
      onSelect={() => setIsFocused(false)}
      onSearch={(searchText) => {
        const nextSearch = searchText.trim();
        setIsFocused(true);
        setInput(searchText);
        setMatchesFor('');
        setLoading(nextSearch.length >= 2);
      }}
      onChange={(nextValues: string[]) => {
        const selectedValues = nextValues.filter((item) => !value.includes(item));
        if (selectedValues.length) {
          setInput('');
          setMatchesFor('');
          setLoading(false);
          setKnownNames((current) => {
            const next = new Map(current);
            selectedValues.forEach((key) => {
              const label = matches.find((match) => match.value === key)?.label;
              if (label) next.set(key, label);
            });
            return next;
          });
        }
        onChange?.(nextValues);
      }}
      tagRender={({ value: key, closable, onClose }) => (
        <Tag
          closable={closable}
          onClose={onClose}
          style={{ marginInlineEnd: 4 }}
        >
          {directionNames.get(String(key)) ?? knownNames.get(String(key)) ?? key}
        </Tag>
      )}
      allowClear
    />
  );
}

function DepartureCityAutocomplete({
  value,
  onChange,
  departureCities,
}: {
  value?: number;
  onChange?: (value: number | undefined) => void;
  departureCities: DepartureCity[];
}) {
  const [input, setInput] = useState('');
  const [matches, setMatches] = useState<DepartureCity[]>([]);
  const [matchesFor, setMatchesFor] = useState('');
  const [loading, setLoading] = useState(false);
  const selectedName = departureCities.find((city) => city.id === value)?.name;
  const search = selectedName ? '' : input.trim();

  useEffect(() => {
    if (search.length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ search, limit: '10' });
        const response = await apiFetch(`/api/departures?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Не удалось выполнить поиск городов вылета');
        const data: unknown = await response.json();
        if (!isDepartureCityList(data)) {
          throw new Error('Сервер вернул некорректный список городов вылета');
        }
        setMatches(data);
        setMatchesFor(search);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        message.error(
          error instanceof Error ? error.message : 'Не удалось найти город вылета',
        );
        setMatches([]);
        setMatchesFor(search);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  return (
    <AutoComplete
      value={selectedName ?? input}
      options={
        matchesFor === search
          ? matches.map((city) => ({ value: String(city.id), label: city.name }))
          : []
      }
      placeholder="Введите город"
      notFoundContent={loading ? 'Поиск...' : search.length < 2 ? null : 'Город не найден'}
      filterOption={false}
      onSearch={(searchText) => {
        setInput(searchText);
        onChange?.(undefined);
        setMatchesFor('');
        setLoading(searchText.trim().length >= 2);
      }}
      onSelect={(selected) => {
        const city = matches.find((item) => String(item.id) === selected);
        if (!city) return;
        onChange?.(city.id);
        setInput('');
      }}
      onClear={() => {
        setInput('');
        onChange?.(undefined);
      }}
      allowClear
    />
  );
}

function ClientAutocomplete({
  value,
  onChange,
  selectedClient,
  onClientSelected,
  onAddClient,
}: {
  value?: number;
  onChange?: (value: number | undefined) => void;
  selectedClient: ClientRecord | null;
  onClientSelected: (client: ClientRecord | null) => void;
  onAddClient: () => void;
}) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<ClientRecord[]>([]);
  const [resultsFor, setResultsFor] = useState('');
  const [loading, setLoading] = useState(false);
  const selectedName =
    value && selectedClient?.id === value ? getClientName(selectedClient) : null;
  const search = selectedName ? '' : input.trim();

  useEffect(() => {
    if (!search) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setResults([]);
      setResultsFor('');
      setLoading(true);
      try {
        const params = new URLSearchParams({ search, limit: '10' });
        const response = await apiFetch(`/api/clients/?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Не удалось выполнить поиск клиентов (HTTP ${response.status})`);
        }
        const data: unknown = await response.json();
        if (
          typeof data !== 'object' ||
          data === null ||
          !('items' in data) ||
          !Array.isArray(data.items) ||
          !data.items.every(isClientRecord)
        ) {
          throw new Error('Сервер вернул некорректный список клиентов');
        }
        setResults(data.items);
        setResultsFor(search);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        message.error(
          error instanceof Error ? error.message : 'Не удалось найти клиентов',
        );
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  const visibleResults = resultsFor === search ? results : [];
  const options = visibleResults.map((client) => ({
    value: String(client.id),
    label: (
      <div style={{ lineHeight: 1.4 }}>
        <div>{getClientName(client)}</div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {client.phone}
        </Typography.Text>
      </div>
    ),
  }));
  if (search && !loading && resultsFor === search && results.length === 0) {
    options.push({
      value: '__add_client__',
      label: <Typography.Text type="secondary">Добавить клиента</Typography.Text>,
    });
  }

  return (
    <AutoComplete
      value={selectedName ?? input}
      options={options}
      placeholder="Начните вводить ФИО клиента"
      notFoundContent={loading ? 'Поиск...' : null}
      filterOption={false}
      onSearch={(search) => {
        setInput(search);
        onChange?.(undefined);
        onClientSelected(null);
      }}
      onSelect={(selectedValue) => {
        if (selectedValue === '__add_client__') {
          onAddClient();
          return;
        }
        const client = visibleResults.find((result) => String(result.id) === selectedValue);
        if (!client) return;
        setInput('');
        onChange?.(client.id);
        onClientSelected(client);
      }}
      onClear={() => {
        setInput('');
        onChange?.(undefined);
        onClientSelected(null);
      }}
      allowClear
      style={{ width: '100%' }}
    />
  );
}

function PeriodPicker({
  value,
  onChange,
}: {
  value?: [Dayjs, Dayjs] | null;
  onChange?: (value: [Dayjs, Dayjs] | null) => void;
}) {
  const today = dayjs().startOf('day');
  const currentMonth = today.startOf('month');
  const fullMonth =
    !!value &&
    value[0].date() === 1 &&
    value[1].isSame(value[0].endOf('month'), 'day');
  const [selectedMode, setSelectedMode] = useState<'dates' | 'month'>(
    fullMonth ? 'month' : 'dates',
  );
  const [open, setOpen] = useState(false);
  const [panelDate, setPanelDate] = useState<Dayjs>(
    () => value?.[0].startOf('month') ?? currentMonth,
  );
  const [pendingStart, setPendingStart] = useState<Dayjs | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Dayjs | null>(null);
  const mode = selectedMode;
  const isPickingMonth = mode === 'month';
  const secondPanelDate = isPickingMonth
    ? panelDate.add(1, 'year')
    : panelDate.add(1, 'month');
  const displayedPeriod = value
    ? fullMonth
      ? value[0].locale('ru').format('MMMM YYYY')
      : value[0].isSame(value[1], 'day')
        ? value[0].locale('ru').format('D MMMM YYYY')
        : value[0].isSame(value[1], 'month')
          ? `С ${value[0].date()} по ${value[1].locale('ru').format('D MMMM YYYY')}`
          : value[0].isSame(value[1], 'year')
            ? `С ${value[0].locale('ru').format('D MMMM')} по ${value[1].locale('ru').format('D MMMM YYYY')}`
            : `С ${value[0].locale('ru').format('D MMMM YYYY')} по ${value[1].locale('ru').format('D MMMM YYYY')}`
    : 'Выберите даты вылета';

  function selectDate(date: Dayjs) {
    if (isPickingMonth) {
      const start = date.startOf('month');
      if (start.isBefore(currentMonth, 'month')) return;
      onChange?.([start, start.endOf('month')]);
      setOpen(false);
      return;
    }
    if (!pendingStart) {
      setPendingStart(date);
      setHoveredDate(date);
      onChange?.([date, date]);
      return;
    }
    const start = pendingStart.isBefore(date, 'day') ? pendingStart : date;
    const end = pendingStart.isBefore(date, 'day') ? date : pendingStart;
    onChange?.([start, end]);
    setPendingStart(null);
    setHoveredDate(null);
    setOpen(false);
  }

  function navigatePanels(direction: -1 | 1) {
    const nextDate = isPickingMonth
      ? panelDate.add(direction, 'year')
      : panelDate.add(direction, 'month');
    if (isPickingMonth ? nextDate.year() < today.year() : nextDate.isBefore(currentMonth, 'month')) {
      return;
    }
    setPanelDate(nextDate);
  }

  function renderMonth(month: Dayjs) {
    const firstDay = month.locale('ru').startOf('month').startOf('week');
    const days = Array.from({ length: 42 }, (_, index) => firstDay.add(index, 'day'));
    const storedRange = fullMonth ? null : value;
    const rangeStart = pendingStart ?? storedRange?.[0] ?? null;
    const rangeEnd = pendingStart
      ? hoveredDate ?? pendingStart
      : storedRange?.[1] ?? null;
    const previewStart =
      rangeStart && rangeEnd && rangeEnd.isBefore(rangeStart, 'day')
        ? rangeEnd
        : rangeStart;
    const previewEnd =
      rangeStart && rangeEnd && rangeEnd.isBefore(rangeStart, 'day')
        ? rangeStart
        : rangeEnd;

    return (
      <div key={month.format('YYYY-MM')} style={{ minWidth: 250 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            textAlign: 'center',
            marginBottom: 4,
          }}
        >
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
            <Typography.Text key={day} type="secondary" style={{ fontSize: 12 }}>
              {day}
            </Typography.Text>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {days.map((date) => {
            const belongsToMonth = date.month() === month.month();
            const disabled = !belongsToMonth || date.isBefore(today, 'day');
            const inRange =
              !!previewStart &&
              !!previewEnd &&
              !date.isBefore(previewStart, 'day') &&
              !date.isAfter(previewEnd, 'day');
            const isStart = !!previewStart && date.isSame(previewStart, 'day');
            const isEnd = !!previewEnd && date.isSame(previewEnd, 'day');
            return (
              <Button
                key={date.format('YYYY-MM-DD')}
                type={isStart || isEnd ? 'primary' : 'text'}
                disabled={disabled}
                onMouseEnter={() => {
                  if (pendingStart && !disabled) setHoveredDate(date);
                }}
                onMouseLeave={() => {
                  if (pendingStart) setHoveredDate(null);
                }}
                onClick={() => selectDate(date)}
                style={{
                  width: '100%',
                  height: 32,
                  padding: 0,
                  borderRadius: inRange ? 6 : undefined,
                  background: inRange && !isStart && !isEnd ? '#e6f4ff' : undefined,
                  color: inRange && !isStart && !isEnd ? '#1677ff' : undefined,
                  opacity: belongsToMonth ? 1 : 0,
                  pointerEvents: belongsToMonth ? undefined : 'none',
                }}
              >
                {date.date()}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderYear(year: number) {
    return (
      <div key={year} style={{ minWidth: 250 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {Array.from({ length: 12 }, (_, index) => {
            const month = dayjs().year(year).month(index).startOf('month');
            const disabled = month.isBefore(currentMonth, 'month');
            const selected =
              !!value &&
              value[0].isSame(month, 'month') &&
              value[1].isSame(month.endOf('month'), 'day');
            return (
              <Button
                key={index}
                type={selected ? 'primary' : 'text'}
                disabled={disabled}
                onClick={() => selectDate(month)}
              >
                {month.locale('ru').format('MMM').replace(/^\p{L}/u, char => char.toUpperCase())}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setPendingStart(null);
          setHoveredDate(null);
        }
        if (nextOpen) {
          setPanelDate(value?.[0].startOf('month') ?? currentMonth);
          setPendingStart(null);
        }
      }}
      content={
        <div style={{ width: 560 }}>
          <Radio.Group
            value={mode}
            optionType="button"
            buttonStyle="solid"
            style={{ marginBottom: 12 }}
            onChange={(event) => {
              setSelectedMode(event.target.value);
              setPendingStart(null);
              setHoveredDate(null);
              setPanelDate(
                event.target.value === 'month'
                  ? (value?.[0] ?? currentMonth).startOf('year')
                  : value && !fullMonth
                    ? value[0].startOf('month')
                    : currentMonth,
              );
            }}
            options={[
              { label: 'Период', value: 'dates' },
              { label: 'Месяц', value: 'month' },
            ]}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 40px',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Button
              type="text"
              icon={<LeftOutlined />}
              disabled={
                isPickingMonth
                  ? panelDate.year() <= today.year()
                  : !panelDate.isAfter(currentMonth, 'month')
              }
              onClick={() => navigatePanels(-1)}
              aria-label={isPickingMonth ? 'Предыдущий год' : 'Предыдущий месяц'}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[panelDate, secondPanelDate].map((date) => (
                <Typography.Text key={date.format('YYYY-MM')} strong style={{ textAlign: 'center' }}>
                  {isPickingMonth
                    ? date.format('YYYY')
                    : formatDateWithCapitalizedMonth(date.locale('ru'), 'MMMM YYYY')}
                </Typography.Text>
              ))}
            </div>
            <Button
              type="text"
              icon={<RightOutlined />}
              onClick={() => navigatePanels(1)}
              aria-label={isPickingMonth ? 'Следующий год' : 'Следующий месяц'}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {isPickingMonth
              ? [renderYear(panelDate.year()), renderYear(secondPanelDate.year())]
              : [renderMonth(panelDate), renderMonth(secondPanelDate)]}
          </div>
        </div>
      }
    >
      <Button block style={{ textAlign: 'left' }}>
        {displayedPeriod}
      </Button>
    </Popover>
  );
}

function NightsPicker({
  value,
  onChange,
}: {
  value?: [number, number] | null;
  onChange?: (value: [number, number] | null) => void;
}) {
  const [first, setFirst] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const display = value ? formatNights(value[0], value[1]) : 'Выберите количество ночей';

  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setFirst(null);
          setHovered(null);
        }
      }}
      content={
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 36px)',
            gap: 4,
          }}
        >
          {Array.from({ length: 30 }, (_, index) => index + 1).map((night) => {
            const previewRange =
              first !== null && hovered !== null
                ? [Math.min(first, hovered), Math.max(first, hovered)]
                : value;
            const selected =
              !!previewRange && night >= previewRange[0] && night <= previewRange[1];
            const isFirst = first === night;
            return (
              <Button
                key={night}
                type={selected ? 'primary' : 'text'}
                style={{
                  borderRadius:
                    selected && night !== previewRange?.[0] && night !== previewRange?.[1]
                      ? 0
                      : undefined,
                  opacity: selected && !isFirst ? 0.75 : undefined,
                }}
                onMouseEnter={() => setHovered(night)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (first === null) {
                    setFirst(night);
                    onChange?.([night, night]);
                  } else {
                    onChange?.([Math.min(first, night), Math.max(first, night)]);
                    setFirst(null);
                    setOpen(false);
                  }
                }}
              >
                {night}
              </Button>
            );
          })}
        </div>
      }
    >
      <Button block style={{ textAlign: 'left', height: 'auto', minHeight: 32 }}>
        {display}
      </Button>
    </Popover>
  );
}

function RequestsPage() {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [departureCities, setDepartureCities] = useState<DepartureCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestRecord | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [form] = Form.useForm<RequestFormValues>();
  const [clientForm] = Form.useForm<ClientFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [requestResponse, cityResponse] =
          await Promise.all([
            apiFetch('/api/requests/', { signal: controller.signal }),
            apiFetch('/api/departures', { signal: controller.signal }),
          ]);
        if (!requestResponse.ok || !cityResponse.ok) {
          throw new Error('Не удалось загрузить заявки или справочники');
        }
        const [requestData, cityData]: unknown[] =
          await Promise.all([
            requestResponse.json(),
            cityResponse.json(),
          ]);
        const parsedRequests = parseRequestList(requestData);
        if (!parsedRequests || !isDepartureCityList(cityData)) {
          throw new Error('Сервер вернул данные в неожиданном формате');
        }
        setRequests(parsedRequests);
        setDepartureCities(cityData);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error ? loadError.message : 'Не удалось загрузить заявки',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadData();
    return () => controller.abort();
  }, [reloadKey]);

  const directionNames = useMemo(() => {
    const names = new Map<string, string>();
    requests.forEach((request) => {
      request.desired_direction.forEach((direction, index) => {
        names.set(
          requestDirectionKey(direction),
          request.desired_direction_names[index] ?? requestDirectionKey(direction),
        );
      });
    });
    return names;
  }, [requests]);
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
    setSelectedRequest(null);
    setSelectedClient(null);
    setError(null);
    form.resetFields();
    form.setFieldsValue({ tourists: 1, desired_direction: [] });
    setModalOpen(true);
  }

  async function openEditModal(request: RequestRecord) {
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
    const client =
      clients.find((item) => item.id === request.client_id) ?? {
        id: request.client_id,
        last_name: request.client_name.split(' ')[0] ?? '',
        first_name: request.client_name.split(' ')[1] ?? '',
        father_name: request.client_name.split(' ').slice(2).join(' ') || null,
        passport_number: null,
        birth_date: null,
        foreign_passport_number: null,
        latin_first_name: null,
        latin_last_name: null,
        foreign_passport_expire_date: null,
        phone: request.client_phone,
        email: '',
      };
    setSelectedRequest(request);
    setSelectedClient(client);
    setError(null);
    form.setFieldsValue({
      client_id: request.client_id,
      departure_city_id: request.departure_city_id,
      desired_direction: request.desired_direction.map(requestDirectionKey),
      desired_range:
        request.desired_start_date && request.desired_end_date
          ? [dayjs(request.desired_start_date), dayjs(request.desired_end_date)]
          : null,
      night_range:
        request.min_nights !== null && request.max_nights !== null
          ? [request.min_nights, request.max_nights]
          : null,
      tourists: request.tourists,
      min_budget: request.min_budget === null
        ? null
        : String(request.min_budget).replace('.', ','),
      max_budget: request.max_budget === null
        ? null
        : String(request.max_budget).replace('.', ','),
      wishes: request.wishes,
      status: request.status,
    });
    setModalOpen(true);
  }

  async function saveRequest(values: RequestFormValues) {
    setSaving(true);
    setError(null);
    const [desiredStart, desiredEnd] = values.desired_range ?? [];
    const [minNights, maxNights] = values.night_range ?? [];
    const directions = values.desired_direction.map((entry) => {
      const [kind, id] = entry.split(':');
      return { kind, id: Number(id) };
    });
    const payload = {
      client_id: values.client_id,
      departure_city_id: values.departure_city_id,
      desired_direction: directions,
      desired_start_date: desiredStart?.format('YYYY-MM-DD') ?? null,
      desired_end_date: desiredEnd?.format('YYYY-MM-DD') ?? null,
      min_nights: minNights ?? null,
      max_nights: maxNights ?? null,
      tourists: values.tourists,
      min_budget: parseBudgetInput(values.min_budget),
      max_budget: parseBudgetInput(values.max_budget),
      wishes: values.wishes?.trim() || null,
      ...(selectedRequest ? { status: values.status } : {}),
    };
    try {
      const response = await apiFetch(
        selectedRequest
          ? `/api/requests/${selectedRequest.id}`
          : '/api/requests/',
        {
          method: selectedRequest ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        throw await getApiError(
          response,
          `Не удалось ${selectedRequest ? 'обновить' : 'создать'} заявку`,
        );
      }
      setModalOpen(false);
      setReloadKey((key) => key + 1);
      messageApi.success(selectedRequest ? 'Заявка обновлена' : 'Заявка создана');
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Не удалось сохранить заявку',
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveNewClient(values: ClientFormValues) {
    setSaving(true);
    try {
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
      const response = await apiFetch('/api/clients/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw await getApiError(response, 'Не удалось создать клиента');
      const clientData: unknown = await response.json();
      if (!isClientRecord(clientData)) {
        throw new Error('Сервер вернул данные клиента в неожиданном формате');
      }
      setClients((current) => [...current, clientData]);
      setSelectedClient(clientData);
      form.setFields([{ name: 'client_id', value: clientData.id, errors: [] }]);
      setClientModalOpen(false);
      clientForm.resetFields();
      messageApi.success('Клиент создан и выбран для заявки');
    } catch (saveError) {
      messageApi.error(
        saveError instanceof Error ? saveError.message : 'Не удалось создать клиента',
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteRequest(request: RequestRecord) {
    setError(null);
    try {
      const response = await apiFetch(`/api/requests/${request.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw await getApiError(response, 'Не удалось удалить заявку');
      setReloadKey((key) => key + 1);
      messageApi.success('Заявка удалена');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Не удалось удалить заявку',
      );
    }
  }

  const columns: ColumnsType<RequestRecord> = [
    {
      title: 'Клиент',
      key: 'client',
      width: 220,
      render: (_, request) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{request.client_name}</Typography.Text>
          <Typography.Text type="secondary">{request.client_phone}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Направление',
      dataIndex: 'desired_direction',
      key: 'desired_direction',
      width: 240,
      render: (directions: Direction[]) => (
        <Space wrap>
          {directions.map((direction) => {
            const key = requestDirectionKey(direction);
            return <Tag key={key}>{directionNames.get(key) ?? key}</Tag>;
          })}
        </Space>
      ),
    },
    {
      title: 'Даты вылета',
      key: 'period',
      width: 180,
      render: (_, request) => formatPeriod(request),
    },
    {
      title: 'Количество ночей',
      key: 'nights',
      width: 170,
      render: (_, request) => formatNights(request.min_nights, request.max_nights),
    },
    {
      title: 'Количество туристов',
      dataIndex: 'tourists',
      key: 'tourists',
      width: 150,
    },
    {
      title: 'Город вылета',
      dataIndex: 'departure_city',
      key: 'departure_city',
      width: 150,
    },
    {
      title: 'Бюджет',
      key: 'budget',
      width: 180,
      render: (_, request) => formatBudget(request.min_budget, request.max_budget),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (statusValue: RequestStatus) => (
        <Tag color={statusValue === 'Новая' ? 'blue' : undefined}>{statusValue}</Tag>
      ),
    },
    { title: 'Сотрудник', dataIndex: 'employee_name', key: 'employee_name', width: 180 },
    {
      title: 'Действия',
      key: 'actions',
      width: 110,
      fixed: 'right',
      render: (_, request) => (
        <Space>
          <Button
            aria-label={`Редактировать заявку ${request.id}`}
            icon={<EditOutlined />}
            onClick={() => openEditModal(request)}
          />
          <Popconfirm
            title="Удалить заявку?"
            description={request.client_name}
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => deleteRequest(request)}
          >
            <Button
              aria-label={`Удалить заявку ${request.id}`}
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
          Заявки клиентов
        </Typography.Title>
        <Typography.Text type="secondary">
          Пожелания клиентов по будущим поездкам
        </Typography.Text>
      </div>
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
        Добавить заявку
      </Button>
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={
            <Button icon={<ReloadOutlined />} onClick={() => setReloadKey((key) => key + 1)}>
              Повторить
            </Button>
          }
        />
      )}
      <Table<RequestRecord>
        columns={columns}
        dataSource={requests}
        rowKey="id"
        loading={loading}
        tableLayout="fixed"
        locale={{
          emptyText: error ? 'Не удалось загрузить данные' : 'Заявки не найдены',
        }}
        scroll={{ x: 1400 }}
      />
      <Modal
        title={selectedRequest ? 'Редактировать заявку' : 'Новая заявка'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={saving}
        width={900}
        destroyOnHidden
      >
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
        <Form<RequestFormValues>
          form={form}
          layout="vertical"
          validateTrigger="onBlur"
          onFinish={saveRequest}
          style={{ width: '100%' }}
        >
          <Form.Item
            name="client_id"
            label="Клиент"
            validateTrigger="onChange"
            rules={[{ required: true, message: 'Выберите клиента' }]}
          >
            <ClientAutocomplete
              selectedClient={selectedClient}
              onClientSelected={(client) => {
                setSelectedClient(client);
                if (client) {
                  form.setFields([{ name: 'client_id', value: client.id, errors: [] }]);
                }
              }}
              onAddClient={() => {
                clientForm.resetFields();
                setClientModalOpen(true);
              }}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="departure_city_id"
                label="Город вылета"
                rules={[{ required: true, message: 'Выберите город вылета' }]}
              >
                <DepartureCityAutocomplete departureCities={departureCities} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="desired_direction"
                label="Направление"
                rules={[
                  {
                    validator: (_, value: string[] | undefined) =>
                      value?.length
                        ? Promise.resolve()
                        : Promise.reject(new Error('Выберите хотя бы одно направление')),
                  },
                ]}
              >
                <DirectionAutocomplete directionNames={directionNames} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="desired_range" label="Даты вылета">
                <PeriodPicker />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="night_range" label="Количество ночей">
                <NightsPicker />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="tourists"
                label="Количество туристов"
                rules={[
                  { required: true, message: 'Укажите количество туристов' },
                  {
                    type: 'number',
                    min: 1,
                    max: 9,
                    message: 'Количество туристов должно быть от 1 до 9',
                  },
                ]}
              >
                <InputNumber min={1} max={9} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="min_budget"
                label="Бюджет, от"
                validateTrigger="onBlur"
                rules={[
                  {
                    validator: (_, value: string | null | undefined) => {
                      const budget = parseBudgetInput(value);
                      const max = parseBudgetInput(
                        form.getFieldValue('max_budget') as string | null | undefined,
                      );
                      if (budget === null) return Promise.resolve();
                      if (budget < 0 || budget > MAX_REQUEST_BUDGET) {
                        return Promise.reject(new Error('Бюджет должен быть от 0 до 9 999 999 999,99 ₽'));
                      }
                      return max === null || budget <= max
                        ? Promise.resolve()
                        : Promise.reject(new Error('Минимальный бюджет не может быть больше максимального'));
                    },
                  },
                ]}
              >
                <CurrencyInput placeholder="От" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="max_budget"
                label="до"
                validateTrigger="onBlur"
                rules={[
                  {
                    validator: (_, value: string | null | undefined) => {
                      const budget = parseBudgetInput(value);
                      const min = parseBudgetInput(
                        form.getFieldValue('min_budget') as string | null | undefined,
                      );
                      if (budget === null) return Promise.resolve();
                      if (budget < 0 || budget > MAX_REQUEST_BUDGET) {
                        return Promise.reject(new Error('Бюджет должен быть от 0 до 9 999 999 999,99 ₽'));
                      }
                      return min === null || min <= budget
                        ? Promise.resolve()
                        : Promise.reject(new Error('Максимальный бюджет не может быть меньше минимального'));
                    },
                  },
                ]}
              >
                <CurrencyInput placeholder="До" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="wishes" label="Пожелания">
            <Input.TextArea rows={4} maxLength={5000} showCount />
          </Form.Item>
          {selectedRequest && (
            <Form.Item
              name="status"
              label="Статус"
              rules={[{ required: true, message: 'Выберите статус заявки' }]}
            >
              <Select options={REQUEST_STATUSES.map((statusValue) => ({
                value: statusValue,
                label: statusValue,
              }))} />
            </Form.Item>
          )}
        </Form>
      </Modal>
      <Modal
        title="Новый клиент"
        open={clientModalOpen}
        onCancel={() => setClientModalOpen(false)}
        onOk={() => clientForm.submit()}
        okText="Создать клиента"
        cancelText="Отмена"
        confirmLoading={saving}
        width={700}
        destroyOnHidden
      >
        <ClientForm form={clientForm} onFinish={saveNewClient} />
      </Modal>
    </Space>
  );
}

export default RequestsPage;
