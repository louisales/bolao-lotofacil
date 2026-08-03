// Configuração da sincronização com a planilha do bolão.
//
// O servidor tenta, nesta ordem, buscar os dados direto da planilha:
//   1) Os dois links de "Publicar na web" (csvUrls) — é o modo mais
//      confiável, pois não depende do compartilhamento normal.
//   2) Se falharem, tenta pelo compartilhamento "Qualquer pessoa com o
//      link" (gviz).
//   3) Se nada funcionar, o banco local continua servindo os últimos
//      dados válidos, sem quebrar o site.
// Para atualizar os links (ex.: se a planilha for recriada), gere-os em
// Arquivo > Compartilhar > Publicar na Web, escolhendo a aba e o
// formato CSV, e cole aqui.
export const CONFIG = {
  sheetId: '18DuAPox1OXP2Q1MrPnrhqH56rGD-B6SDg8LYFpWuYQs',
  csvUrls: {
    meuJogo: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSN86bjSYjbjVgkU9Z51qLAt_knAXHfML2O_jox0rRbypSAqYgFKda6ICORwDdQgoL4W-Ng4cpWeYfy/pub?gid=0&single=true&output=csv',
    resultados: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSN86bjSYjbjVgkU9Z51qLAt_knAXHfML2O_jox0rRbypSAqYgFKda6ICORwDdQgoL4W-Ng4cpWeYfy/pub?gid=919473653&single=true&output=csv',
  },
  port: Number(process.env.PORT) || 3033,
  dbPath: new URL('../data/bolao.db', import.meta.url).pathname,
  seedPath: new URL('../data/seed.json', import.meta.url).pathname,
  // Sincroniza sozinho a cada 30 min enquanto o servidor estiver no ar
  // (além da sincronização disparada a cada visita à página).
  syncIntervalMinutes: 30,
};
