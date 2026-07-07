# Planejamento — Busca por IA conversacional (on-device)

> Funcionalidade central do Ajuda+ (RF-J). Este documento registra a **decisão de
> arquitetura**, o **desenho da solução**, o que **já foi implementado** e o **handoff**
> para colocar em pé num device. Complementa o [guia técnico do ExecuTorch](./react-native-executorch-guide.md).

---

## 1. Decisão de arquitetura

A busca de serviço do Ajuda+ é feita por uma **IA conversacional**: o usuário descreve em
linguagem natural o que precisa e a IA devolve os prestadores certos. Havia três caminhos:

| Opção | O que é | Veredito |
|---|---|---|
| **Híbrido on-device + backend** ✅ | LLM roda no aparelho (conversa + intenção); o *matching* usa dados reais do Supabase via a API de catálogo já existente. | **Escolhido.** |
| On-device puro | Só o LLM no aparelho gerando texto. | Rejeitado — não consulta o Supabase, então **inventaria** prestadores (quebra o RF-J4). |
| Claude via API | Servidor chama Claude com function calling sobre o Supabase. | Rejeitado por ora — exige chave Anthropic + custo por request. |

**Por que o híbrido:** honra o requisito central (**RF-J4 — "não inventa prestadores"**),
**dispensa chave de LLM e custo de servidor**, e **reaproveita o backend de catálogo já pronto**.
O modelo roda 100% no dispositivo; a única ida à rede é a consulta de prestadores (que já era autenticada).

---

## 2. Como funciona (fluxo)

```
Usuário descreve o problema
        │  "tem um vazamento na pia da cozinha"
        ▼
Qwen3 1.7B (no aparelho)  ── conversa/esclarece em pt-BR (RF-J1..J3)
        │  decide chamar a tool
        ▼
tool  buscar_prestadores({ categoria: "reparos", termo: "vazamento" })
        │  (function calling nativo do ExecuTorch — executeToolCallback)
        ▼
App resolve slug→categoryId  →  catalogApi.providers(categoryId)   ← DADOS REAIS (Supabase, RF-J4)
        │
        ├─► devolve resumo textual ao modelo  → IA apresenta em 1 frase (RF-J5)
        └─► seta estado → renderiza CARDS reais de prestador na conversa
                                   │  ver perfil / contratar (liga em RF-D1/RF-C3)
```

O modelo **não resolve a tool** — quem executa é o app, com uma consulta real. Assim a IA
nunca fabrica nome, nota ou preço.

---

## 3. Stack / escolhas técnicas

- **Runtime:** [`react-native-executorch@0.9.2`](https://www.npmjs.com/package/react-native-executorch) (Software Mansion) — LLM on-device via ExecuTorch (PyTorch/Meta).
- **Modelo padrão:** **Qwen3 1.7B quantizado** (`QWEN3_1_7B_QUANTIZED`) — bom multilíngue (pt-BR) e **suporta tool calling**. Alternativas fáceis de trocar em `AI_MODEL`:
  - `QWEN3_0_6B_QUANTIZED` — aparelhos mais fracos.
  - `HAMMER2_1_1_5B_QUANTIZED` — prioriza **precisão de function calling** sobre conversa.
- **Function calling:** API nativa `toolsConfig.executeToolCallback` do ExecuTorch 0.9.2 (equivalente on-device ao *tool use* do RF-J4).
- **Adapter de download:** `react-native-executorch-expo-resource-fetcher` + `expo-file-system`/`expo-asset` (alinhados ao **SDK 56** via `expo install`).

> ⚠️ A API do ExecuTorch mudou bastante entre versões. O código foi escrito contra a
> **0.9.2 verificada nos `.d.ts` instalados** (`initExecutorch({ resourceFetcher })`,
> `useLLM({ model })`, `configure({ chatConfig, toolsConfig })`). Ao atualizar a lib, reconferir esses nomes.

---

## 4. O que já foi implementado

### Config nativa
- **`app.json`** — plugin `expo-build-properties` (iOS `deploymentTarget 17.0`, Android `minSdkVersion 33`).
- **`metro.config.js`** — reconhece `.pte`/`.bin` (para o caso de modelo empacotado como asset).
- **`app/_layout.tsx`** — `initAssistant()` no topo, que chama `initExecutorch({ resourceFetcher: ExpoResourceFetcher })` **guardado** (não derruba Expo Go/web).

### App
- **[`lib/assistant.ts`](../lib/assistant.ts)** — init guardado, `aiAvailable()`, `buildSystemPrompt()` (com as categorias reais injetadas), `buildSearchTool()` (schema da tool), `resolveCategoryId()` (tolera acento/caixa).
- **[`components/ai-assistant.tsx`](../components/ai-assistant.tsx)** — chat com `useLLM`:
  - os **3 estados obrigatórios** do guia: carregando/baixando (com `downloadProgress`), gerando (input bloqueado + streaming), erro;
  - cards de prestador reais dentro da conversa;
  - **chips de categoria como fallback determinístico** (RF-J7) — buscam direto no catálogo sem depender do modelo.
- **[`app/client/(tabs)/explore.tsx`](../app/client/(tabs)/explore.tsx)** — vira o assistente quando o runtime nativo existe; senão cai no **grid de categorias tradicional (RF-C4)** com aviso, mantendo o app rodável em Expo Go.

### Cobertura de requisitos
✅ RF-J1 (chat), J2/J3 (conversa/intenção), **J4 (matching sobre dados reais do Supabase)**, J5 (cards na conversa), J7 (fallback tradicional).
⏳ J6 (histórico entre sessões), J8 (multimodal/foto), J9 (guardrails) — P1/P2, fora deste incremento.

---

## 5. Estados de UX (obrigatórios)

| Estado | Sinal | UI |
|---|---|---|
| Carregando modelo | `!llm.isReady` | spinner + progresso de download (primeiro uso baixa centenas de MB) |
| Gerando resposta | `llm.isGenerating` | input desabilitado + bolha em streaming / "Pensando…" |
| Erro | `llm.error` | mensagem clara, sem travar em loading infinito |

---

## 6. Handoff — colocar em pé no device

O `useLLM` usa **módulo nativo**, então **Expo Go não funciona** — é preciso um **dev build**:

```bash
cd apps/native
npx expo prebuild --clean
npx expo run:android          # ou run:ios (device físico — release iOS não roda no Simulator)
```

- **Primeiro uso** baixa o `.pte` do Qwen3 (~centenas de MB) e guarda em cache.
- **iOS:** deployment target 17.0; release só em **device físico**.
- **Android:** `minSdkVersion` 33.
- Antes de prebuild, sem o binário nativo o app mostra o **fallback tradicional** (grid de categorias) — comportamento esperado.

### Verificação em device (o que validar)
1. Modelo baixa e fica `isReady` (acompanhar `downloadProgress`).
2. Descrever um serviço → a IA conversa em pt-BR e **chama a tool**.
3. Os cards que aparecem são **prestadores reais do Supabase** (mesmos nomes/notas do catálogo).
4. Tocar num card abre o perfil do prestador.
5. Chips de categoria (fallback) buscam mesmo sem o modelo disparar a tool.
6. Avaliar a **qualidade do function calling** do Qwen3 1.7B; se falhar muito, trocar `AI_MODEL` para Hammer 2.1.

---

## 7. Pendências e evolução

- **Ranqueamento por proximidade** (RF-J4 "mais próximos" / RF-C5): hoje ordena por `ratingAvg` (backend). "Mais próximo" entra junto com o **Valhalla** no bloco de geo.
- **Histórico/memória entre sessões** (RF-J6), **multimodal — foto do problema** (RF-J8, usa `useLLM` com capability `vision` ou os hooks de visão da mesma lib) e **voz** (STT) — P1/P2.
- **Guardrails/escopo** do assistente (RF-J9) — P2.
- **Custo de bateria/RAM:** inferência local é intensiva; manter respostas curtas e o `contextStrategy` enxuto; testar em hardware real, não só emulador.
