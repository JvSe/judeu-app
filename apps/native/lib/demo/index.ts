// Modo Apresentação — ponto de entrada.
// Quando um dos dois usuários demo está logado, toda chamada da API é respondida
// localmente (routes.ts) e sincronizada com o outro aparelho via Multipeer (sync.ts).
export { demoHandle } from "./routes";
export { isDemoActive, demoUserId } from "./session";
export {
  demoReset,
  demoStatus,
  onDemoRefresh,
  onDemoStatus,
  reconnectPeer,
  setForceScript,
  type DemoStatus,
} from "./sync";
export { clientHomeAddress, helperStartPoint, DEMO_HELPER_ID } from "./fixtures";
