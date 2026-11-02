export { toast, Toaster } from "@/components/ui/molecules/Toast";

/** Mensagem principal de erro a partir de unknown/Error. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
