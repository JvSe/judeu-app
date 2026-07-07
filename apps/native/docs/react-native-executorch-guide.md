# Guia Completo: React Native ExecuTorch (LLM on-device) em Expo/React Native

> **Nota de precisão**: este guia foi escrito com base na documentação oficial (Software Mansion — `docs.swmansion.com/react-native-executorch`, o [repo no GitHub](https://github.com/software-mansion/react-native-executorch) e o [pacote no npm](https://www.npmjs.com/package/react-native-executorch)). A API dessa lib evolui rápido e já mudou entre versões (ex.: `contextWindowLength` → `contextStrategy`, e um novo catálogo `models.llm.xxx()`). O código abaixo usa o estilo de API das versões `0.2.x`/`0.3.x` (`configure({ systemPrompt, contextWindowLength })`, `sendMessage`, `messageHistory`). Antes de instalar, confira a [tabela de compatibilidade](https://docs.swmansion.com/react-native-executorch/docs/next/other/compatibility) para a versão exata que for usar.
>
> Este projeto (`apps/native`) já roda **Expo SDK 56 + RN 0.85.3 + `expo-dev-client`**, então boa parte dos pré-requisitos de arquitetura já está resolvida (Nova Arquitetura é padrão desde o SDK 52).

---

## 1. Pré-requisitos

### 1.1 Versões mínimas
| Item | Mínimo exigido |
|---|---|
| React Native | Nova Arquitetura obrigatória (não há suporte para arquitetura antiga) |
| iOS | **17.0** |
| Android | **API 33 (Android 13)** |
| Expo Go | Não suportado (a lib usa módulos nativos) |

### 1.2 Nova Arquitetura
Desde o Expo SDK 52, a Nova Arquitetura é padrão — este projeto (SDK 56) já está nela por padrão. Se fosse necessário forçar manualmente (projeto mais antigo), o plugin seria `expo-build-properties`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-build-properties",
        {
          "ios": { "newArchEnabled": true },
          "android": { "newArchEnabled": true }
        }
      ]
    ]
  }
}
```

Em projeto bare (sem Expo), habilite a nova arquitetura no `android/gradle.properties` (`newArchEnabled=true`) e no `ios/Podfile` (`ENV['RCT_NEW_ARCH_ENABLED'] = '1'`).

### 1.3 Requisitos de plataforma
- **iOS**: eleve o deployment target para **17.0** no `app.json` (via `expo-build-properties`) ou direto no Xcode/Podfile em projeto bare.
- **Android**: `minSdkVersion` **33**.
- **iOS release**: só roda em **dispositivo físico** — build de release não funciona no Simulator (limitação do runtime do ExecuTorch, que depende de aceleração nativa não disponível no simulador).

```json
{
  "expo": {
    "plugins": [
      [
        "expo-build-properties",
        {
          "ios": { "newArchEnabled": true, "deploymentTarget": "17.0" },
          "android": { "newArchEnabled": true, "minSdkVersion": 33 }
        }
      ]
    ]
  }
}
```

### 1.4 Preparando o projeto Expo (custom dev client)
Como a lib tem código nativo, **Expo Go não funciona**. É necessário um **Custom Development Build**:

```bash
npx expo install expo-dev-client
npx expo prebuild --clean   # gera os diretórios ios/ e android/ nativos
```

Neste projeto, `expo-dev-client` já está instalado — falta apenas rodar o `prebuild` depois de instalar o ExecuTorch.

---

## 2. Instalação passo a passo

### 2.1 Instalar o pacote principal
A instalação tem **dois pacotes**: o core + um "resource fetcher adapter" que depende do tipo de projeto (Expo ou bare).

```bash
# dentro de apps/native
pnpm add react-native-executorch
```

### 2.2 Instalar o adapter (Expo)

```bash
pnpm add react-native-executorch-expo-resource-fetcher expo-file-system expo-asset
```

> Em projeto **bare RN** (sem Expo), o adapter é outro:
> ```bash
> pnpm add react-native-executorch-bare-resource-fetcher @dr.pogodin/react-native-fs @kesha-antonov/react-native-background-downloader
> ```

### 2.3 Inicializar o adapter na entrada do app
Obrigatório — sem isso a lib lança `ResourceFetcherAdapterNotInitialized`. Coloque no ponto de entrada (`app/_layout.tsx`), antes de qualquer hook do ExecuTorch ser usado:

```tsx
// apps/native/app/_layout.tsx (topo do arquivo, fora do componente)
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

initExecutorch(ExpoResourceFetcher);
```

### 2.4 Config plugin / `app.json`
Adicione o `expo-build-properties` (ver seção 1.3) e garanta que o `metro.config.js` reconheça as extensões dos modelos, caso o modelo/tokenizer seja empacotado como asset local:

```js
// apps/native/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('pte', 'bin');

module.exports = config;
```

### 2.5 Gerar os projetos nativos e buildar

```bash
npx expo prebuild --clean
```

**Android**:
```bash
npx expo run:android
```

**iOS** (necessário Xcode instalado, `pod install` roda automaticamente):
```bash
npx expo run:ios
```

### 2.6 Build com EAS (recomendado para times)
Como não dá para usar Expo Go, gere um **development build** via EAS:

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

No `eas.json`, garanta que o perfil `development` tenha `"developmentClient": true`. Para iOS, use um perfil que gere build para **dispositivo físico** (não simulator) ao testar o modelo de verdade.

### 2.7 Permissões específicas
Não há permissões de sistema operacional extras exigidas só pelo `useLLM`. Se for baixar o modelo de uma URL remota (HuggingFace), basta acesso à internet (padrão, sem permissão extra no Android/iOS modernos). Se for usar hooks de imagem (`useClassification`, `useImageEmbed`, OCR), aí sim são necessárias permissões de câmera/galeria (`expo-image-picker`/`expo-camera`, com `NSCameraUsageDescription`/`android.permission.CAMERA` no `app.json`).

---

## 3. Adicionando o modelo (Llama 3.2 1B SpinQuant)

O ExecuTorch usa o formato **`.pte`** (Portable Executable), gerado a partir da exportação do modelo PyTorch. A Software Mansion disponibiliza modelos populares **pré-convertidos**, incluindo Llama 3.2 1B/3B nas variantes **QLoRA** e **SpinQuant**.

### 3.1 Opção recomendada: constante pronta (download remoto)
A lib expõe constantes que apontam para pesos hospedados no HuggingFace e cuidam do download/cache automaticamente:

```tsx
import {
  useLLM,
  LLAMA3_2_1B_SPINQUANT,
  LLAMA3_2_TOKENIZER,
  LLAMA3_2_TOKENIZER_CONFIG,
} from 'react-native-executorch';

const llm = useLLM({
  modelSource: LLAMA3_2_1B_SPINQUANT,
  tokenizerSource: LLAMA3_2_TOKENIZER,
  tokenizerConfigSource: LLAMA3_2_TOKENIZER_CONFIG,
});
```

No primeiro uso, o app baixa o `.pte` (algumas centenas de MB) e guarda em cache local — acompanhe com `llm.downloadProgress`.

> **Versões mais recentes** substituíram essas constantes soltas por um catálogo: `models.llm.llama3_2_1b_spinquant()` (ou modelo equivalente disponível), passado como `{ model: ... }` em vez de `modelSource`/`tokenizerSource` separados. Confira o nome exato na documentação de modelos da versão instalada.

### 3.2 Opção: empacotar o modelo local como asset
Só recomendado para modelos pequenos (limite de ~512MB para assets do RN):

```
apps/native/
  assets/
    models/
      llama-3-2-1b-spinquant.pte
      tokenizer.bin
```

```tsx
const llm = useLLM({
  modelSource: require('../assets/models/llama-3-2-1b-spinquant.pte'),
  tokenizerSource: require('../assets/models/tokenizer.bin'),
});
```

Lembre-se do passo 2.4 (`metro.config.js` reconhecendo `.pte`/`.bin`), senão o Metro não empacota o arquivo corretamente.

### 3.3 Opção: modelo próprio convertido
Para converter um modelo PyTorch customizado para `.pte`, use o pipeline de exportação do [ExecuTorch (PyTorch/Meta)](https://github.com/pytorch/executorch) — normalmente via o script `export_llama` do repositório `pytorch/executorch`, aplicando quantização (ex.: `int4`, SpinQuant, QLoRA) antes de exportar. Isso é feito fora do RN, em Python, gerando o `.pte` referenciado como acima.

---

## 4. Exemplo completo de app de chat (Expo + TypeScript)

Usando Expo Router (padrão deste projeto) e a API "estilo vídeo" (`configure`, `sendMessage`, `messageHistory`).

```tsx
// apps/native/app/(chat)/index.tsx
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import {
  useLLM,
  LLAMA3_2_1B_SPINQUANT,
  LLAMA3_2_TOKENIZER,
  LLAMA3_2_TOKENIZER_CONFIG,
} from 'react-native-executorch';

const SYSTEM_PROMPT =
  'Você é um assistente que responde sempre em português do Brasil, ' +
  'de forma clara, direta e concisa. Evite respostas muito longas.';

export default function ChatScreen() {
  const llm = useLLM({
    modelSource: LLAMA3_2_1B_SPINQUANT,
    tokenizerSource: LLAMA3_2_TOKENIZER,
    tokenizerConfigSource: LLAMA3_2_TOKENIZER_CONFIG,
  });

  const [input, setInput] = useState('');
  const [configured, setConfigured] = useState(false);

  // Configura o modelo assim que ele termina de carregar
  useEffect(() => {
    if (llm.isReady && !configured) {
      llm.configure({
        chatConfig: {
          systemPrompt: SYSTEM_PROMPT,
          contextWindowLength: 6, // quantas mensagens da conversa o modelo "lembra"
        },
      });
      setConfigured(true);
    }
  }, [llm.isReady, configured]);

  const handleSendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return; // não envia mensagem vazia
    if (llm.isGenerating) return; // não deixa enviar enquanto já está gerando

    setInput('');
    try {
      await llm.sendMessage(trimmed);
    } catch (err) {
      console.error('Erro ao gerar resposta do modelo:', err);
    }
  }, [input, llm]);

  // --- Estados de carregamento inicial do modelo ---
  if (llm.error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          Erro ao carregar o modelo: {llm.error}
        </Text>
      </View>
    );
  }

  if (!llm.isReady) {
    const progress = Math.round((llm.downloadProgress ?? 0) * 100);
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>
          Carregando modelo local... {progress}%
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={llm.messageHistory}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={styles.messagesList}
        renderItem={({ item }) => renderMessage(item)}
      />

      {llm.isGenerating && (
        <View style={styles.processingRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.processingText}>Processando resposta...</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Digite sua mensagem..."
          editable={!llm.isGenerating}
          onSubmitEditing={handleSendMessage}
          returnKeyType="send"
        />
        <Pressable
          style={[
            styles.sendButton,
            (llm.isGenerating || !input.trim()) && styles.sendButtonDisabled,
          ]}
          onPress={handleSendMessage}
          disabled={llm.isGenerating || !input.trim()}
        >
          <Text style={styles.sendButtonText}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function renderMessage(message: { role: string; content: string }) {
  const isUser = message.role === 'user';
  return (
    <View
      style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.assistantBubble,
      ]}
    >
      <Text style={isUser ? styles.userText : styles.assistantText}>
        {message.content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#555' },
  errorText: { color: '#c0392b', textAlign: 'center' },
  messagesList: { padding: 16, gap: 8 },
  bubble: { padding: 12, borderRadius: 12, marginBottom: 8, maxWidth: '80%' },
  userBubble: { backgroundColor: '#2563eb', alignSelf: 'flex-end' },
  assistantBubble: { backgroundColor: '#e5e7eb', alignSelf: 'flex-start' },
  userText: { color: '#fff' },
  assistantText: { color: '#111' },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  processingText: { fontSize: 12, color: '#666' },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#9ca3af' },
  sendButtonText: { color: '#fff', fontWeight: '600' },
});
```

Não esqueça de rodar `initExecutorch(ExpoResourceFetcher)` uma vez no `_layout.tsx` raiz (seção 2.3), fora desse componente de chat.

### Outros hooks disponíveis (mesmo pacote)
- `useClassification` — classificação de imagens.
- `useImageEmbed` — embeddings visuais (útil para busca por similaridade).
- Hook de OCR — reconhecimento de texto em imagens.
- Também existem hooks de detecção de objetos e STT/TTS dependendo da versão instalada — vale conferir a lista completa na doc antes de assumir que um hook específico existe na versão instalada.

---

## 5. Boas práticas e limitações

- **RAM e tamanho do modelo**: prefira sempre variantes quantizadas (SpinQuant ou QLoRA em vez do modelo "cheio"). Um 1B quantizado roda razoavelmente em celulares de gama média-alta; 3B já exige mais RAM e dispositivos mais robustos — teste em hardware real, não só no simulador/emulador.
- **Bateria**: inferência local usa CPU/NPU intensamente. Evite gerar respostas muito longas continuamente e considere limitar `contextWindowLength`/tokens gerados por resposta.
- **UX obrigatória para 3 estados**:
  1. **Carregando o modelo** (`!llm.isReady`) — mostre progresso de download (`llm.downloadProgress`), já que o primeiro carregamento pode baixar centenas de MB.
  2. **Gerando resposta** (`llm.isGenerating`) — bloqueie o input e mostre indicador de "processando".
  3. **Erro** (`llm.error`) — trate falhas de carregamento/geração com mensagem clara, sem deixar a tela travada em loading infinito.
- **Um `useLLM` por vez**: recomenda-se ter apenas uma instância ativa do hook rodando por vez (limitação de runtime nativo) — não instanciar o hook em múltiplas telas simultâneas.
- **Dev build vs release**: durante o desenvolvimento, use `expo run:ios`/`expo run:android` com o dev client (hot reload de JS funciona, mas o binário nativo precisa ser reconstruído sempre que a lib nativa mudar). Em **release**, no iOS, só funciona em dispositivo físico — nunca validar a feature apenas no simulador antes de publicar.
- **Contexto de conversa**: quanto maior o `contextWindowLength` (ou `contextStrategy` em versões novas), mais memória e latência — ajustar conforme o dispositivo alvo, não maximizar por padrão.

---

## 6. Erros comuns e como resolver

| Erro | Causa provável | Solução |
|---|---|---|
| App trava/crasha ao abrir com "Invariant Violation" ou módulo nativo não encontrado | Rodando no **Expo Go** | Expo Go não suporta módulos nativos custom — gerar um **custom dev client** (`expo prebuild` + `expo run:ios`/`run:android` ou build via EAS) |
| `ResourceFetcherAdapterNotInitialized` | Esqueceu de chamar `initExecutorch(...)` no entry point | Adicionar a chamada no topo do `_layout.tsx`/`index.js`, antes de qualquer hook do ExecuTorch ser usado |
| Erro de build Android tipo "New Architecture required"/crash nativo relacionado a Fabric/TurboModules | Projeto ainda na arquitetura antiga | Habilitar `newArchEnabled: true` via `expo-build-properties` (ou `gradle.properties`/`Podfile` em bare) e rodar `prebuild --clean` de novo |
| Build iOS falha ou app não roda no Simulator em modo release | Limitação conhecida: builds de release do ExecuTorch só rodam em dispositivo físico no iOS | Testar release apenas em device físico; usar debug/dev build no simulador só para telas que não dependem do modelo |
| `minSdkVersion`/deployment target incompatível (build falha citando versão mínima) | Android abaixo de 13 ou iOS abaixo de 17 configurado no projeto | Ajustar `minSdkVersion: 33` e `deploymentTarget: "17.0"` via `expo-build-properties`, refazer o `prebuild` |
| Metro não encontra/`require` do `.pte` falha ("Unable to resolve module") | Extensão de asset não registrada | Adicionar `'pte'` e `'bin'` em `resolver.assetExts` no `metro.config.js` (seção 2.4) |
| App trava/OOM ao carregar modelo maior (3B) | RAM insuficiente no device de teste | Usar variante 1B quantizada para dispositivos de teste, ou testar em device com mais RAM; monitorar com Xcode Instruments/Android Profiler |
| `pod install` falha no iOS após instalar a lib | Cache de pods desatualizado após adicionar módulo nativo | Rodar `cd ios && pod install --repo-update` ou refazer `expo prebuild --clean` |
| Hook `useLLM` "trava" em `isReady: false` para sempre | Download do modelo falhou silenciosamente (sem internet na primeira execução, ou URL indisponível) | Verificar `llm.error` e `llm.downloadProgress`; garantir conectividade no primeiro uso já que o `.pte` precisa ser baixado |

---

### Fontes consultadas
- [Getting Started — React Native ExecuTorch](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/getting-started)
- [useLLM hook (docs `next`)](https://docs.swmansion.com/react-native-executorch/docs/next/hooks/natural-language-processing/useLLM)
- [Running LLMs (docs `0.1.x`)](https://docs.swmansion.com/react-native-executorch/docs/0.1.x/guides/running-llms)
- [Loading Models](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/loading-models)
- [FAQ](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/frequently-asked-questions)
- [README do repositório GitHub](https://github.com/software-mansion/react-native-executorch/blob/main/README.md)
- [react-native-executorch-llama-3.2 (HuggingFace)](https://huggingface.co/software-mansion/react-native-executorch-llama-3.2)
