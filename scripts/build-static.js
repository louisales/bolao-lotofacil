// Gera o site estático publicável em dist/: sincroniza (planilha +
// resultados oficiais da Caixa) e embute o resultado numa tag
// <script id="embedded-data"> dentro do HTML. O site publicado é só
// HTML+CSS+JS — não precisa de servidor nem de banco no ar.
//
// Roda tanto neste Mac (npm run build) quanto no GitHub Actions, que
// executa isto uma vez por dia e publica o dist/.
//
// Uso: npm run build

import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { openDb, hasData, getData, replaceData, recordSync, lastGoodSync, exportOficial, importOficial, countOficial } from '../src/db.js';
import { runSync } from '../src/sync.js';

const raiz = new URL('..', import.meta.url).pathname;
const dist = raiz + 'dist/';
const cacheOficial = raiz + 'data/oficial.json';

openDb();

// 1. Recupera o cache de resultados oficiais versionado no repositório.
if (countOficial() === 0 && existsSync(cacheOficial)) {
  const n = importOficial(JSON.parse(readFileSync(cacheOficial, 'utf8')));
  console.log(`Cache oficial recuperado: ${n} concursos.`);
}

// 2. Banco vazio (build limpo no CI): parte do retrato inicial.
if (!hasData() && existsSync(CONFIG.seedPath)) {
  replaceData(JSON.parse(readFileSync(CONFIG.seedPath, 'utf8')));
  recordSync({ source: 'seed', ok: true });
  console.log('Banco vazio — importado o retrato inicial de data/seed.json');
}

// 3. Sincroniza. Se falhar, o build segue com o que já existe: melhor
//    publicar dados de ontem do que derrubar o site do grupo.
const sync = await runSync({ maxBuscasOficiais: Infinity });
if (sync.ok) {
  console.log(`Sincronizado (fonte: ${sync.source}).`);
} else {
  console.warn(`Aviso: sincronização falhou (${sync.error}). Publicando os últimos dados válidos.`);
}
for (const w of sync.warnings) console.log(`  [${w.nivel ?? 'alerta'}] ${w.msg}`);

const data = getData();
if (!data.cycles.length) {
  console.error('Sem dados para publicar — build abortado.');
  process.exit(1);
}

// 4. Regrava o cache oficial para o Actions versionar de volta.
writeFileSync(cacheOficial, JSON.stringify(exportOficial(), null, 1) + '\n');

// 5. Monta o dist/.
const geradoEm = (lastGoodSync()?.at) || new Date().toISOString();
const payload = {
  meuJogo: data.meuJogo,
  cycles: data.cycles,
  geradoEm,
  warnings: sync.warnings,
};

let html = readFileSync(raiz + 'public/index.html', 'utf8');
const tag = `<script id="embedded-data" type="application/json">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>\n`;
html = html.replace('<script src="app.js"></script>', tag + '<script src="app.js"></script>');

mkdirSync(dist, { recursive: true });
writeFileSync(dist + 'index.html', html);
copyFileSync(raiz + 'public/style.css', dist + 'style.css');
copyFileSync(raiz + 'public/app.js', dist + 'app.js');

const sorteios = data.cycles.reduce((n, c) => n + c.draws.length, 0);
const atual = data.cycles[data.cycles.length - 1];
const progresso = Math.max(0, ...atual.draws.map(d => d.sorteioNoCiclo || 0));
console.log(`\ndist/ gerado: ${data.cycles.length} ciclos, ${sorteios} sorteios, ciclo atual em ${progresso}/24.`);
