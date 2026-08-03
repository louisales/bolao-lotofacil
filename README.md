# Bolão da Lotofácil — Teimosinha

Site que acompanha o bolão da Lotofácil entre amigos (11 participantes,
modelo teimosinha: o mesmo jogo de 16 dezenas repetido por 24 sorteios).
Mostra acertos, prêmios, ciclos e avisa quando é hora de recolher o
dinheiro para a próxima teimosinha.

Evolução do site original de arquivo único (`legacy/bolao-lotofacil.html`)
para um projeto de código real, com persistência em banco de dados.

## Como rodar

```bash
npm install
npm start        # sobe em http://localhost:3033
```

Outros comandos:

```bash
npm run sync     # força uma sincronização com a planilha pela linha de comando
npm run seed     # reimporta o retrato inicial (data/seed.json) por cima do banco
```

Requer Node 22+ (usa o SQLite embutido do Node, `node:sqlite` — sem
dependência nativa).

## Arquitetura

O site tem duas fontes que se complementam:

```
Google Sheets ────┐
 (ciclos e        │
  premiação       ├──sincronização──▶ SQLite (data/bolao.db) ──API──▶ navegador
  registrada)     │    (validada)         (fonte durável)
API da Caixa ─────┘
 (resultados oficiais)
```

- **API oficial da Caixa** (`src/caixa.js`): busca cada resultado da
  Lotofácil direto da fonte (a mesma API de loterias.caixa.gov.br),
  cruza as dezenas com o jogo fixo do grupo e calcula acertos e a
  premiação da aposta de 16 dezenas (que equivale a 16 jogos de 15).
  Com isso o site se atualiza sozinho todo dia, mesmo que ninguém toque
  na planilha — os sorteios que ela ainda não tem entram com `fonte:
  caixa`. Resultado oficial diverge da planilha? O oficial prevalece e
  fica o aviso. Cada concurso buscado é cacheado para sempre no banco
  (resultado não muda).
- **Planilha** (`src/sheets.js`): continua dando o que só o grupo sabe —
  quando começa cada teimosinha (as faixas de ciclo) e a premiação
  efetivamente registrada. É também o fallback completo se a API da
  Caixa estiver fora do ar. Se a planilha é que estiver fora do ar, a
  sincronização parte dos dados do banco e enriquece com a Caixa.

- **Servidor** (`server.js`): Express. Serve o site, expõe `GET /api/data`
  (lê do banco) e `POST /api/sync` (busca a planilha, valida e grava).
  Sincroniza ao subir e a cada 30 min; a página também pede uma
  sincronização a cada visita.
- **Banco** (`src/db.js`): SQLite com tabelas `cycles`, `draws`, `meta`
  (o jogo fixo) e `syncs` (log de todas as sincronizações, com avisos).
  Cada sincronização substitui o retrato inteiro numa transação.
- **Validação** (`src/validate.js` + cruzamento oficial): a planilha é
  atualizada à mão e tem histórico de erros, então nada entra no banco
  sem passar por checagens (15 números por sorteio, dezenas de 1–25,
  acertos conferidos contra o jogo e contra o resultado oficial,
  concursos duplicados/fora de ordem/digitados errado). Problema grave →
  a sincronização é rejeitada e o banco mantém os últimos dados válidos.
  Avisos têm dois níveis: `alerta` (fatos divergentes — aparecem no site
  quando são do ciclo atual) e `info` (ex.: prêmio pequeno que a
  planilha não anota — só no log de sincronizações).
- **Regras de negócio** (`src/build-data.js`): portadas sem alteração do
  site original — montagem dos ciclos, status `ok`/`pendente`/`sem_jogo`,
  correção manual do início do ciclo 3732, numeração sequencial dos
  sorteios.
- **Frontend** (`public/`): o mesmo visual e comportamento do site
  original, incluindo o alerta dos 20 sorteios (dourado a partir do 20,
  verde no 24/24). Abre na hora com os dados do banco ("retrato salvo") e
  troca para "dados ao vivo" quando a sincronização da visita conclui.

## Estrutura

```
server.js            servidor Express + agendamento das sincronizações
src/
  config.js          links da planilha, porta, caminhos, intervalo
  parse.js           parsing (CSV, datas, números) — portado do original
  build-data.js      regras de negócio dos ciclos — portado do original
  sheets.js          busca na planilha (CSV publicado → gviz), lado servidor
  caixa.js           resultados oficiais da Caixa: busca, cache, cruzamento, prêmio
  validate.js        checagens antes de aceitar dados da planilha
  db.js              SQLite (node:sqlite): schema, leitura, gravação, log
  sync.js            orquestra: busca → valida → grava
public/              frontend (visual idêntico ao site original)
scripts/             seed e sincronização manual
data/seed.json       retrato inicial extraído do HTML original
legacy/              site original de arquivo único + handoff, para referência
```

## Decisões e notas

- **CORS deixou de ser problema**: o site original buscava a planilha do
  navegador e precisava do truque de JSONP (tag `<script>`) para driblar
  CORS. Com a busca no servidor isso não existe; a ordem das fontes segue
  só a confiabilidade — CSV "Publicar na web" primeiro, gviz como reserva.
- **O banco é retrato, não fonte de edição**: quem manda continua sendo a
  planilha (estrutura) + a Caixa (resultados). Se um dia o grupo quiser
  editar pelo site, o banco já está pronto para virar fonte da verdade.
- **O que ainda é manual**: marcar o início de uma teimosinha nova (a
  linha de cabeçalho "Concurso" na planilha) — isso depende de o grupo
  ter comprado o jogo, nenhuma API sabe disso. Os resultados do ciclo em
  andamento entram sozinhos.
- **Prêmio calculado da aposta de 16 dezenas**: com k acertos ela paga
  `(16−k)·faixa(k) + k·faixa(k−1)` usando o rateio oficial do concurso.
  Só preenche quando a planilha não registrou valor; divergência vira
  aviso `info` (o grupo não anota prêmios pequenos).
- **Alerta dos 20 sorteios**: já estava implementado na última versão do
  site original e foi mantido igual (pergunta em aberto do handoff —
  respondida: sim, implementado).
