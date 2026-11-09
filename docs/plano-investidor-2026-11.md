# Plano de desenvolvimento: lacunas do pitch e da diligência (Ajuda+)

Atualizado em 2026-11-08.

Este plano parte de dois documentos: [pitch-investidor-vs-app-2026-11-06.md](pitch-investidor-vs-app-2026-11-06.md) e [perguntas-tecnicas-investidor-2026-11-06.md](perguntas-tecnicas-investidor-2026-11-06.md). Os detalhes dos erros C-xx, H-xx e P-xx vêm dos rascunhos do QA de 3 perfis, em `qa-2026-11-03/`.

**A regra principal é não mudar o que já funciona.** Para isso:
- Todas as migrações só acrescentam (colunas novas com padrão igual ao comportamento antigo, ou tabelas novas).
- Cada pedido guarda uma cópia das próprias regras (taxa, quem paga, risco, duração e preferências). Assim, os pedidos antigos continuam com 8% cobrados do cliente.

## Situação geral

| | |
|---|---|
| Código das Fases 0 a 5 | ✅ Pronto e na `main`. As branches foram juntadas e apagadas. |
| Testes | ✅ API 203/203 e app 79/79. Tipos e `next build` passam; no app sobra só o erro antigo de `date-fns/locale`. |
| Push para o GitHub | ✅ Feito em 2026-11-08 (`origin/main` = `7c0266d`). |
| Migrações 003 a 018 no banco | ✅ 003 e 005 a 018 aplicadas no Supabase de teste em 2026-11-08. ⏳ A 004 (cron) espera os segredos do Vault. |
| Níveis das categorias | ✅ Reparos = 2. Beleza, Frete e Limpeza = 1. |
| Teste manual no celular | ⏳ Pendente, feito pelo usuário. |
| Fase 6 | ✅ Código pronto na branch `fase-6/liquidez` (4 commits), ainda sem merge na `main`. Migrações 019 a 022 aplicadas no Supabase de teste em 2026-11-08. |
| Fase 7 | ⏳ Não iniciada. |

**Como trabalhamos:** sem flags, com isolamento por branch git. Não há Maestro nem testIDs: o teste é manual.

---

## Feito

### Fase 0: Base
- **Configuração editável:** tabela `appconfig`, `apps/web/src/lib/config.ts` e `GET /api/config`. Os parâmetros de negócio saíram do código: taxa, prazos, limites de dívida, saque, SLA, reverificação etc. No app, eles chegam pelo `useAppConfig`.
- **Rotina agendada:** `POST /api/cron/tick`, protegido por `CRON_SECRET` e disparado pelo `pg_cron` + `pg_net` (migração 004). As tarefas ficam em `apps/web/src/lib/cron/`: expiração, tempo excedido, SLA do suporte e retenção LGPD.
- **Eventos de produto:** tabela `appevent` + `trackEvent()`. Registra busca, geocodificação, ajudantes próximos, ETA previsto e real, e emergência.
- Migrações 003, 004 e 005.

### Fase 1: Antes de qualquer usuário real
- C-01: a RPC passou a receber IDs em texto, e o cadastro de profissional não dá mais erro 500 (migração 006).
- C-04/C-05: negociação de preço corrigida (`firstEmbed` nas propostas).
- C-06 / ajudante novo: o perfil começa como `PENDING`, e só fica disponível depois de aprovado.
- A-06: o perfil público não mostra mais a localização ao vivo. A posição é arredondada numa grade de cerca de 500 m.
- A-07: antes do aceite, o pedido aberto esconde o telefone e a rua.
- A-01: o aceite confere se o ajudante já está ocupado.
- A-03: horários sempre em UTC com "Z" e formatados no fuso do aparelho.
- A-10: cada lista de avaliações filtra pela direção (quem avaliou quem).
- Bloqueios novos:
  - chamada direta de R$ 0;
  - chamada direta para ajudante;
  - aceite fora da categoria do perfil.
- Reset de senha com código aleatório e no máximo 5 tentativas (migração 007). O e-mail sai pela Resend.
- **Taxa de 20% descontada do ajudante:** `computeFees`, com a regra guardada em cada pedido (migração 008). Os pedidos antigos ficam com 8% cobrados do cliente.
- **Pagamento em dinheiro:** a taxa vira débito na carteira do ajudante. Acima de `cashDebtLimitCents` (R$ 50), ele não consegue ficar disponível.

### Fase 2: Medir o piloto
- Expiração no servidor: a ajuda aberta e a oferta direta vencem pelo cron, e o cliente recebe aviso.
- Antes de pedir, o cliente vê "N ajudantes perto, ~X min" (`/api/orders/availability`).
- Preço sugerido por categoria e faixa de horário (`/api/orders/suggested-price`).
- Pergunta "como conheceu" no cadastro (migração 009).
- Painel `/admin/metrics` com:
  - aceite em menos de 10 min;
  - funil;
  - recompra em 30 dias;
  - erro do ETA;
  - endereços sem resultado.

### Fase 3: Saque (simulado)
- Tabelas `payoutaccount` e `payout`, mais a RPC `request_payout` com trava contra saque duplo (migração 010).
- Chave Pix normalizada e mascarada.
- Simulação de "como fica o saldo depois do saque", com valor mínimo e taxa.
- O valor de pedidos em disputa fica retido.
- Tela `app/client/withdraw.tsx`. O provedor é o `simulated` (`PAYOUT_PROVIDER`).

### Fase 4: Infraestrutura e IA
- A rota e a busca de endereço são escolhidas por env: `ROUTING_PROVIDER` (osrm, valhalla ou google) e `GEOCODING_PROVIDER` (nominatim ou google). O padrão continua o de antes, e a linha reta segue como plano B.
- **JudIA em nuvem:** `POST /api/assistant` com Claude Haiku 5.5. É usada quando a IA do aparelho não carrega (Expo Go, web ou aparelho sem suporte). Se não houver chave ou a API falhar, cai na busca por palavras-chave.
- `planejamento-ajuda-plus.md` corrigido nas partes de Valhalla e RF-D6.

### Fase 5: Segurança e responsabilidade
- **Código na porta:** o cliente vê o código, e o ajudante digita ao começar (migração 011).
- **Modo família:** contato de confiança + link público de acompanhamento `/t/[token]` (migração 012).
- **Botão de emergência:** liga para o 190 e abre um ticket de segurança com a localização. O alerta vai por e-mail para `SECURITY_ALERT_EMAIL`.
- **Níveis de risco:**
  - cada categoria tem um nível (1, 2, 3 ou proibido);
  - nível 2 exige selo, e nível 3 exige credencial;
  - selos dados pelo admin em `/admin/categories` (migração 013).
- **A IA sugere o nível de risco:** o servidor fica com o maior entre o nível da categoria e o da IA. A sugestão só aumenta o nível, nunca diminui.
- **KYC v2:** documento e selfie pela câmera, mais certidão de antecedentes. O admin vê as imagens por URL assinada (migração 014).
- **Tempo excedido:** a regra dos 150 m também vale na conclusão. Há uma duração prevista por categoria, e um alerta quando ela é ultrapassada (migração 015).
- **Denúncia e bloqueio:**
  - tabela `report`;
  - bloqueio de clientes, que impede login e refresh;
  - bloqueio automático por nota baixa;
  - SLA e escalonamento no suporte (migração 016).
- **Preferências do idoso:** nota mínima, mínimo de tarefas concluídas e "só mulheres" (migração 017).
- **Reverificação:**
  - selfie aleatória antes de começar (HTTP 428 = "tire nova selfie");
  - um aparelho por vez;
  - selfie ao trocar de aparelho (migração 018).
- **LGPD:**
  - a exclusão de conta apaga os arquivos de KYC e a localização;
  - o cron limpa a localização antiga e o KYC rejeitado.

---

## Falta fazer

### 1. Colocar no ar o que já está pronto
1. **Aplicar as migrações 003 e 005 a 018** no Supabase de teste, em ordem. Cada uma tem um `.down.sql` para desfazer.
2. **Aplicar a 004 (cron)** só depois de criar no Vault os segredos `cron_tick_url` e `cron_secret`. Até lá, dá para chamar `/api/cron/tick` à mão.
3. **Configurar as variáveis de ambiente:**
   - `PUBLIC_WEB_URL`
   - `SECURITY_ALERT_EMAIL`
   - `CRON_SECRET`
   - **Decisão de 2026-11-08:** não vamos usar a Anthropic (JudIA em nuvem) nem a Resend. O e-mail continua como está na `main`. Sem `ANTHROPIC_API_KEY`, a JudIA em nuvem cai na busca por palavras-chave.
4. **Gerar um build de desenvolvimento novo do app.** Há permissões novas de câmera e localização em segundo plano.
5. **Testar à mão** no celular. Para não ser interrompido:
   - `reverifyProbability` = `0` desliga a selfie aleatória;
   - `openRequestTtlMs` = `60000` faz a ajuda aberta expirar em 1 minuto.
6. **Classificar as categorias** em `/admin/categories`. Todas começam no nível 1.
7. Fazer o `git push` da `main`.

### 2. O que ficou parcial nas fases feitas
| Item | Estado | O que falta |
|---|---|---|
| Saque e repasse | Simulado | Escolher um provedor (Stripe Connect ou um de marketplace no Brasil), com Pix real e divisão automática do pagamento, atrás da interface `PayoutProvider`. |
| Comparação facial e prova de vida | Revisão manual no admin | Integrar um provedor de KYC brasileiro. |
| Geo próprio | O código aceita Valhalla e Google | Publicar `apps/geo` (Valhalla/Nominatim) na Railway quando o painel mostrar erro de ETA acima de 20% ou de endereço acima de 3%. |
| Tempo real no acompanhamento | Atualização a cada 5 s | Precisa de RLS/Realtime seguro. Com a autenticação própria de hoje, as posições vazariam. |
| Versão mínima do Android/iOS | Igual a antes | Avaliar a redução agora que existe a IA em nuvem. |
| Staging e CI | Não feitos | Ambiente separado com banco próprio e CI rodando os testes a cada push. |
| Avisos ao familiar | Link e e-mail | SMS, se for necessário. |

### 3. Fase 6: Liquidez (✅ código na branch `fase-6/liquidez`)
Migrações 019 a 022 já aplicadas no teste. Para testar, use as telas novas do admin (`/admin/zones`, `/admin/anchors`, `/admin/coupons`).

O que foi decidido na implementação:
- Fora de qualquer zona, o pedido é recusado (agendar não resolve). Dentro da zona e fora do horário, o pedido "agora" é recusado e o app já marca "Agendar".
- O piso do âncora conta só os minutos em que ele ficou disponível ou atendendo no turno. O ganho considerado é o líquido dos pedidos aceitos no turno.
- O desconto (cupom e crédito) é custo da plataforma: quem atende recebe o mesmo. O total nunca fica abaixo de R$ 1.

Itens planejados:
- **Zonas e horário de operação:** tabela `ServiceZone` (polígono e horário). Sem nenhuma zona cadastrada, tudo continua liberado. Fora da zona, o pedido vira "agendar". Palmas deixa de estar fixo no código e no prompt da IA.
- **Âncoras com piso por hora:** turnos dos âncoras. Se o ganho do turno ficar abaixo do piso, a diferença entra na carteira como subsídio.
- **Escalonamento:** ajuda aberta sem aceite em N minutos → avisa os âncoras de plantão → aumenta o raio.
- **Agendamento e créditos:** agendar também a ajuda aberta (`scheduledAt`), com cupons (`Coupon`) e crédito do cliente (`ClientCredit`) aplicados no `computeFees`.

### 4. Fase 7: Crescimento e negócio
- **Teste de preço por coorte:** o preço sugerido varia por coorte, e as métricas são separadas por coorte.
- **Indicação:** tabela `Referral`, com crédito quando o indicado conclui o primeiro pedido.
- **Conta família:** um pagante diferente do beneficiário (`FamilyLink`, `beneficiaryId`).
- **Assinatura:** um plano com créditos por mês.
- **Parceiros B2B e síndicos:** `Partner`, com código no cadastro e cobrança recorrente.
- **Fundo Garantia Ajuda+:** livro-razão com um percentual da taxa de cada pedido, mais o fluxo de indenização no admin.
- **Relatório mensal ao investidor:** exportação do painel de métricas.

### 5. Fora do código
- Cotação de microsseguro.
- Parecer jurídico sobre o piso de R$ 15/h e a exigência de antecedentes.
- Contrato de mútuo conversível.
- Cartas de intenção B2B.
- As 40 entrevistas.
- Contratação de um sócio de operações.

## Ordem sugerida
1. Seção 1 (testar o que está pronto).
2. Corrigir o que aparecer no teste manual.
3. Provedor de pagamento real.
4. Fase 6, antes de ampliar o piloto.
5. Fase 7.
