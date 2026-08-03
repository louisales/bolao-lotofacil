# Handoff — Site do Bolão da Lotofácil (Teimosinha)

## O que é
Site que espelha visualmente uma planilha de controle de um bolão da Lotofácil entre amigos.

## Contexto do bolão
- Modelo **Teimosinha**: mesmo jogo repetido por 24 sorteios
- 11 participantes
- Ciclo atual: concurso **3732 até o 3755**
- Jogo fixo do grupo (16 dezenas): 1, 2, 3, 4, 6, 11, 13, 14, 15, 17, 18, 19, 21, 22, 24, 25

## Fonte de dados
- Planilha no Google Sheets com 3 abas:
  - **Meu jogo**: números jogados
  - **Resultados**: número do sorteio, data, números sorteados, quantidade de acertos, comparação com o jogo, premiação
- Planilha original é privada; foi compartilhada como "qualquer pessoa com o link" para permitir leitura ao vivo
- Atualização diária da planilha, com alguns erros ocasionais (importante: o site não deve simplesmente confiar cegamente na planilha sem alguma validação, já que a fonte tem histórico de inconsistência)

## Estado atual do site
- Já funciona com "dados ao vivo", lendo direto da planilha compartilhada
- Requisito pendente: aviso ao atingir 20 sorteios, para lembrar o grupo de recolher o dinheiro e não perder nenhum jogo

## Próximo passo recomendado no Code/Cowork
1. Extrair o código-fonte do site atual.
2. Entregar este documento como contexto.
3. Confirmar se o alerta de "20 sorteios" já foi implementado ou ainda está pendente antes de continuar o desenvolvimento.

## Em aberto (não decidido ainda)
- Se o alerta dos 20 sorteios foi implementado
- Se haverá necessidade de lidar com erros da planilha de forma automatizada (validação/alerta) ou se seguirá manual
