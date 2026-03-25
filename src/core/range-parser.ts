/**
 * Parse a flexible range spec that supports:
 * - Single values: "5" or "A"
 * - Ranges: "2-10" or "A-C"
 * - Comma-separated: "2,5,8" or "A,C,E"
 * - Mixed: "2-5,8,10-12" or "A-C,E,G-J"
 *
 * Returns a Set of resolved values (numbers for rows, strings for columns).
 */

/**
 * Convert a column letter (A, B, ..., Z, AA, AB, ...) to a 0-based index.
 */
export function columnLetterToIndex(letter: string): number {
  const upper = letter.toUpperCase();
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1; // 0-based
}

/**
 * Convert a 0-based index to a column letter (A, B, ..., Z, AA, AB, ...).
 */
export function indexToColumnLetter(index: number): string {
  let result = "";
  let n = index + 1;
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

/**
 * Parse a row spec like "2-5,8,10-12" into a Set of sheet row numbers.
 */
export function parseRowSpec(spec: string): Set<number> {
  const result = new Set<number>();
  for (const part of spec.split(",")) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-");
      const start = parseInt(startStr!, 10);
      const end = parseInt(endStr!, 10);
      if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
        throw new Error(
          `Invalid row range "${trimmed}". Start must be <= end.`,
        );
      }
      for (let i = start; i <= end; i++) {
        result.add(i);
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (Number.isNaN(num)) {
        throw new Error(`Invalid row number "${trimmed}".`);
      }
      result.add(num);
    }
  }
  return result;
}

/**
 * Parse a column spec like "A-C,E,G-J" into a Set of column letters.
 */
export function parseColumnSpec(spec: string): Set<string> {
  const result = new Set<string>();
  for (const part of spec.split(",")) {
    const trimmed = part.trim().toUpperCase();
    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-");
      const startIdx = columnLetterToIndex(startStr!.trim());
      const endIdx = columnLetterToIndex(endStr!.trim());
      if (startIdx > endIdx) {
        throw new Error(
          `Invalid column range "${trimmed}". Start must be <= end.`,
        );
      }
      for (let i = startIdx; i <= endIdx; i++) {
        result.add(indexToColumnLetter(i));
      }
    } else {
      result.add(trimmed);
    }
  }
  return result;
}
