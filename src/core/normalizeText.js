const NUMERAL_MAP = Object.freeze({
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
});

export function normalizeText(value = '') {
  return String(value)
    .normalize('NFKC')
    .replace(/[٠-٩۰-۹०-९]/gu, digit => NUMERAL_MAP[digit] ?? digit)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}:/.\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
