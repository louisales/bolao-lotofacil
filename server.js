import express from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { CONFIG } from './src/config.js';
import { openDb, hasData, getData, replaceData, recordSync, lastSync, lastGoodSync } from './src/db.js';
import { runSync } from './src/sync.js';

openDb();

// Primeiro boot: se o banco está vazio, importa o retrato que vinha
// embutido no HTML original (data/seed.json), para o site nunca abrir
// em branco — mesmo sem internet.
if (!hasData() && existsSync(CONFIG.seedPath)) {
  replaceData(JSON.parse(readFileSync(CONFIG.seedPath, 'utf8')));
  recordSync({ source: 'seed', ok: true });
  console.log('Banco vazio — importado o retrato inicial de data/seed.json');
}

const app = express();
app.use(express.static(new URL('./public', import.meta.url).pathname));

app.get('/api/data', (req, res) => {
  res.json({ ...getData(), lastSync: lastSync(), lastGoodSync: lastGoodSync() });
});

app.post('/api/sync', async (req, res) => {
  res.json(await runSync());
});

app.listen(CONFIG.port, () => {
  console.log(`Bolão da Lotofácil no ar: http://localhost:${CONFIG.port}`);
});

// Sincroniza em segundo plano ao subir e depois em intervalo fixo; a
// página também dispara uma sincronização a cada visita.
runSync().then(r => console.log('Sincronização inicial:', r.ok ? `ok (${r.source})` : `falhou — ${r.error}`));
if (CONFIG.syncIntervalMinutes > 0) {
  setInterval(runSync, CONFIG.syncIntervalMinutes * 60 * 1000);
}
