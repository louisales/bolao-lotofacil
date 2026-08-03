// Reimporta data/seed.json (o retrato que vinha embutido no HTML
// original) por cima do que estiver no banco. Uso: npm run seed
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { openDb, replaceData, recordSync } from '../src/db.js';

openDb();
const data = JSON.parse(readFileSync(CONFIG.seedPath, 'utf8'));
replaceData(data);
recordSync({ source: 'seed', ok: true });
console.log(`Seed importado: ${data.meuJogo.length} dezenas, ${data.cycles.length} ciclos, ${data.cycles.reduce((n, c) => n + c.draws.length, 0)} sorteios.`);
