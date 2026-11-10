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

export function formatPhone(value: string): string {
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

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  const isNationalNumberValid = (number: string) => /^[3-9]\d{9}$/.test(number);

  if (digits.length !== 11) return false;
  if (value.trimStart().startsWith('8')) {
    return digits.startsWith('8') && isNationalNumberValid(digits.slice(1));
  }
  return digits.startsWith('7') && isNationalNumberValid(digits.slice(1));
}
