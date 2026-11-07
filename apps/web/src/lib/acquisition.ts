import { z } from "zod";

// Canais da pergunta "Como conheceu o Ajuda+?" no cadastro (mesma lista no app).
export const ACQUISITION_CHANNELS = [
  "indicacao",
  "condominio",
  "redes_sociais",
  "panfleto",
  "parceiro_comercio",
  "outro",
] as const;

export const acquisitionSchema = {
  acquisitionChannel: z.enum(ACQUISITION_CHANNELS).optional(),
  acquisitionCode: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v.toUpperCase())
    .optional(),
};
