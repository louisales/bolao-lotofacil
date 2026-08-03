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

A planilha do Google Sheets continua sendo onde o grupo edita os dados.
O que mudou é que o site não depende mais dela a cada visita:

```
Google Sheets ──sincronização──▶ SQLite (data/bolao.db) ──API──▶ navegador
   (edição)      (validada)          (fonte durável)
```

- **Servidor** (`server.js`): Express. Serve o site, expõe `GET /api/data`
  (lê do banco) e `POST /api/sync` (busca a planilha, valida e grava).
  Sincroniza ao subir e a cada 30 min; a página também pede uma
  sincronização a cada visita.
- **Banco** (`src/db.js`): SQLite com tabelas `cycles`, `draws`, `meta`
  (o jogo fixo) e `syncs` (log de todas as sincronizações, com avisos).
  Cada sincronização substitui o retrato inteiro numa transação.
- **Validação** (`src/validate.js`): a planilha é atualizada à mão e tem
  histórico de erros, então nada entra no banco sem passar por checagens
  (15 números por sorteio, dezenas de 1–25, acertos conferidos contra o
  jogo, concursos duplicados/fora de ordem). Problema grave → a
  sincronização é rejeitada e o banco mantém os últimos dados válidos;
  suspeita pontual → entra, mas fica registrada e aparece no site.
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
  planilha. Se um dia o grupo quiser editar pelo site, o banco já está
  pronto para virar fonte da verdade.
- **Alerta dos 20 sorteios**: já estava implementado na última versão do
  site original e foi mantido igual (pergunta em aberto do handoff —
  respondida: sim, implementado).
