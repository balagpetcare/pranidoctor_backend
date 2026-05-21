/** Minimal RFC 4180-style CSV parser (handles quoted fields). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;

  const pushCell = () => {
    row.push(cur);
    cur = "";
  };

  const pushRow = () => {
    if (row.length === 1 && row[0] === "") return;
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      pushCell();
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      pushCell();
      pushRow();
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  pushCell();
  if (row.length > 0) pushRow();
  return rows;
}
