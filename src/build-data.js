// Regras de negócio do bolão — portadas sem alteração do site original
// (legacy/bolao-lotofacil.html).

import { parseNumeros } from './parse.js';

// Builds the same {meuJogo, cycles} shape from raw row arrays (each row
// is an array of cell values in column order, with column b already a
// normalized "yyyy-mm-dd" string), mirroring the logic used to generate
// the embedded snapshot.
export function buildData(meuJogoValues, resultadoRows) {
  const meuJogo = meuJogoValues.filter(v => v !== null && v !== undefined && v !== '').map(Number);

  const rawCycles = [];
  let current = null;
  const seen = new Set();

  for (const r of resultadoRows) {
    const [a, b, c, d, e, f, g, h] = r;
    if (a === 'Concurso') {
      current = { label: f ?? null, totalPremiacao: (typeof g === 'number') ? g : null, draws: [] };
      rawCycles.push(current);
      continue;
    }
    if (a === null || a === undefined || a === '') continue;
    const concurso = Number(a);
    const dataStr = b || '';
    const key = concurso + '|' + dataStr;
    if (seen.has(key)) continue;
    seen.add(key);

    const numerosSorteados = parseNumeros(c);
    const acertos = (typeof d === 'number') ? d : null;
    const numerosAcertados = parseNumeros(e);

    const fIsSemJogo = typeof f === 'string' && f.toLowerCase().includes('sem jogo');
    const hIsSemJogo = typeof h === 'string' && h.toLowerCase().includes('sem jogo');
    const isSemJogo = fIsSemJogo || hIsSemJogo;
    const isPendente = !isSemJogo && (f === null || f === undefined) && (g === null || g === undefined);
    const status = isSemJogo ? 'sem_jogo' : (isPendente ? 'pendente' : 'ok');

    const valorAcerto = (status === 'ok' && typeof f === 'number') ? f : null;
    const premiacao = (status === 'ok' && typeof g === 'number') ? g : null;
    const sorteioNoCiclo = (typeof h === 'number') ? h : null;

    if (!current) { current = { label: null, totalPremiacao: null, draws: [] }; rawCycles.push(current); }

    current.draws.push({ concurso, data: dataStr, numerosSorteados, acertos, numerosAcertados, status, valorAcerto, premiacao, sorteioNoCiclo });
  }

  // Nota histórica: existia aqui uma correção manual que separava à mão o
  // ciclo iniciado no concurso 3732, porque a planilha ainda não tinha a
  // linha de cabeçalho "Concurso" dele. Em 2026-08-17 a planilha passou a
  // marcar todos os ciclos corretamente (inclusive o 3762), então a
  // correção foi removida: a linha de cabeçalho já faz esse trabalho.

  // Fill remaining gaps sequentially, skipping sem_jogo rows.
  for (const cycle of rawCycles) {
    let lastNum = 0;
    for (const d of cycle.draws) {
      if (d.sorteioNoCiclo !== null) lastNum = d.sorteioNoCiclo;
      else if (d.status !== 'sem_jogo') { lastNum += 1; d.sorteioNoCiclo = lastNum; }
    }
  }

  return { meuJogo, cycles: rawCycles };
}
