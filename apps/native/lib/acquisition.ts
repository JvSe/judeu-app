// Mesma lista de apps/web/src/lib/acquisition.ts ("Como conheceu o Ajuda+?").
export const ACQUISITION_OPTIONS = [
  { value: "indicacao", label: "Indicação de alguém" },
  { value: "condominio", label: "Condomínio / síndico" },
  { value: "redes_sociais", label: "Redes sociais" },
  { value: "panfleto", label: "Panfleto / cartaz" },
  { value: "parceiro_comercio", label: "Farmácia / mercado" },
  { value: "outro", label: "Outro" },
] as const;

export type AcquisitionChannel = (typeof ACQUISITION_OPTIONS)[number]["value"];
