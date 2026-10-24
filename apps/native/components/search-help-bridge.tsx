import { useEffect } from "react";

import { useSiri } from "@/components/ui/organisms/apple-intelligence/context";
import type { ISiriContext } from "@/components/ui/organisms/apple-intelligence/types";

/** Expõe o contexto Siri para o pai via callback (padrão do showcase Reacticx). */
export function SearchHelpBridge({
  onReady,
}: {
  onReady: (ctx: ISiriContext) => void;
}) {
  const siri = useSiri();
  useEffect(() => {
    onReady(siri);
  }, [siri, onReady]);
  return null;
}
