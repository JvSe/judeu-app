# Modo Apresentação (iPhone + iPad, sem internet)

Branch: `demo/apresentacao`. Funciona só para os dois usuários abaixo. Qualquer outro login continua usando a API real.

| Aparelho sugerido | Papel | Usuário |
|---|---|---|
| iPhone | Cliente (pede ajuda) | `9dcc79de-b284-4ef6-8953-c23f21a456c5` |
| iPad | Ajudante (atende) | `f926a29f-a254-4aff-86c4-f53101971618` |

## Como funciona
- Quando um desses dois usuários faz login, o app responde tudo **localmente** (`apps/native/lib/demo/`). Não há rede nem banco envolvidos, e nada é gravado no Supabase.
- O iPhone e o iPad conversam **direto**, via Multipeer Connectivity (o mesmo mecanismo do AirDrop). Basta Wi-Fi ligado; não é preciso estar conectado a nenhuma rede.
- Quando o outro aparelho não está conectado há mais de 5s, o app entra no **modo roteiro** e simula o outro lado sozinho. A apresentação nunca trava.
- Para entrar na demo, use o e-mail e a senha reais de um desses dois usuários. A senha é conferida no aparelho, sem internet, contra o hash bcrypt copiado da conta por `node scripts/demo-credentials.mjs` para `apps/native/.env`. Com outra senha, o login segue para a API real. Sem os hashes, a demo não abre.
- Os hashes entram no build: rode o script antes de compilar e de novo se alguém trocar a senha. Instale este build só nos aparelhos da apresentação, por cabo, nunca em TestFlight ou loja.

## Uma vez só (com internet)
1. **Dados reais dos usuários.** Na raiz do repo, rode `node scripts/demo-snapshot.mjs`.
   - O script lê o banco (só leitura) e grava `apps/native/lib/demo/fixtures.json`.
   - Sem isso, o app usa dados provisórios ("Cliente Demo" / "Ajudante Demo") com os e-mails `cliente.demo@judeu.app` e `ajudante.demo@judeu.app`.
2. **Build de release nos dois aparelhos, via cabo.** Em `apps/native`:
   ```
   npx expo prebuild --platform ios
   npx expo run:ios --configuration Release --device
   ```
   Rode uma vez com o iPhone conectado e outra com o iPad conectado.
3. **Abrir o app nos dois e aceitar as permissões:**
   - "Rede local": **Permitir**. Sem isso, os aparelhos não se encontram.
   - Notificações: **Permitir**. São os banners de "nova ajuda" e "aceitou".
4. **Mapa offline.** Logado, dê um toque longo no seu avatar (canto superior esquerdo da home) e toque em **Baixar mapa offline** até aparecer "pronto ✓". Faça isso nos dois aparelhos.

## Antes de entrar na sala
1. Ative o **modo avião** e ligue o **Wi-Fi** de novo, nos dois aparelhos. Não conecte em rede nenhuma; o Bluetooth pode ficar ligado.
2. Abra o app nos dois. No painel (toque longo no avatar), confira a bolinha **verde "Conectado"**.
3. Toque em **Zerar rodada** para começar limpo. Isso zera os dois aparelhos.

## Roteiro
| # | iPhone (cliente) | iPad (ajudante) |
|---|---|---|
| 1 | Home → **Pedir ajuda** → descreve, valor (cupom qualquer dá 10%; crédito R$ 10) → publicar | Desliza **ligar modo atender** |
| 2 | Tela "Aguardando alguém perto…" | Banner "Nova ajuda perto de você" + pino no mapa → **Aceitar** |
| 3 | Vai sozinho para o chat (~1s) | Tela do atendimento |
| 4 | Conversa → **Ir para pagamento** (Pix confirma sozinho em ~3s; cartão e dinheiro na hora) | Banner "Pagamento confirmado" → **Iniciar caminho** |
| 5 | Acompanha no mapa: o pin anda e o ETA cai (~25s) | **Cheguei, começar** → digita o código que aparece no iPhone (na demo qualquer código de 4 dígitos passa) |
| 6 | Banner "Ajuda concluída" → **Confirmar conclusão** → avaliação | **Terminei** → depois da confirmação, avaliação → carteira com o valor |

## Se algo der errado
- **Bolinha vermelha:** use **Reconectar ao outro aparelho**. Se não resolver, siga em frente, porque o modo roteiro assume em 5s.
- **Quer que um aparelho rode sozinho de propósito:** ligue **Forçar modo roteiro** no painel.
- **O app fechou no meio:** reabra. O estado fica salvo no aparelho e o outro também ressincroniza ao reconectar.
