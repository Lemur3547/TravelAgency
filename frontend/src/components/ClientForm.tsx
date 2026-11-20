import { useLayoutEffect, useRef, useState } from 'react';
import {
  Collapse,
  Col,
  DatePicker,
  Form,
  Input,
  Row,
  Typography,
} from 'antd';
import type { FormInstance } from 'antd';
import type { InputRef } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { PhoneInput } from './PhoneInput';
import { formatDocumentNumber } from '../utils/document';
import { isValidPhone } from '../utils/phone';

export interface ClientFormValues {
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

function ClientDatePicker({
  value,
  onChange,
  disabledDate,
  minDate,
  maxDate,
  warnIfExpiring,
}: {
  value?: string | null;
  onChange?: (value: string | null) => void;
  disabledDate?: (date: Dayjs) => boolean;
  minDate?: Dayjs;
  maxDate?: Dayjs;
  warnIfExpiring?: boolean;
}) {
  const selectedDate = value ? dayjs(value) : null;
  const showExpiryWarning =
    warnIfExpiring &&
    selectedDate &&
    !selectedDate.isBefore(dayjs().startOf('day'), 'day') &&
    selectedDate.isBefore(dayjs().startOf('day').add(6, 'month'), 'day');

  return (
    <div>
      <DatePicker
        format="DD.MM.YYYY"
        placeholder="Выберите дату"
        style={{ width: '100%' }}
        value={value ? dayjs(value) : null}
        disabledDate={disabledDate}
        minDate={minDate}
        maxDate={maxDate}
        onChange={(date: Dayjs | null) => onChange?.(date?.format('YYYY-MM-DD') ?? null)}
      />
      {showExpiryWarning && (
        <Typography.Text type="warning">Срок действия скоро истечет</Typography.Text>
      )}
    </div>
  );
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
          updateDigits(
            digits.slice(0, seriesLength - 1) + digits.slice(seriesLength),
            seriesLength - 1,
          );
        } else if (
          event.key === 'Delete' &&
          input.selectionStart === seriesLength &&
          digits.length > seriesLength
        ) {
          event.preventDefault();
          updateDigits(
            digits.slice(0, seriesLength) + digits.slice(seriesLength + 1),
            seriesLength,
          );
        }
      }}
    />
  );
}

export function ClientForm({
  form,
  onFinish,
}: {
  form: FormInstance<ClientFormValues>;
  onFinish: (values: ClientFormValues) => void;
}) {
  const [expandedPanels, setExpandedPanels] = useState<string[]>([]);
  const today = dayjs().startOf('day');
  const earliestBirthDate = today.subtract(100, 'year');
  const earliestPassportExpiry = today.subtract(10, 'year');
  const latestPassportExpiry = today.add(10, 'year');

  function revealInvalidDocumentFields({
    errorFields,
  }: {
    errorFields: Array<{ name: (string | number)[] }>;
  }) {
    const invalidFields = new Set(errorFields.map(({ name }) => name[0]));
    const panelsToOpen = new Set(expandedPanels);
    if (['passport_number', 'birth_date'].some((field) => invalidFields.has(field))) {
      panelsToOpen.add('passport');
    }
    if (
      [
        'latin_first_name',
        'latin_last_name',
        'foreign_passport_number',
        'foreign_passport_expire_date',
      ].some((field) => invalidFields.has(field))
    ) {
      panelsToOpen.add('foreign-passport');
    }
    setExpandedPanels([...panelsToOpen]);
  }

  return (
    <Form<ClientFormValues>
      form={form}
      layout="vertical"
      validateTrigger="onBlur"
      onFinish={onFinish}
      onFinishFailed={revealInvalidDocumentFields}
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
                    : Promise.reject(new Error('Введите корректный номер телефона')),
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
          activeKey={expandedPanels}
          onChange={(keys) =>
            setExpandedPanels(Array.isArray(keys) ? keys.map(String) : [String(keys)])
          }
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: '0px' }}
          items={[
            {
              key: 'passport',
              label: 'Паспортные данные',
              forceRender: true,
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
                              : Promise.reject(new Error('Введите 10 цифр')),
                        },
                      ]}
                    >
                      <DocumentNumberInput seriesLength={4} totalLength={10} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="birth_date" label="Дата рождения">
                      <ClientDatePicker
                        minDate={earliestBirthDate}
                        maxDate={today}
                        disabledDate={(date) =>
                          date.isBefore(earliestBirthDate, 'day') ||
                          date.isAfter(today, 'day')
                        }
                      />
                    </Form.Item>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'foreign-passport',
              label: 'Загранпаспорт',
              forceRender: true,
              children: (
                <Row gutter={16}>
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
                      name="foreign_passport_number"
                      label="Серия и номер загранпаспорта"
                      rules={[
                        {
                          validator: (_, value: string | undefined) =>
                            !value || /^\d{9}$/.test(value)
                              ? Promise.resolve()
                              : Promise.reject(new Error('Введите 9 цифр')),
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
                      validateTrigger="onChange"
                      rules={[
                        {
                          validator: (_, value: string | null | undefined) =>
                            !value || !dayjs(value).isBefore(today, 'day')
                              ? Promise.resolve()
                              : Promise.reject(
                                  new Error('Срок действия загранпаспорта истек'),
                                ),
                        },
                      ]}
                    >
                      <ClientDatePicker
                        minDate={earliestPassportExpiry}
                        maxDate={latestPassportExpiry}
                        disabledDate={(date) =>
                          date.isBefore(earliestPassportExpiry, 'day') ||
                          date.isAfter(latestPassportExpiry, 'day')
                        }
                        warnIfExpiring
                      />
                    </Form.Item>
                  </Col>
                </Row>
              ),
            },
          ]}
        />
      </div>
    </Form>
  );
}
