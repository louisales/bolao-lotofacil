// Parsing helpers — portados sem alteração do site original
// (legacy/bolao-lotofacil.html).

export function parseNumeros(s) {
  if (s === null || s === undefined || s === '') return [];
  const fixed = String(s).replace(/\.\s*(?=\d)/g, ', ');
  return fixed.split(/[,\s]+/).map(x => x.trim()).filter(Boolean).map(Number).filter(n => !Number.isNaN(n));
}

export function gvizDateToISO(v) {
  if (typeof v === 'string' && v.startsWith('Date(')) {
    const m = v.match(/Date\((\d+),(\d+),(\d+)\)/);
    if (m) {
      const y = m[1], mo = String(Number(m[2]) + 1).padStart(2, '0'), d = String(m[3]).padStart(2, '0');
      return `${y}-${mo}-${d}`;
    }
  }
  return v || '';
}

// Parses dates coming from a CSV export, which follow the sheet's display
// locale rather than a fixed format. Handles ISO (yyyy-mm-dd) and the
// Brazilian dd/mm/yyyy pattern; falls back to the raw string otherwise.
export function parseDateFlexible(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return s;
}

// Minimal RFC4180-style CSV parser: handles quoted fields, embedded commas
// and escaped quotes ("") — Google's CSV export quotes any field
// containing a comma, which is exactly the "Números Sorteados" column.
export function parseCsvText(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ''));
}

// Valores monetários no CSV publicado vêm formatados pela exibição da
// planilha ("R$ 455,00", "R$ 1.234,56"); no gviz vêm como número puro.
// Sem este coerce, o caminho CSV perderia todas as premiações.
export function coerceMoney(v) {
  if (typeof v === 'string') {
    const m = v.trim().match(/^R\$\s*([\d.]+)(?:,(\d+))?$/);
    if (m) return Number(m[1].replace(/\./g, '') + (m[2] ? '.' + m[2] : ''));
  }
  return coerceGeneric(v);
}

export function coerceGeneric(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}
