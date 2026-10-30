export type CsvTable = { headers: string[]; rows: string[][] };

/** Parse a small CSV. Quoted fields may contain commas and doubled quotes. */
export function parseCsv(input: string): { ok: true; table: CsvTable } | { ok: false; error: string } {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return { ok: false, error: "The CSV is empty." };
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field.trim());
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field.trim());
      records.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  if (inQuotes) return { ok: false, error: "A quoted field was not closed." };
  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) records.push(row);
  const [headers, ...rows] = records;
  if (!headers || headers.every((header) => header.length === 0)) {
    return { ok: false, error: "The CSV needs a header row." };
  }
  if (headers.length > 40) return { ok: false, error: "Too many columns." };
  if (rows.length > 2000) return { ok: false, error: "CSV imports are limited to 2000 rows." };
  return { ok: true, table: { headers, rows } };
}
