// Busca dos dados na planilha do Google, agora do lado do servidor.
//
// Rodando no servidor não existe restrição de CORS, então a ordem segue
// a confiabilidade das fontes: primeiro os links "Publicar na web" em
// CSV, depois o gviz do compartilhamento por link. O truque de JSONP do
// site original (tag <script>) era só para contornar CORS no navegador
// e deixou de ser necessário.

import { CONFIG } from './config.js';
import { parseCsvText, parseDateFlexible, coerceGeneric, coerceMoney, gvizDateToISO } from './parse.js';
import { buildData } from './build-data.js';

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`fetch falhou (${res.status}) em ${url.slice(0, 80)}…`);
  return res.text();
}

async function fetchCsvRows(url) {
  return parseCsvText(await fetchText(url));
}

export async function tryLiveDataCsv() {
  const [meuJogoRows, resultadoRowsRaw] = await Promise.all([
    fetchCsvRows(CONFIG.csvUrls.meuJogo),
    fetchCsvRows(CONFIG.csvUrls.resultados),
  ]);
  const meuJogoValues = (meuJogoRows[0] || []).map(coerceGeneric).filter(v => typeof v === 'number');
  const resultadoRows = resultadoRowsRaw.map(r => ([
    coerceGeneric(r[0]),
    parseDateFlexible(r[1]),
    r[2] ?? null,
    coerceGeneric(r[3]),
    r[4] ?? null,
    coerceMoney(r[5]),
    coerceMoney(r[6]),
    coerceGeneric(r[7]),
  ]));
  return buildData(meuJogoValues, resultadoRows);
}

async function fetchGvizRows(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?sheet=${encodeURIComponent(sheetName)}&tqx=out:json`;
  const text = await fetchText(url);
  const m = text.match(/setResponse\(([\s\S]*)\)\s*;?\s*$/);
  if (!m) throw new Error('resposta do gviz em formato inesperado');
  // Datas podem vir como new Date(...) (JS executável, não JSON válido);
  // converte para a forma string "Date(...)" que gvizDateToISO entende.
  const jsonText = m[1].replace(/new Date\(([^)]*)\)/g, '"Date($1)"');
  const json = JSON.parse(jsonText);
  if (!json || json.status === 'error') throw new Error('gviz retornou erro');
  return json.table.rows.map(row => row.c.map(cell => (cell ? (cell.v !== undefined ? cell.v : null) : null)));
}

export async function tryLiveDataGviz() {
  const [meuJogoRows, resultadoRowsRaw] = await Promise.all([
    fetchGvizRows('Meu Jogo'),
    fetchGvizRows('Resultados'),
  ]);
  const meuJogoValues = meuJogoRows[0] || [];
  const resultadoRows = resultadoRowsRaw.map(r => ([r[0], gvizDateToISO(r[1]), r[2], r[3], r[4], r[5], r[6], r[7]]));
  return buildData(meuJogoValues, resultadoRows);
}

// Tenta as fontes em ordem de confiabilidade; devolve também qual serviu.
export async function fetchSheetData() {
  const attempts = [];
  try {
    return { source: 'csv', data: await tryLiveDataCsv() };
  } catch (err) {
    attempts.push(`csv: ${err.message}`);
  }
  try {
    return { source: 'gviz', data: await tryLiveDataGviz() };
  } catch (err) {
    attempts.push(`gviz: ${err.message}`);
  }
  throw new Error('planilha indisponível — ' + attempts.join(' | '));
}
