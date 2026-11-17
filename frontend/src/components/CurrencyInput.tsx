import { useRef } from 'react';
import { Input } from 'antd';
import type { InputProps, InputRef } from 'antd/es/input';

interface CurrencyInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  value?: string | number | null;
  onChange?: (value: string) => void;
}

function sanitizeCurrencyInput(value: string): string {
  const sanitized = value.replace(/[^\d.,]/g, '');
  const separatorIndex = sanitized.search(/[.,]/);
  const integerPart = (separatorIndex === -1
    ? sanitized
    : sanitized.slice(0, separatorIndex)
  ).replace(/\D/g, '');

  if (separatorIndex === -1) return integerPart;

  const fractionalPart = sanitized
    .slice(separatorIndex + 1)
    .replace(/\D/g, '')
    .slice(0, 2);
  return `${integerPart},${fractionalPart}`;
}

function formatCurrencyInput(value: string): string {
  const [integerPart, fractionalPart] = value.split(',');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return fractionalPart === undefined
    ? groupedInteger
    : `${groupedInteger},${fractionalPart}`;
}

function getCurrencyInputCaretPosition(value: string, characterCount: number): number {
  if (characterCount === 0) return 0;
  let seen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/[\d,]/.test(value[index])) seen += 1;
    if (seen === characterCount) return index + 1;
  }
  return value.length;
}

export function CurrencyInput({
  value = '',
  onChange,
  ...inputProps
}: CurrencyInputProps) {
  const inputRef = useRef<InputRef>(null);
  const canonicalValue = sanitizeCurrencyInput(String(value ?? ''));
  const formattedValue = formatCurrencyInput(canonicalValue);

  return (
    <Input
      {...inputProps}
      ref={inputRef}
      value={formattedValue}
      inputMode="decimal"
      onChange={(event) => {
        const rawValue = event.target.value;
        const cursor = event.target.selectionStart ?? rawValue.length;
        const canonical = sanitizeCurrencyInput(rawValue);
        const typedCharacters = (rawValue.slice(0, cursor).match(/[\d,.]/g) ?? []).length;
        const canonicalCursor = Math.min(typedCharacters, canonical.length);
        const formattedCanonical = formatCurrencyInput(canonical);
        const caretPosition = getCurrencyInputCaretPosition(
          formattedCanonical,
          canonicalCursor,
        );
        onChange?.(canonical);
        requestAnimationFrame(() => {
          const input = inputRef.current?.input;
          input?.setSelectionRange(caretPosition, caretPosition);
        });
      }}
    />
  );
}
