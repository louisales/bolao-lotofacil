// Orquestra uma sincronização: planilha → regras de negócio →
// resultados oficiais da Caixa → validação → banco.
//
// A planilha dá a estrutura (ciclos, premiação registrada); a API da
// Caixa dá os resultados oficiais e preenche o que a planilha ainda não
// tem — o site se atualiza sozinho mesmo com a planilha parada. Se a
// planilha estiver fora do ar, parte-se dos dados já no banco e
// enriquece-se do mesmo jeito. Dado inutilizável → sincronização
// rejeitada, banco mantém os últimos dados válidos.

import { CONFIG } from './config.js';
import { fetchSheetData } from './sheets.js';
import { enrichWithOficial } from './caixa.js';
import { validateData } from './validate.js';
import { replaceData, recordSync, getData, hasData } from './db.js';

export async function runSync({ maxBuscasOficiais = CONFIG.maxBuscasOficiaisPorSync } = {}) {
  let source = null;
  let data = null;
  const warnings = [];

  try {
    const fetched = await fetchSheetData();
    source = fetched.source;
    data = fetched.data;
  } catch (err) {
    if (!hasData()) {
      recordSync({ source, ok: false, error: err.message });
      return { ok: false, source, warnings, error: err.message };
    }
    data = getData();
    source = 'banco';
    warnings.push({ nivel: 'info', msg: `planilha indisponível (${err.message}); partindo dos dados já no banco` });
  }

  try {
    if (CONFIG.usarResultadosOficiais) {
      const { avisos, buscados } = await enrichWithOficial(data, { maxFetches: maxBuscasOficiais });
      warnings.push(...avisos);
      if (buscados) source = source + '+caixa';
    }

    const { errors, warnings: valWarnings } = validateData(data);
    warnings.push(...valWarnings);
    if (errors.length) {
      const error = 'dados rejeitados: ' + errors.join('; ');
      recordSync({ source, ok: false, warnings, error });
      return { ok: false, source, warnings, error };
    }
    replaceData(data);
    recordSync({ source, ok: true, warnings });
    return { ok: true, source, warnings };
  } catch (err) {
    recordSync({ source, ok: false, error: err.message });
    return { ok: false, source, warnings, error: err.message };
  }
}
