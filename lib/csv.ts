// Minimal RFC 4180-ish CSV parser: handles quoted fields, escaped quotes ("")
// and commas/newlines inside quotes. Good enough for contact imports.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\r") {
      // skip, \n handles the row break
    } else if (char === "\n") {
      pushRow();
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ""));
}

export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}
