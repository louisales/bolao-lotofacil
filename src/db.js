// Persistência em SQLite (node:sqlite, embutido no Node — sem dependência
// nativa). O banco guarda o mesmo modelo {meuJogo, cycles} do site
// original, normalizado em tabelas, mais um log de sincronizações.
//
// A planilha continua sendo a fonte da verdade editada pelo grupo; o
// banco é o retrato durável e validado dela — o site funciona mesmo com
// a planilha fora do ar, e nada mais depende de snapshot embutido em HTML.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { CONFIG } from './config.js';

let db;

export function openDb() {
  if (db) return db;
  mkdirSync(dirname(CONFIG.dbPath), { recursive: true });
  db = new DatabaseSync(CONFIG.dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      position INTEGER NOT NULL,
      label TEXT,
      total_premiacao REAL,
      em_andamento INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS draws (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      concurso INTEGER NOT NULL,
      data TEXT,
      numeros_sorteados TEXT NOT NULL,
      acertos INTEGER,
      numeros_acertados TEXT NOT NULL,
      status TEXT NOT NULL,
      valor_acerto REAL,
      premiacao REAL,
      sorteio_no_ciclo INTEGER
    );
    CREATE TABLE IF NOT EXISTS syncs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      source TEXT,
      ok INTEGER NOT NULL,
      warnings TEXT,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS oficial (
      concurso INTEGER PRIMARY KEY,
      data TEXT,
      dezenas TEXT NOT NULL,
      rateio TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
  `);
  try { db.exec('ALTER TABLE draws ADD COLUMN fonte TEXT'); } catch { /* coluna já existe */ }
  return db;
}

// Cache permanente dos resultados oficiais da Caixa (não mudam nunca).
export function getOficial(concurso) {
  const r = openDb().prepare('SELECT * FROM oficial WHERE concurso = ?').get(concurso);
  return r ? { concurso: r.concurso, data: r.data, dezenas: JSON.parse(r.dezenas), rateio: JSON.parse(r.rateio) } : null;
}

export function saveOficial(of) {
  openDb().prepare('INSERT OR REPLACE INTO oficial (concurso, data, dezenas, rateio, fetched_at) VALUES (?, ?, ?, ?, ?)')
    .run(of.concurso, of.data || null, JSON.stringify(of.dezenas), JSON.stringify(of.rateio), new Date().toISOString());
}

export function hasData() {
  const row = openDb().prepare('SELECT COUNT(*) AS n FROM cycles').get();
  return row.n > 0;
}

// Substitui todo o conteúdo pelo retrato mais novo, numa transação: ou
// grava tudo, ou nada muda. A planilha inteira é pequena (poucas centenas
// de linhas), então o full-replace é mais simples e à prova de deriva.
export function replaceData(data) {
  const d = openDb();
  d.exec('BEGIN');
  try {
    d.exec('DELETE FROM draws; DELETE FROM cycles;');
    d.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('meuJogo', JSON.stringify(data.meuJogo));

    const insCycle = d.prepare('INSERT INTO cycles (position, label, total_premiacao, em_andamento) VALUES (?, ?, ?, ?)');
    const insDraw = d.prepare(`INSERT INTO draws
      (cycle_id, position, concurso, data, numeros_sorteados, acertos, numeros_acertados, status, valor_acerto, premiacao, sorteio_no_ciclo, fonte)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    data.cycles.forEach((cycle, ci) => {
      const { lastInsertRowid } = insCycle.run(ci, cycle.label ?? null, cycle.totalPremiacao ?? null, cycle.emAndamento ? 1 : 0);
      cycle.draws.forEach((dr, di) => {
        insDraw.run(
          lastInsertRowid, di, dr.concurso, dr.data || null,
          JSON.stringify(dr.numerosSorteados), dr.acertos ?? null,
          JSON.stringify(dr.numerosAcertados), dr.status,
          dr.valorAcerto ?? null, dr.premiacao ?? null, dr.sorteioNoCiclo ?? null,
          dr.fonte ?? null,
        );
      });
    });
    d.exec('COMMIT');
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}

// Devolve o mesmo shape {meuJogo, cycles} que o site original usava.
export function getData() {
  const d = openDb();
  const metaRow = d.prepare('SELECT value FROM meta WHERE key = ?').get('meuJogo');
  const meuJogo = metaRow ? JSON.parse(metaRow.value) : [];

  const cycles = d.prepare('SELECT * FROM cycles ORDER BY position').all().map(c => ({
    label: c.label,
    totalPremiacao: c.total_premiacao,
    ...(c.em_andamento ? { emAndamento: true } : {}),
    draws: d.prepare('SELECT * FROM draws WHERE cycle_id = ? ORDER BY position').all(c.id).map(r => ({
      concurso: r.concurso,
      data: r.data || '',
      numerosSorteados: JSON.parse(r.numeros_sorteados),
      acertos: r.acertos,
      numerosAcertados: JSON.parse(r.numeros_acertados),
      status: r.status,
      valorAcerto: r.valor_acerto,
      premiacao: r.premiacao,
      sorteioNoCiclo: r.sorteio_no_ciclo,
      ...(r.fonte ? { fonte: r.fonte } : {}),
    })),
  }));

  return { meuJogo, cycles };
}

export function recordSync({ source, ok, warnings = [], error = null }) {
  openDb().prepare('INSERT INTO syncs (at, source, ok, warnings, error) VALUES (?, ?, ?, ?, ?)')
    .run(new Date().toISOString(), source, ok ? 1 : 0, JSON.stringify(warnings), error);
}

export function lastSync() {
  const row = openDb().prepare('SELECT * FROM syncs ORDER BY id DESC LIMIT 1').get();
  return row ? { ...row, ok: !!row.ok, warnings: JSON.parse(row.warnings || '[]') } : null;
}

export function lastGoodSync() {
  const row = openDb().prepare('SELECT * FROM syncs WHERE ok = 1 ORDER BY id DESC LIMIT 1').get();
  return row ? { ...row, ok: true, warnings: JSON.parse(row.warnings || '[]') } : null;
}
