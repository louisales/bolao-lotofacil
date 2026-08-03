// Validação dos dados vindos da planilha.
//
// A planilha é atualizada à mão e tem histórico de inconsistências, então
// o sistema não confia cegamente nela (ver legacy/handoff-bolao-lotofacil.md):
//   - "errors"  → dado inutilizável; a sincronização é rejeitada e o banco
//                 mantém os últimos dados válidos.
//   - "warnings" → suspeitas pontuais; os dados são aceitos, mas os avisos
//                 ficam registrados no log de sincronização e visíveis no site.

export function validateData(data) {
  const errors = [];
  const warnings = [];

  const { meuJogo, cycles } = data || {};

  if (!Array.isArray(meuJogo) || meuJogo.length !== 16) {
    errors.push(`"Meu jogo" deveria ter 16 dezenas, veio com ${meuJogo?.length ?? 0}`);
  } else {
    if (new Set(meuJogo).size !== 16) errors.push('"Meu jogo" tem dezenas repetidas');
    if (meuJogo.some(n => !Number.isInteger(n) || n < 1 || n > 25)) errors.push('"Meu jogo" tem dezena fora de 1–25');
  }

  if (!Array.isArray(cycles) || cycles.length === 0) {
    errors.push('nenhum ciclo encontrado na aba Resultados');
    return { errors, warnings };
  }

  const meuJogoSet = new Set(meuJogo || []);
  const concursosVistos = new Set();
  let ultimoConcurso = null;

  for (const cycle of cycles) {
    for (const d of cycle.draws) {
      const ref = `concurso ${d.concurso}`;

      if (concursosVistos.has(d.concurso)) warnings.push({ concurso: d.concurso, nivel: 'alerta', msg: `${ref} aparece mais de uma vez` });
      concursosVistos.add(d.concurso);
      if (ultimoConcurso !== null && d.concurso < ultimoConcurso) {
        warnings.push({ concurso: d.concurso, nivel: 'alerta', msg: `${ref} fora de ordem (veio depois do ${ultimoConcurso})` });
      }
      ultimoConcurso = d.concurso;

      if (d.status === 'sem_jogo') continue;

      const ns = d.numerosSorteados;
      if (ns.length !== 15) {
        warnings.push({ concurso: d.concurso, nivel: 'alerta', msg: `${ref}: ${ns.length} números sorteados (esperado 15)` });
      } else {
        if (new Set(ns).size !== 15) warnings.push({ concurso: d.concurso, nivel: 'alerta', msg: `${ref}: números sorteados repetidos` });
        if (ns.some(n => !Number.isInteger(n) || n < 1 || n > 25)) warnings.push({ concurso: d.concurso, nivel: 'alerta', msg: `${ref}: número sorteado fora de 1–25` });
      }

      if (d.acertos !== null && ns.length === 15 && meuJogoSet.size === 16) {
        const esperado = ns.filter(n => meuJogoSet.has(n)).length;
        if (d.acertos !== esperado) {
          warnings.push({ concurso: d.concurso, nivel: 'alerta', msg: `${ref}: planilha diz ${d.acertos} acertos, mas comparando com o jogo dá ${esperado}` });
        }
      }

      if (d.numerosAcertados.length) {
        const nsSet = new Set(ns);
        const estranhos = d.numerosAcertados.filter(n => !meuJogoSet.has(n) || !nsSet.has(n));
        if (estranhos.length) warnings.push({ concurso: d.concurso, nivel: 'alerta', msg: `${ref}: números "acertados" que não batem com jogo+sorteio: ${estranhos.join(', ')}` });
      }
    }
  }

  return { errors, warnings };
}
