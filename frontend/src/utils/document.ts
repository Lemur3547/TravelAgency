export function formatDocumentNumber(
  value: string | null | undefined,
  seriesLength: number,
  totalLength: number,
): string {
  const digits = (value ?? '').replace(/\D/g, '').slice(0, totalLength);
  return digits.length >= seriesLength
    ? `${digits.slice(0, seriesLength)} ${digits.slice(seriesLength)}`
    : digits;
}
