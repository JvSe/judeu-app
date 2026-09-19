# Plano de Teste — Judeu (app mobile)

Plano de QA exploratório organizado por fluxo de usuário. Siga a ordem sugerida — ela reproduz a jornada real de alguém abrindo o app pela primeira vez.

Legenda:
- `[ ]` marque conforme for testando
- 🔎 **Achado conhecido** — comportamento identificado direto no código-fonte que provavelmente é bug/placeholder, não regressão sua. Confirme o comportamento e não perca tempo investigando a causa.

---

## 0. Preparação

- [ ] Crie **duas contas de teste**: uma pelo botão "Quero contratar" (vira CLIENT) e outra por "Quero trabalhar" (vira PROVIDER). Não existe alternância de papel dentro de uma mesma conta — o papel é fixado no cadastro. Reaproveite `SEED_USUARIOS_TESTE.md` se já houver contas prontas.
- [ ] A conta PROVIDER só aparece para clientes e só recebe pedidos depois que o status dela vira **APPROVED**. Isso é aprovação manual (não existe botão no app para isso) — combine com quem tiver acesso ao banco/admin para aprovar a conta de teste antes de tentar os fluxos de pedido ponta a ponta.
- [ ] Se possível, rode duas instâncias do app (2 emuladores, ou 1 emulador + 1 celular físico) logadas uma como cliente e outra como prestador — vários fluxos (chat, proposta, tracking) só fazem sentido testando os dois lados em paralelo.
- [ ] **Tracking com rota/ETA:** confirme que o backend web tem `VALHALLA_URL` apontando para um servidor OSRM/Valhalla acessível (ex.: deploy Railway). Sem isso, mapa e GPS funcionam, mas linha laranja e ETA ficam em "Calculando...".

---

## 1. Onboarding e Autenticação

**Tela inicial (`/`)**
- [ ] Abrir o app deslogado → aparece a tela com "Quero contratar" / "Quero trabalhar" / "Já tem conta? Entrar"
- [ ] Se já estiver logado, abrir o app deve pular direto para a home do papel certo (cliente → `/client`, prestador → `/provider`)

**Cadastro**
- [ ] "Quero contratar" abre o cadastro e, ao concluir, leva para a Home do cliente
- [ ] "Quero trabalhar" abre o mesmo cadastro e, ao concluir, leva direto para a tela de KYC (cadastro profissional)
- [ ] Tentar cadastrar sem aceitar os Termos → erro "Aceite os termos para continuar"
- [ ] Nome com 1 caractere → erro "Informe seu nome completo"
- [ ] Senha com menos de 8 caracteres → erro correspondente
- [ ] Link "Termos de uso" abre a tela de termos; "Política de privacidade" abre a tela de política
- [ ] Cadastrar com e-mail já usado → mensagem de erro do servidor aparece na tela (não trava o app)

**Login**
- [ ] Login com e-mail/senha corretos → vai para a home certa conforme o papel da conta
- [ ] Login com senha errada → mensagem de erro, sem travar
- [ ] Ícone de olho mostra/esconde a senha
- [ ] 🔎 Botões "Google" e "Apple" na tela de login são decorativos (sem ação) — confirme que tocar neles não faz nada

**Esqueci minha senha**
- [ ] "Esqueci minha senha" → tela pede e-mail → envia (sempre parece dar certo, mesmo com e-mail que não existe, por design)
- [ ] Com e-mail válido, o código de 6 dígitos chega (verificar no provedor de e-mail de teste/log do backend)
- [ ] Redefinir com código errado → erro "Código inválido ou expirado"
- [ ] Redefinir com as duas senhas diferentes → erro "As senhas não coincidem"
- [ ] Redefinir com senha nova < 8 caracteres → erro correspondente
- [ ] Redefinir com sucesso → login automático, vai direto para a home certa
- [ ] Pedir um segundo código antes de usar o primeiro → o código antigo deixa de funcionar, só o mais recente é válido

**🔎 Achados conhecidos nesta seção**
- [ ] A tela de verificação por SMS (`otp`) existe mas é totalmente estática (telefone e dígitos fixos, "Verificar" navega direto sem validar nada) e nenhum fluxo real do app passa por ela — não é regressão, é tela solta no código.

---

## 2. Fluxo do Cliente

### 2.1 Home
- [ ] Mapa abre centrado, com marcador de "você" (se permissão de localização concedida) e marcadores de prestadores
- [ ] Negar permissão de localização → mapa continua funcionando, texto muda para "Localização indisponível", marcador de "você" some
- [ ] Sino de notificação mostra bolinha quando há notificação não lida, e leva para `/client/notifications`
- [ ] Avatar leva para o Perfil
- [ ] Cards "Perto de você" mostram prestadores e levam ao perfil do prestador ao tocar
- [ ] 🔎 Link "Ver mapa" abaixo dos cards não tem ação (não é tocável)
- [ ] Barra de busca abre o modal de IA mockado (ver observação na seção 2.9 abaixo)

### 2.2 Buscar (aba Explore)
- [ ] Em build com IA on-device disponível: assistente de chat real aparece, permite digitar, mostra progresso de carregamento do modelo, retorna resultados de busca reais que levam ao perfil do prestador
- [ ] Em build sem IA on-device (ex: Expo Go): aparece grade estática de categorias com contador — 🔎 os cards de categoria não são tocáveis, é só informativo
- [ ] Testar uma busca que não corresponde a nenhuma categoria (no assistente real) → mensagem tipo "não encontrei essa categoria"

### 2.3 Perfil do prestador → Contratar
- [ ] Abrir o perfil de um prestador a partir da Home/Busca → nome, avaliação, anos de experiência, serviços e preços aparecem
- [ ] 🔎 Botão de compartilhar (ícone) não tem ação
- [ ] Lista de avaliações aparece (ou estado vazio "Ainda não há avaliações")
- [ ] "Contratar agora" leva para criar pedido já com o prestador e serviço mais barato pré-selecionados
- [ ] Testar com um prestador sem nenhum serviço cadastrado → "Contratar agora" ainda funciona, mas sem preço/serviço pré-preenchido

### 2.4 Criar pedido
- [ ] Preencher descrição (opcional) e criar um pedido para "Agora"
- [ ] Alternar para "Agendar" → exige data e hora
- [ ] Tentar agendar para uma data/hora no passado → erro "Escolha uma data e hora no futuro"
- [ ] Tentar agendar com data inválida (ex: 31/02) → erro de validação
- [ ] Preencher o CEP → rua/bairro/cidade/UF são autopreenchidos automaticamente
- [ ] Deixar rua/cidade/UF em branco → erro de validação ao tentar enviar
- [ ] Enviar o pedido → se o prestador permite negociação, vai para o detalhe do pedido; se não, vai direto para pagamento

### 2.5 Negociação de orçamento (só se o prestador tiver "permite negociação" ligado)
- [ ] No detalhe do pedido (status "criado"), tocar em "Negociar valor" → abre a tela de proposta
- [ ] Enviar uma proposta de valor válida (≥ R$1,00) → aparece como "aguardando resposta do prestador"
- [ ] Do lado do prestador, aceitar a proposta → valor do pedido é atualizado, tela do cliente reflete a mudança
- [ ] Do lado do prestador, recusar a proposta → cliente pode propor de novo
- [ ] Enviar valor inválido (0, negativo, texto) → erro "Informe um valor válido"
- [ ] Enviar uma segunda proposta antes da primeira ser respondida → a proposta antiga aparece no histórico como "substituída"
- [ ] Tentar negociar depois que o pagamento já foi iniciado → deve ser bloqueado (mensagem de erro do servidor)
- [ ] Tentar negociar num pedido que não está mais "criado" (já aceito/cancelado) → tela mostra aviso de que a negociação está fechada, sem formulário

### 2.6 Pagamento
- [ ] Escolher PIX → aparece QR code e código copia-e-cola; testar o botão de copiar (mostra "Copiado!")
- [ ] Deixar a tela de PIX aberta e confirmar o pagamento por fora (ou via admin/dev) → tela avança sozinha para o pedido quando o pagamento é confirmado
- [ ] Escolher Cartão → abre o formulário de pagamento (Stripe); testar cartão de teste válido e um inválido/recusado
- [ ] Escolher Dinheiro → confirma e vai direto para o detalhe do pedido
- [ ] Sair da tela de PIX no meio da espera e voltar depois → estado do pagamento continua correto (não perde o pagamento)

### 2.7 Detalhe do pedido e acompanhamento
- [ ] Linha do tempo mostra os status corretos conforme o pedido avança (criado → aceito → a caminho → em andamento → concluído)
- [ ] Na lista **Meus pedidos**, pedido **a caminho** → CTA primário **Acompanhar no mapa** abre direto a tela de tracking (secundário **Detalhes**)
- [ ] Com pedido **aceito/a caminho**, "Acompanhar no mapa" no detalhe mostra prestador, distância e ETA (atualiza a cada ~5–8s com app em foreground)
- [ ] Com pedido **em andamento**, botão **Prestador no local — ver no mapa** mantém acesso ao mapa (sem rota ao vivo)
- [ ] Toque em notificação de **pedido** (cliente) abre `/client/tracking/[id]`
- [ ] Cancelar o pedido enquanto ainda está "criado" ou "aceito" → funciona
- [ ] 🔎 Cancelar não pede confirmação — um toque cancela na hora. Confirme se esse é o comportamento esperado.
- [ ] Tentar cancelar um pedido "a caminho" ou "em andamento" → opção de cancelar não deve mais aparecer
- [ ] "Reportar um problema" abre um chamado de suporte já vinculado ao pedido

### 2.8 Chat
- [ ] Enviar mensagem para o prestador e confirmar que ela aparece (pode levar alguns segundos, é feito por atualização periódica, não instantâneo)
- [ ] Tentar enviar mensagem vazia/só espaços → não envia nada, sem erro visível
- [ ] 🔎 Botão "+" ao lado do campo de mensagem é decorativo, não anexa nada

### 2.9 Avaliação
- [ ] Depois de um pedido concluído, avaliar com estrelas + tags + comentário → salva e mostra "avaliação enviada" ao reabrir
- [ ] Tentar avaliar de novo o mesmo pedido → mostra a avaliação já enviada, somente leitura, sem opção de editar
- [ ] Tocar em "Pular" → volta para a lista de pedidos sem enviar nada
- [ ] 🔎 A lista de "concluídos" também permite tocar em pedidos **cancelados** para avaliar — teste esse caminho e confirme se a tela se comporta bem (ela foi feita pensando em pedido concluído)

### 2.10 Meus pedidos
- [ ] Aba "Em andamento" mostra pedidos ativos; aba "Concluídos" mostra finalizados/cancelados
- [ ] Pedido **EN_ROUTE**: card destacado; **Acompanhar no mapa** na lista
- [ ] Estados vazios aparecem corretamente quando não há pedidos em cada aba
- [ ] Ícone de chat no card leva direto para a conversa daquele pedido

### 2.11 Perfil do cliente
- [ ] Editar nome e telefone → salva
- [ ] Trocar foto de perfil (galeria) → nova foto aparece; negar permissão de fotos → mensagem de erro explicando o motivo
- [ ] Endereços: adicionar, editar, excluir (com confirmação), marcar como padrão
- [ ] Central de ajuda: abrir um chamado com assunto curto (<3 caracteres) e mensagem curta (<10 caracteres) → erros de validação aparecem
- [ ] Acompanhar um chamado já respondido pela equipe (precisa de resposta via admin) → resposta aparece na tela
- [ ] Privacidade: alternar permissões de localização/notificação/câmera e confirmar que reflete o estado real do sistema operacional
- [ ] "Baixar meus dados" → abre a tela de compartilhar com um arquivo
- [ ] "Excluir minha conta" → pede confirmação, e ao confirmar desloga e volta para a tela inicial
- [ ] 🔎 "Sair da conta" **não** pede confirmação (ao contrário de excluir endereço, que pede) — um toque desloga na hora

### 2.12 Notificações
- [ ] Filtros "Todas / Pedidos / Mensagens" filtram a lista corretamente
- [ ] "Marcar lidas" fica desabilitado quando não há nada não lido
- [ ] Tocar numa notificação leva para a tela correta (pedido, chat ou chamado de suporte) e marca como lida
- [ ] Ativar/desativar as preferências de notificação (Pedidos/Mensagens)

### 2.13 🔎 Assistente de IA mockado (achado conhecido, não é fluxo funcional)
- [ ] A partir da barra de busca da Home, seguir "Sim, me ajuda" → chat com conversa fixa (não dá pra digitar de verdade) → "Ver recomendação" mostra um prestador fixo chamado "Roberto Silva"/"Rafael Souza" com ID que não existe no backend real
- [ ] Confirme que tentar "Contratar agora" ou "Falar com Roberto" nesse fluxo quebra (erro/404) — isso é esperado dado que os IDs são fixos e fake, é um fluxo mockado separado do assistente real da aba Buscar

---

## 3. Fluxo do Prestador

### 3.1 Cadastro e KYC obrigatório
- [ ] Cadastro com "Quero trabalhar" leva direto para a tela de KYC
- [ ] Tentar sair do app/voltar sem preencher o KYC → confirmar o que acontece ao reabrir (deve continuar pedindo o KYC)

### 3.2 Preenchendo o KYC
- [ ] Selecionar categoria (obrigatório)
- [ ] Preencher "o que você faz" com menos de 2 caracteres → botão de enviar continua bloqueado
- [ ] Adicionar um serviço com nome curto ou preço abaixo de R$1,00 → não adiciona, mostra erro inline
- [ ] Adicionar pelo menos 1 serviço (obrigatório para enviar)
- [ ] Testar raio de atuação nos limites: 0, 1, 100, 101, negativo, texto não-numérico
- [ ] Ligar o toggle "Negociação de orçamento" — isso deve liberar o botão "Propor outro valor" no Painel mais tarde
- [ ] Anexar documento de identidade (obrigatório para enviar) — negar permissão de galeria → mensagem de erro explicando o motivo
- [ ] Enviar o cadastro → status vira "Em análise" (PENDING)
- [ ] Editar um cadastro já enviado → dados vêm pré-preenchidos; reenviar atualiza normalmente
- [ ] Confirmar que o status muda para "Aprovado" só depois de uma aprovação manual (via admin/banco) — não existe nada no app que aprove sozinho

### 3.3 Painel (Dashboard)
- [ ] Com status PENDING ou BLOCKED, o banner de status aparece no topo e leva para o KYC ao tocar
- [ ] Alternar disponibilidade (Disponível/Offline) no chip do topo — confirme que persiste ao sair e voltar da tela
- [ ] Com um pedido novo (status "criado") disponível: aparece na seção "Novos pedidos" com Aceitar/Recusar
- [ ] Aceitar um pedido → ele passa para "Em andamento"; Recusar → pedido cancelado, some da lista
- [ ] Se "permite negociação" estiver ligado, botão "Propor outro valor" aparece nos pedidos novos e leva para a tela de proposta
- [ ] Tocar duas vezes rápido em Aceitar/Recusar → confirmar que não duplica a ação (botão deve travar durante o processamento)
- [ ] Pedido em andamento mostra o botão de avançar etapa certo conforme o status (Iniciar trajeto / Iniciar serviço / Concluir serviço)
- [ ] **Iniciar trajeto** abre a tela **Mapa de entrega** (`/provider/delivery/[id]`) com rota até o cliente
- [ ] Link **Ir para o mapa** no card em andamento abre a mesma tela de entrega
- [ ] Na entrega: botões **Google Maps** e **Waze** abrem navegação externa; GPS do prestador atualiza no mapa (app em foreground)
- [ ] Toque em notificação de **pedido** (prestador) abre `/provider/delivery/[id]`
- [ ] Pedidos concluídos aparecem na lista (até 10 mais recentes) e levam para a tela de avaliar o cliente

### 3.4 Negociação de orçamento (lado prestador)
- [ ] Repetir os mesmos casos da seção 2.5, agora enviando/recebendo proposta do lado do prestador
- [ ] Com uma proposta sua pendente, confirmar que não existe opção de cancelar/retirar a proposta enviada (só esperar resposta)

### 3.5 Mapa
- [ ] Com um pedido novo disponível, a "chamada" (sheet) aparece no mapa com Aceitar/Recusar
- [ ] 🔎 O toggle "Online" desta tela é separado da disponibilidade real do Painel — desligue o "Online" aqui e confirme que a chamada de novo pedido some **só nesta tela**, mesmo que o pedido continue visível/aceitável no Painel
- [ ] 🔎 O valor "R$ 350 hoje" mostrado aqui é fixo — confirme que ele não muda mesmo depois de completar pedidos
- [ ] Com um pedido "a caminho", o mapa mostra a rota até o cliente

### 3.6 Executando o pedido
- [ ] Aceitar → **Iniciar trajeto** (vai ao mapa de entrega) → **Cheguei — iniciar serviço** (só habilita dentro de ~150m do endereço) → Concluir serviço; status do cliente acompanha em cada etapa
- [ ] Com prestador em movimento, cliente vê marker e ETA atualizando na tela de tracking
- [ ] Confirmar que pedido pago em dinheiro é marcado como pago automaticamente ao concluir

### 3.7 Chat
- [ ] Mesmos casos da seção 2.8, do lado do prestador

### 3.8 Ganhos
- [ ] Abrir a aba Ganhos → saldo, gráfico da semana e extrato de transações aparecem
- [ ] Completar um pedido pago → confirmar que o extrato/saldo reflete a nova transação
- [ ] 🔎 Botões "Sacar" e "Extrato" no card de saldo não têm nenhuma ação — confirme que tocar neles não faz nada
- [ ] 🔎 O chip "Esta semana" com seta não abre nenhuma opção de período — decorativo

### 3.9 Avaliar o cliente
- [ ] Mesmos casos da seção 2.9, do lado do prestador

### 3.10 Perfil do prestador
- [ ] Status (Em análise/Aprovado/Bloqueado) aparece correto
- [ ] "Trocar de perfil" volta para a tela inicial (não existe alternância real de papel, é preciso logar em outra conta)

### 3.11 Suporte e notificações
- [ ] Mesmos casos das seções 2.11 (central de ajuda) e 2.12 (notificações), do lado do prestador

---

## 4. Fluxos ponta a ponta (cliente + prestador em paralelo)

Use as duas contas/instâncias juntas para os casos abaixo:

- [ ] **Pedido completo sem negociação**: cliente cria pedido → prestador aceita → cliente paga → prestador inicia trajeto (mapa) → cliente acompanha no mapa → prestador chega e inicia serviço → conclui → cliente e prestador se avaliam mutuamente
- [ ] **Pedido completo com negociação**: cliente cria pedido → prestador propõe outro valor → cliente aceita → segue o fluxo normal de pagamento em diante
- [ ] **Negociação recusada**: uma parte propõe, a outra recusa, a primeira propõe de novo com valor diferente
- [ ] **Cancelamento**: cliente cancela um pedido recém-criado antes do prestador responder; cliente cancela um pedido já aceito antes do prestador iniciar o trajeto
- [ ] **Chat cruzado**: mensagens enviadas de um lado aparecem no outro em poucos segundos
- [ ] **Tracking em tempo real**: prestador se movendo (ou GPS simulado) reflete no mapa do cliente durante "a caminho"
- [ ] **Tentar responder à própria proposta**: confirmar que o servidor bloqueia (ex: navegando manualmente para a tela de proposta do lado de quem propôs)

---

## 5. Resumo dos achados conhecidos (mock/decorativo/sem confirmação)

Use esta lista para não reabrir os mesmos itens como "bug novo" — são comportamentos já identificados no código que valem confirmação, não investigação:

- [ ] Tela de OTP por SMS é mockada e não é usada por nenhum fluxo real
- [ ] Botões sociais (Google/Apple) no login são decorativos
- [ ] Link "Ver mapa" na Home não é tocável
- [ ] Botão de compartilhar no perfil do prestador não tem ação
- [ ] Cards de categoria na busca (modo sem IA) não são tocáveis
- [ ] Fluxo de IA mockado a partir da busca da Home usa IDs fixos que não existem no backend
- [ ] Cancelar pedido (cliente) não pede confirmação
- [ ] Sair da conta (cliente) não pede confirmação
- [ ] Botão "+" de anexo no chat é decorativo (cliente e prestador)
- [ ] Toggle "Online" no Mapa do prestador é local e não reflete a disponibilidade real do Painel
- [ ] Valor "R$ 350 hoje" no Mapa do prestador é fixo/mockado
- [ ] Botões "Sacar" e "Extrato" em Ganhos não têm ação
- [ ] Chip de período "Esta semana" em Ganhos não abre nada
- [ ] Avaliar um pedido cancelado é possível pela lista de "concluídos" (tela não foi pensada para isso)
