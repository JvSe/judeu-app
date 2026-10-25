import "@judeu/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  // pg só carrega pg-cloudflare dentro do Worker. O tracer do Next copia o
  // package.json e o dist/empty.js, e o esbuild do OpenNext procura dist/index.js.
  serverExternalPackages: ["pg-cloudflare"],
  outputFileTracingIncludes: {
    "**/*": [
      "./node_modules/pg-cloudflare/dist/**/*",
      "./node_modules/pg-cloudflare/esm/**/*",
    ],
  },
};

export default nextConfig;
