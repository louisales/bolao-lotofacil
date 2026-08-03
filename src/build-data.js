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

  // Split trailing draws off the last cycle into the next cycle, once the
  // previous cycle already closed at 24. NOVO_CICLO_INICIO/LABEL are a
  // manual correction (informed by the user on 2026-07-11): the new ciclo
  // really started at concurso 3732 — draws before that in the gap had no
  // active ticket and stay attached to the previous cycle as "sem jogo".
  // Once the actual spreadsheet gets a proper "Concurso" header row for
  // the new cycle, this override stops being needed (the header takes
  // over automatically) and can be removed.
  const NOVO_CICLO_INICIO = 3732;
  const NOVO_CICLO_LABEL = '3732 a 3755';
  const last = rawCycles[rawCycles.length - 1];
  if (last && !last.label) {
    const explicit = last.draws.map(d => d.sorteioNoCiclo).filter(n => n !== null);
    if (explicit.length && Math.max(...explicit) >= 24) {
      const maxVal = Math.max(...explicit);
      let idx24 = -1;
      last.draws.forEach((d, i) => { if (d.sorteioNoCiclo === maxVal) idx24 = i; });
      const trailing = last.draws.slice(idx24 + 1);
      if (trailing.length) {
        last.draws = last.draws.slice(0, idx24 + 1);
        const gap = trailing.filter(d => d.concurso < NOVO_CICLO_INICIO);
        const novo = trailing.filter(d => d.concurso >= NOVO_CICLO_INICIO);
        for (const d of gap) { d.status = 'sem_jogo'; d.sorteioNoCiclo = null; d.valorAcerto = null; d.premiacao = null; }
        last.draws.push(...gap);
        if (novo.length) rawCycles.push({ label: NOVO_CICLO_LABEL, totalPremiacao: null, draws: novo, emAndamento: true });
      }
    }
  }

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
