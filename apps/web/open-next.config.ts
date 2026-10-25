import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig(),
  // O script `build` do package.json é o próprio adapter. Sem isso, o OpenNext
  // roda `pnpm build` e entra em loop chamando a si mesmo.
  buildCommand: "pnpm exec next build",
};
