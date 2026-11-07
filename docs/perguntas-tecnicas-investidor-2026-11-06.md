# Diligência técnica simulada — Ajuda+

**Data:** 2026-11-06 · **Formato:** perguntas que um investidor (ou o CTO dele) faria olhando o código **como ele está hoje**, seguidas da resposta do CEO.

**Regra das respostas:** só afirmar o que o repositório comprova. Quando algo não existe, a resposta diz isso e apresenta o plano. Base: leitura do código + `docs/relatorio-qa-3-perfis-2026-11-03.md` + `docs/pitch-investidor-vs-app-2026-11-06.md`. Estimativas de prazo são do fundador e estão marcadas como tal.

---

## 1. "Me descreva a arquitetura. Isso aguenta um piloto e depois uma cidade inteira?"

**CEO:** É um monorepo (Turborepo + pnpm) com três peças:

- **App único** em Expo/React Native (`apps/native`): cliente, ajudante e profissional usam a mesma casca, o que reduz pela metade o que eu preciso manter.
- **API** em Next.js (`apps/web/src/app/api`), que também serve o painel admin.
- **Banco** Postgres no Supabase, com schema versionado no Prisma (`packages/db/prisma`) e RPCs SQL para operações transacionais (`packages/db/supabase/rpcs`). Arquivos de KYC em bucket privado do Supabase Storage.

Para o piloto, com dezenas de pedidos por dia, a arquitetura sobra. O que **não** escala hoje, e eu sei:

- O acompanhamento no mapa é por **polling a cada 5 s** (`apps/native/lib/hooks.ts:116`), não tempo real. Com centenas de pedidos simultâneos isso vira custo e latência. A troca natural é Supabase Realtime, que já está no nosso fornecedor.
- **Nada roda em segundo plano no servidor**: pedidos não expiram sozinhos, a oferta de 60 s não é aplicada. Preciso de um job agendado (cron) antes do piloto.

## 2. "Quantos bugs críticos existem hoje? Se eu pedir uma demonstração agora, o que quebra?"

**CEO:** Eu sei exatamente, porque fiz um QA estruturado em 2026-11-03 com três perfis de teste (cliente, ajudante e profissional), contra a API real e o app no simulador. Resultado: **6 críticos e 10+ altos**, documentados com arquivo e linha.

O que quebraria numa demonstração hoje:
- **Cadastro de profissional** retorna erro 500 (tipo errado numa RPC, C-01).
- **Negociação de preço** não funciona para ninguém (C-04, C-05).
- Um **helper vira profissional aprovado sem KYC** (C-06).

O fluxo principal de ajuda aberta funciona de ponta a ponta: pedido, aceite, pagamento, trajeto, chegada, conclusão, carteira e avaliações. Testes automatizados: 67 no app e 39 na API, todos passando. A checagem de tipos do app ainda falha num import (`date-fns/locale`).

**Compromisso:** nenhum usuário real entra antes de zerar os críticos. *Estimativa do fundador: 2 a 3 semanas para os críticos e os vazamentos de dados.*

## 3. "Sua IA roda no celular. Por quê? E o que acontece no celular da dona Maria?"

**CEO:** O modelo é o **Qwen3 1.7B quantizado, rodando via ExecuTorch** (`apps/native/lib/assistant.ts:16`). Ele não conversa solto: escolhe entre ferramentas fixas (buscar profissional, pedir ajuda, buscar vagas) com as categorias reais do banco, e o app executa contra o catálogo de verdade.

Escolhi rodar no aparelho por três motivos: custo zero por busca, privacidade (a descrição do problema não sai do celular) e independência de fornecedor.

O ponto fraco, sendo honesto:
- O modelo é um **download grande** (centenas de MB) na primeira vez.
- O app exige **Android 13+ e iOS 17+** (`apps/native/app.json:54,57`). Para o público idoso e de menor renda, isso exclui uma parte relevante dos aparelhos.
- Quando a IA não está disponível, o app **não tem plano B de busca**: manda o usuário escolher no mapa.

**Plano:** fallback em duas camadas. Primeiro, a busca por palavra-chave que já existe na API (`searchCatalog`, `/api/search`). Segundo, um modelo pequeno em nuvem (Claude Haiku 5.5), que custa centavos por mês no volume do piloto. Também quero reavaliar a versão mínima do Android com dados do piloto.

## 4. "Você depende de quais serviços de terceiros? O que acontece se um deles cair ou te bloquear?"

**CEO:** Mapa e geolocalização são todos de código aberto ou gratuitos:

| Função | Hoje | Risco |
|---|---|---|
| Rotas e ETA | **OSRM público de demonstração** (`apps/web/src/lib/geo.ts:124-129`) | Sem garantia de disponibilidade nem permissão para uso comercial |
| Endereço → coordenada | **Nominatim** (`geo.ts:25`) | A instância pública limita a ~1 requisição por segundo |
| Mapa | OpenFreeMap (`apps/native/components/ui/real-map.tsx:15-18`) | Baixo |
| CEP | ViaCEP | Baixo |

Já preparei a saída: `apps/geo/` tem **Valhalla e Nominatim dockerizados, prontos para subir na Railway**, só com o mapa do Tocantins. Não estão no ar ainda. Também preciso ajustar o cliente de rotas, porque hoje ele fala o formato do OSRM.

Se o OSRM cair, o app não para: cai para uma estimativa em linha reta a 30 km/h (`geo.ts:113-121`).

**Plano:** subir os dois serviços próprios antes do piloto. Se a qualidade de endereços em Palmas for ruim, migrar a busca de endereço para o Google Places, que no volume do piloto cabe na franquia gratuita.

## 5. "Como o dinheiro chega no bolso do ajudante?"

**CEO:** Essa é a lacuna mais séria do produto, e prefiro que o senhor ouça de mim.

O que existe: o cliente paga pelo **Stripe** (cartão), a API registra o pagamento e, na conclusão, **credita a carteira interna** do ajudante (`apps/web/src/lib/orders.ts:835`). O ajudante vê saldo e histórico.

O que não existe: **o saque**. Não há repasse automático (split de pagamento, como Stripe Connect ou equivalente nacional). Hoje o dinheiro ficaria parado na conta da empresa. Além disso:
- **Pix** foi recusado pela conta Stripe de teste.
- Em pedido **em dinheiro**, a taxa aparece na tela mas nunca é cobrada.
- O app cobra **8% do cliente, por cima**; o pitch falou em 20% do ajudante. Vou decidir o modelo e alinhar código, app e FAQ.

**Plano:** adotar um provedor de pagamento com split nativo e Pix (Stripe Connect, ou um provedor brasileiro de marketplace). Isso também resolve uma questão regulatória: com split, a empresa **não fica custodiando** o dinheiro do ajudante. *Estimativa do fundador: 2 a 3 semanas, incluindo o KYC financeiro do ajudante que o provedor exige.*

## 6. "Você falou em 'cadastro verificado'. O que exatamente é verificado hoje?"

**CEO:** Hoje, pouco, e eu corrigi isso no pitch:

- **Profissional:** envia **uma foto de documento escolhida da galeria** (`apps/native/app/client/kyc.tsx:134-155`). Um administrador aprova pelo painel, mas o painel **nem abre a imagem**: só mostra "documento enviado".
- **Helper:** é **aprovado automaticamente, sem documento** (`apps/web/src/lib/provider-profile.ts:266-274`).
- Não há selfie, prova de vida, comparação facial nem antecedentes criminais.

O que já está bem feito é a base: senhas com bcrypt (`apps/web/src/lib/auth.ts:20`), tokens de acesso com refresh revogável, bucket privado para documentos e a regra dos 150 m para iniciar o serviço.

**Plano em duas etapas:**
1. **Antes do piloto:** helper nasce **pendente**. Envio de documento e selfie com a câmera, e o painel passa a mostrar as imagens para aprovação manual. Com 15 a 20 ajudantes, aprovar à mão é viável e mais seguro.
2. **Para escalar:** integrar um provedor brasileiro de verificação de identidade (selfie com prova de vida, comparação com o documento e consulta de antecedentes), com custo por verificação ainda a cotar.

## 7. "Que dados pessoais vocês guardam e onde eles estão vazando?"

**CEO:** Guardamos dados sensíveis: localização ao vivo do ajudante, endereço e telefone do cliente, documento de identidade. A base de LGPD existe: aceite de termos no cadastro, exportação dos dados (`/api/auth/me/export`), exclusão de conta com revogação de sessões, e telas de política e termos.

O QA encontrou **dois vazamentos que eu trato como críticos**, mesmo com o relatório marcando como "alto":
- O perfil público de qualquer prestador, inclusive pendente ou bloqueado, devolve a **localização ao vivo** (QA A-06).
- Perfis **pendentes ou bloqueados** veem **telefone e endereço exato** de clientes em ajudas abertas, antes de aceitar (QA A-07, `orders.ts:629-660`).

Também falta: a exclusão de conta não apaga o documento de KYC nem a última localização, e não há política de retenção.

**Plano:** os vazamentos entram no bloco "antes de qualquer usuário real". Endereço exato e telefone só serão liberados **depois do aceite**, e a localização só aparece para o cliente do pedido em andamento. A função que já faz essa checagem para um pedido, `canViewOpenRequest` (`orders.ts:662`), passa a valer também na listagem.

## 8. "Como você vai medir as metas do dia 90 se o app não tem analytics?"

**CEO:** Hoje não tem: não há SDK de analytics nem painel de métricas, e o admin só cuida de KYC e suporte. Mas **os dados brutos já estão no banco**, porque cada pedido guarda criação, aceite, conclusão e cancelamento, e há uma trilha de eventos (`OrderEvent`).

Isso permite calcular, só com SQL:
- **Tempo até o aceite** e **% de pedidos aceitos em menos de 10 minutos**, por bairro (`Address.neighborhood`).
- **Recompra em 30 dias** por cliente (já existe uma função de estatísticas do cliente em `apps/web/src/lib/profile.ts`).
- **Incidentes**, a partir dos chamados de suporte por categoria.

**Plano:** uma página de métricas no painel admin, lendo essas consultas, que gera o relatório mensal ao senhor. O custo de aquisição por cliente (CAC) vem de fora do app (gasto por canal). Para atribuir o canal, adiciono um campo "como conheceu" e códigos por parceiro no cadastro. *Estimativa do fundador: 1 semana.*

## 9. "Esse código foi feito por quantas pessoas? Se você sumir, alguém consegue continuar?"

**CEO:** Foi feito por **uma pessoa**, eu, entre julho e novembro de 2026. Esse é um risco real, e o senhor está certo em perguntar.

O que reduz esse risco hoje:
- **Tipagem de ponta a ponta** (TypeScript), schema do banco versionado e validação de entrada com Zod.
- **Testes automatizados** (106 no total) e um **QA documentado** com roteiro reproduzível e scripts de massa de teste (`docs/qa-2026-11-03/`).
- Um **documento de planejamento** com o estado de cada requisito (`docs/planejamento-ajuda-plus.md`). Ele ainda tem duas marcações desatualizadas, que já anotei.

O que ainda falta: deploy automatizado (a API ainda não está publicada) e testes de interface estáveis. Os fluxos do Maestro usam texto da tela porque o app não tem `testID`.

**Plano:** parte do investimento contrata um segundo desenvolvedor no mês 4. Até lá, toda decisão técnica relevante fica registrada em `docs/`.

---

## Resumo para o investidor

| Pergunta | Situação hoje | Bloqueia o piloto? |
|---|---|---|
| Arquitetura | Adequada para o piloto; falta job agendado e tempo real | Só o job agendado |
| Bugs | 6 críticos mapeados | **Sim** |
| IA no celular | Funciona; sem fallback; exige Android 13+ | Não, mas exclui aparelhos |
| Terceiros | OSRM e Nominatim públicos; serviços próprios prontos, não implantados | **Sim** (uso comercial) |
| Pagamento ao ajudante | Sem saque nem split; Pix não funciona | **Sim** |
| Verificação | 1 foto (profissional), nada (helper) | **Sim** |
| Dados pessoais | Dois vazamentos | **Sim** |
| Métricas | Dados existem, falta painel | Sim, para as metas do dia 90 |
| Dependência do fundador | 1 desenvolvedor, bem documentado | Não |

**Frase de fechamento do CEO:** "O núcleo do produto está construído. O que falta para colocar um usuário real em segurança cabe em um único bloco de trabalho, com cerca de 6 a 8 semanas de estimativa minha, e eu sei exatamente quais arquivos tocar. Prefiro mostrar essa lista ao senhor agora do que o senhor encontrar ela na diligência."
