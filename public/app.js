// Renderização — portada sem alteração do site original
// (legacy/bolao-lotofacil.html). O que mudou é só a origem dos dados:
// em vez de snapshot embutido + planilha via CORS/JSONP, a página lê
// /api/data (banco local) e pede ao servidor uma sincronização fresca.

function ballHtml(n, hit) {
  return `<span class="ball${hit ? ' hit' : ''}">${n}</span>`;
}

function fmtMoney(v) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function computeSummary(data) {
  let totalRecebido = 0, totalSorteios = 0, melhorAcertos = 0, melhorConcurso = null;
  for (const cycle of data.cycles) {
    for (const d of cycle.draws) {
      totalSorteios += 1;
      if (d.premiacao) totalRecebido += d.premiacao;
      if (d.acertos !== null && d.acertos > melhorAcertos) { melhorAcertos = d.acertos; melhorConcurso = d.concurso; }
    }
  }
  const cicloAtual = data.cycles[data.cycles.length - 1];
  const numeros = cicloAtual ? cicloAtual.draws.map(d => d.sorteioNoCiclo).filter(n => n && n > 0) : [];
  const progresso = numeros.length ? Math.max(...numeros) : 0;
  return { totalRecebido, totalSorteios, melhorAcertos, melhorConcurso, cicloAtual, progresso };
}

function renderAlert(summary, warnings) {
  const slot = document.getElementById('alert-slot');
  const { progresso, cicloAtual } = summary;
  let html = '';
  if (cicloAtual) {
    if (progresso >= 24) {
      html += `<div class="alert alert--green"><span class="alert-dot"></span>
        <div class="alert-text">Ciclo fechado nos <b>24/24</b> sorteios. Hora de acertar as contas e começar a próxima teimosinha.</div></div>`;
    } else if (progresso >= 20) {
      html += `<div class="alert alert--gold"><span class="alert-dot"></span>
        <div class="alert-text">Chegamos ao sorteio <b>${progresso} de 24</b> — faltam <b>${24 - progresso}</b>. Hora de recolher o dinheiro para o próximo ciclo, pra não perder nenhum jogo.</div></div>`;
    }
  }
  // Só incomoda com inconsistências do ciclo em andamento e de nível
  // "alerta" (fatos divergentes); avisos informativos — como prêmios
  // pequenos que a planilha não anota — ficam no log de sincronizações.
  if (warnings && warnings.length && cicloAtual) {
    const concursosAtuais = new Set(cicloAtual.draws.map(d => d.concurso));
    const atuais = warnings.filter(w => concursosAtuais.has(w.concurso) && w.nivel !== 'info');
    if (atuais.length) {
      const resumo = atuais.slice(0, 3).map(w => w.msg).join(' · ');
      html += `<div class="alert alert--gold"><span class="alert-dot"></span>
        <div class="alert-text">A planilha veio com <b>${atuais.length} possível(is) inconsistência(s)</b> neste ciclo: ${resumo}${atuais.length > 3 ? ' · …' : ''}</div></div>`;
    }
  }
  slot.innerHTML = html;
}

function renderStats(summary) {
  const { totalRecebido, totalSorteios, melhorAcertos, melhorConcurso, progresso } = summary;
  document.getElementById('stats').innerHTML = `
    <div class="stat"><div class="stat-label">Ciclo atual</div><div class="stat-value">${progresso}<small> / 24</small></div></div>
    <div class="stat"><div class="stat-label">Já recebido</div><div class="stat-value">${fmtMoney(totalRecebido)}</div></div>
    <div class="stat"><div class="stat-label">Melhor resultado</div><div class="stat-value">${melhorAcertos}<small> acertos${melhorConcurso ? ' · c.' + melhorConcurso : ''}</small></div></div>
    <div class="stat"><div class="stat-label">Sorteios registrados</div><div class="stat-value">${totalSorteios}</div></div>
  `;
}

function renderTicket(meuJogo) {
  document.getElementById('ticket-slot').innerHTML = `
    <div class="ticket">
      <div class="ticket-top">
        <div>
          <div class="ticket-label">Nossa aposta fixa</div>
          <div class="ticket-title">Meu jogo</div>
        </div>
        <div class="ticket-count">${meuJogo.length} dezenas<br>jogadas sempre juntas</div>
      </div>
      <div class="balls">${meuJogo.map(n => ballHtml(n, false)).join('')}</div>
    </div>
  `;
}

function cycleLabel(cycle, idx) {
  if (cycle.label) return `Concursos ${cycle.label}`;
  if (cycle.emAndamento) return 'Ciclo em andamento';
  return `Ciclo ${idx + 1}`;
}

function renderDraw(d, meuJogoSet) {
  const hitSet = new Set(d.numerosAcertados);
  const balls = d.numerosSorteados
    .slice().sort((a, b) => a - b)
    .map(n => ballHtml(n, hitSet.has(n)))
    .join('');

  let premioHtml;
  if (d.status === 'sem_jogo') {
    premioHtml = `<span class="draw-premio semjogo">sem jogo</span>`;
  } else if (d.status === 'pendente') {
    premioHtml = `<span class="draw-premio pendente">aguardando atualização</span>`;
  } else if (d.premiacao) {
    premioHtml = `<span class="draw-premio money">${fmtMoney(d.premiacao)}</span>`;
  } else {
    premioHtml = `<span class="draw-premio zero">sem prêmio</span>`;
  }

  const idx = (d.sorteioNoCiclo && d.sorteioNoCiclo > 0) ? `#${d.sorteioNoCiclo}` : '—';

  return `
    <div class="draw">
      <div class="draw-idx">${idx}</div>
      <div class="draw-meta"><span class="concurso">${d.concurso}</span>${fmtDate(d.data)}</div>
      <div class="draw-balls">${balls}</div>
      <div class="draw-result">
        <span class="draw-acertos">${d.acertos !== null ? d.acertos + ' acertos' : '—'}</span>
        ${premioHtml}
      </div>
    </div>
  `;
}

function renderCycles(data, summary) {
  const meuJogoSet = new Set(data.meuJogo);
  const html = data.cycles.map((cycle, idx) => {
    const isCurrent = cycle === summary.cicloAtual;
    const tag = isCurrent
      ? `<span class="cycle-tag cycle-tag--current">em andamento · ${summary.progresso}/24</span>`
      : `<span class="cycle-tag cycle-tag--done">encerrado</span>`;
    const money = (cycle.totalPremiacao !== null && cycle.totalPremiacao !== undefined)
      ? `<span class="cycle-money">prêmios: <b>${fmtMoney(cycle.totalPremiacao)}</b></span>`
      : `<span class="cycle-money">prêmios: a apurar</span>`;
    const drawsHtml = cycle.draws.slice().reverse().map(d => renderDraw(d, meuJogoSet)).join('');
    return `
      <details class="cycle" ${isCurrent ? 'open' : ''}>
        <summary>
          <div class="cycle-heading">
            <span class="cycle-chevron">+</span>
            <span class="cycle-name">${cycleLabel(cycle, idx)}</span>
            ${tag}
          </div>
          ${money}
        </summary>
        <div class="cycle-body">${drawsHtml}</div>
      </details>
    `;
  }).reverse().join('');
  document.getElementById('cycles').innerHTML = html;
  document.getElementById('section-note').textContent = `${data.cycles.length} ciclos · mais recente primeiro`;
}

function render(data, { live, warnings }) {
  const summary = computeSummary(data);
  renderAlert(summary, warnings);
  renderStats(summary);
  renderTicket(data.meuJogo);
  renderCycles(data, summary);

  const pill = document.getElementById('status-pill');
  const fonte = document.getElementById('fonte-nota');
  if (live) {
    pill.textContent = 'dados ao vivo';
    pill.classList.add('live');
    fonte.textContent = 'Sincronizado agora: planilha + resultados oficiais da Caixa · dados guardados no banco local.';
  } else {
    pill.textContent = 'retrato salvo';
    pill.classList.remove('live');
    const quando = data.lastGoodSync ? fmtDateTime(data.lastGoodSync.at) : null;
    fonte.textContent = quando
      ? `Mostrando os dados do banco local, sincronizados pela última vez em ${quando}.`
      : 'Mostrando os dados do banco local.';
  }
}

async function fetchData() {
  const res = await fetch('/api/data');
  if (!res.ok) throw new Error('api/data falhou: ' + res.status);
  return res.json();
}

(async function init() {
  // Mesmo comportamento do site original: mostra na hora o que já se
  // tem (antes: snapshot embutido; agora: banco local) e tenta atualizar
  // ao vivo em seguida.
  let data;
  try {
    data = await fetchData();
    render(data, { live: false });
  } catch (err) {
    document.getElementById('fonte-nota').textContent = 'Não consegui falar com o servidor.';
    return;
  }

  try {
    const sync = await fetch('/api/sync', { method: 'POST' }).then(r => r.json());
    if (sync.ok) {
      const fresh = await fetchData();
      render(fresh, { live: true, warnings: sync.warnings });
    } else {
      console.info('Sincronização indisponível, mostrando o banco local.', sync.error);
    }
  } catch (err) {
    console.info('Sincronização indisponível, mostrando o banco local.', err);
  }
})();
