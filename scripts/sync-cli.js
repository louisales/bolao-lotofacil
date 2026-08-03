// Roda uma sincronização manual pela linha de comando. Uso: npm run sync
import { openDb } from '../src/db.js';
import { runSync } from '../src/sync.js';

openDb();
const r = await runSync();
if (r.ok) {
  console.log(`Sincronizado com sucesso (fonte: ${r.source}).`);
  if (r.warnings.length) {
    console.log(`Avisos (${r.warnings.length}):`);
    for (const w of r.warnings) console.log('  -', w.msg);
  }
} else {
  console.error(`Sincronização falhou: ${r.error}`);
  process.exitCode = 1;
}
