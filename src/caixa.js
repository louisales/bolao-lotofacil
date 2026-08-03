// Resultados oficiais da Lotofácil, direto da API pública da Caixa (a
// mesma que alimenta loterias.caixa.gov.br). Cada concurso buscado fica
// cacheado no banco para sempre — resultado oficial não muda.
//
// Papel desta fonte: o site deixa de depender da atualização manual da
// planilha para RESULTADOS. O que continua vindo da planilha é a
// estrutura dos ciclos (quando o grupo começou uma teimosinha nova) e a
// premiação efetivamente recebida, quando registrada.
//
// Cruzamentos feitos aqui:
//   - dezenas/acertos da planilha × resultado oficial → divergência é
//     aviso "alerta" (fato conferível) e o dado oficial prevalece;
//   - premiação da planilha × premiação calculada da aposta de 16
//     dezenas → divergência é aviso "info" (o grupo não anota prêmios
//     pequenos, então isso é informativo, não erro);
//   - sorteios que a planilha ainda não tem são preenchidos/apensados
//     com o resultado oficial (fonte 'caixa').

import { parseDateFlexible } from './parse.js';
import { getOficial, saveOficial } from './db.js';

const API = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/';

async function fetchOficialApi(concurso) {
  const res = await fetch(API + (concurso ?? ''), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`API da Caixa devolveu ${res.status}`);
  const j = await res.json();
  const rateio = {};
  for (const r of j.listaRateioPremio || []) {
    const m = String(r.descricaoFaixa || '').match(/(\d+)\s*acertos/);
    if (m) rateio[Number(m[1])] = Number(r.valorPremio) || 0;
  }
  return {
    concurso: Number(j.numero),
    data: parseDateFlexible(j.dataApuracao),
    dezenas: (j.listaDezenas || []).map(Number),
    rateio,
  };
}

// Prêmio de uma aposta de 16 dezenas com k acertos: ela equivale a 16
// jogos de 15 (cada um deixa uma dezena de fora). Deixando de fora uma
// dezena errada (16-k opções) o jogo mantém os k acertos; deixando de
// fora uma certa (k opções) fica com k-1. Só faixas de 11+ pagam.
export function computePremio16(k, rateio) {
  const tier = h => (h >= 11 && h <= 15 ? (rateio[h] || 0) : 0);
  return Math.round(((16 - k) * tier(k) + k * tier(k - 1)) * 100) / 100;
}

function cycleRange(cycle) {
  const m = String(cycle.label || '').match(/(\d+)\s+a\s+(\d+)/);
  if (m) return { start: Number(m[1]), end: Number(m[2]) };
  const first = cycle.draws.find(d => d.status !== 'sem_jogo');
  if (!first) return null;
  return { start: first.concurso, end: first.concurso + 23 };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getOrFetch(concurso, avisos) {
  const cached = getOficial(concurso);
  if (cached) return { of: cached, fetched: false };
  try {
    const of = await fetchOficialApi(concurso);
    saveOficial(of);
    await sleep(150);
    return { of, fetched: true };
  } catch (err) {
    avisos.push({ concurso, nivel: 'info', msg: `concurso ${concurso}: resultado oficial indisponível (${err.message})` });
    return { of: null, fetched: false };
  }
}

// Enriquece {meuJogo, cycles} com os resultados oficiais. Modifica e
// devolve o próprio data; avisos saem junto. maxFetches limita quantos
// concursos novos são buscados por sincronização (o cache do banco faz
// o histórico completar ao longo de poucas rodadas).
export async function enrichWithOficial(data, { maxFetches = 25 } = {}) {
  const avisos = [];
  const meuJogoSet = new Set(data.meuJogo);
  if (meuJogoSet.size !== 16 || !data.cycles.length) return { avisos, buscados: 0 };

  let latest = null;
  try {
    latest = await fetchOficialApi();
    saveOficial(latest);
  } catch (err) {
    avisos.push({ nivel: 'info', msg: `API da Caixa indisponível, seguindo só com a planilha (${err.message})` });
    return { avisos, buscados: 0 };
  }

  const cicloAtual = data.cycles[data.cycles.length - 1];
  const range = cycleRange(cicloAtual);

  // Concursos que interessam: os já lançados nos ciclos (cross-check,
  // priorizando os mais recentes) e a cauda do ciclo atual que a
  // planilha ainda não tem (prioridade máxima — é o que atualiza o site
  // sem depender de ninguém editar a planilha).
  const daPlanilha = [];
  for (const cycle of data.cycles) {
    for (const d of cycle.draws) if (d.status !== 'sem_jogo') daPlanilha.push(d.concurso);
  }
  const ultimoNaPlanilha = cicloAtual.draws.length ? Math.max(...cicloAtual.draws.map(d => d.concurso)) : (range ? range.start - 1 : 0);
  const cauda = [];
  if (range) {
    for (let n = ultimoNaPlanilha + 1; n <= Math.min(range.end, latest.concurso); n++) cauda.push(n);
  }
  const ordem = [...cauda, ...daPlanilha.reverse()];

  let buscados = 0;
  const oficiais = new Map();
  for (const n of ordem) {
    if (oficiais.has(n)) continue;
    const cached = getOficial(n);
    if (cached) { oficiais.set(n, cached); continue; }
    if (buscados >= maxFetches) continue;
    const { of, fetched } = await getOrFetch(n, avisos);
    if (fetched) buscados++;
    if (of) oficiais.set(n, of);
  }

  const cruza = dezenas => dezenas.filter(n => meuJogoSet.has(n));

  // Cross-check e preenchimento dos sorteios que a planilha já tem.
  for (const cycle of data.cycles) {
    // Mediana dos concursos do ciclo: se um concurso está a mais de 100
    // dela, é quase certo erro de digitação na planilha (ex.: "2614" no
    // meio do ciclo 3600–3623, querendo dizer 3614). Nesse caso o
    // resultado oficial buscado seria de um sorteio antigo sem relação —
    // então só avisa, sem aplicar nada.
    const nums = cycle.draws.map(d => d.concurso).sort((a, b) => a - b);
    const mediana = nums.length ? nums[Math.floor(nums.length / 2)] : 0;
    for (const d of cycle.draws) {
      if (d.status === 'sem_jogo') continue;
      if (mediana && Math.abs(d.concurso - mediana) > 100) {
        avisos.push({ concurso: d.concurso, nivel: 'alerta', msg: `concurso ${d.concurso} parece digitado errado na planilha (o ciclo é dos concursos ~${mediana}); confira e corrija lá` });
        continue;
      }
      const of = oficiais.get(d.concurso);
      if (!of) continue;

      const oficialStr = of.dezenas.join(',');
      const planilhaStr = d.numerosSorteados.slice().sort((a, b) => a - b).join(',');
      if (d.numerosSorteados.length && planilhaStr !== oficialStr) {
        avisos.push({ concurso: d.concurso, nivel: 'alerta', msg: `concurso ${d.concurso}: números da planilha divergem do resultado oficial da Caixa (usando o oficial)` });
      }
      d.numerosSorteados = of.dezenas.slice();
      const acertados = cruza(of.dezenas);
      if (d.acertos !== null && d.acertos !== acertados.length) {
        avisos.push({ concurso: d.concurso, nivel: 'alerta', msg: `concurso ${d.concurso}: planilha diz ${d.acertos} acertos, resultado oficial dá ${acertados.length} (usando o oficial)` });
      }
      d.acertos = acertados.length;
      d.numerosAcertados = acertados;
      if (!d.data && of.data) d.data = of.data;

      const calculado = computePremio16(d.acertos, of.rateio);
      if (d.premiacao === null || d.premiacao === undefined) {
        d.premiacao = calculado || null;
        if (d.status === 'pendente') { d.status = 'ok'; d.fonte = 'caixa'; }
      } else if (Math.abs(d.premiacao - calculado) > 0.01) {
        avisos.push({ concurso: d.concurso, nivel: 'info', msg: `concurso ${d.concurso}: planilha registra R$ ${d.premiacao}, cálculo oficial da aposta dá R$ ${calculado}` });
      }
    }
  }

  // Apensa ao ciclo atual os concursos que a planilha ainda não tem.
  if (range) {
    let ultimoSorteioNo = Math.max(0, ...cicloAtual.draws.map(d => d.sorteioNoCiclo || 0));
    for (const n of cauda) {
      const of = oficiais.get(n);
      if (!of) break; // mantém a sequência contínua
      const acertados = cruza(of.dezenas);
      cicloAtual.draws.push({
        concurso: of.concurso,
        data: of.data,
        numerosSorteados: of.dezenas.slice(),
        acertos: acertados.length,
        numerosAcertados: acertados,
        status: 'ok',
        valorAcerto: null,
        premiacao: computePremio16(acertados.length, of.rateio) || null,
        sorteioNoCiclo: ++ultimoSorteioNo,
        fonte: 'caixa',
      });
    }
  }

  return { avisos, buscados };
}
