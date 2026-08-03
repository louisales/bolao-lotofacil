// Orquestra uma sincronização: planilha → regras de negócio → validação
// → banco. Se a planilha estiver fora do ar ou o dado vier inutilizável,
// o banco mantém os últimos dados válidos e o erro fica registrado.

import { fetchSheetData } from './sheets.js';
import { validateData } from './validate.js';
import { replaceData, recordSync } from './db.js';

export async function runSync() {
  let source = null;
  try {
    const fetched = await fetchSheetData();
    source = fetched.source;
    const { errors, warnings } = validateData(fetched.data);
    if (errors.length) {
      const error = 'dados rejeitados: ' + errors.join('; ');
      recordSync({ source, ok: false, warnings, error });
      return { ok: false, source, warnings, error };
    }
    replaceData(fetched.data);
    recordSync({ source, ok: true, warnings });
    return { ok: true, source, warnings };
  } catch (err) {
    recordSync({ source, ok: false, error: err.message });
    return { ok: false, source, warnings: [], error: err.message };
  }
}
