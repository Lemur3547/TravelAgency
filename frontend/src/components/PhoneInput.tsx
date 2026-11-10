import { useLayoutEffect, useRef } from 'react';
import { Input } from 'antd';
import type { InputRef } from 'antd';
import { formatPhone } from '../utils/phone';

export function PhoneInput({
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
      value={formatPhone(value)}
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
        const formattedValue = formatPhone(event.target.value);
        caretDigitCount.current = 1 + Math.min(nationalDigitsBeforeCursor, 10);
        onChange?.(formattedValue);
      }}
    />
  );
}
