import { createClient } from "@supabase/supabase-js";
import { env } from "@judeu/env/server";

// Upload de arquivos no Supabase Storage, via service role — o app nunca fala
// com o Supabase direto. Documento de KYC fica num bucket privado; foto de
// perfil (RF-A6) num bucket público, já que é exibida pra outros usuários.

const KYC_BUCKET = "kyc-documents";
const AVATAR_BUCKET = "avatars";

let client: ReturnType<typeof createClient> | null = null;

function storageClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase Storage não configurado (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)");
  }
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return client;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// Recebe o documento em base64 (sem o prefixo data-url), salva no bucket
// privado do prestador e retorna o path do objeto (não uma URL pública).
export async function uploadKycDocument(
  userId: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const ext = MIME_EXT[mimeType];
  if (!ext) throw new Error("Formato de arquivo não suportado");

  const path = `${userId}/${Date.now()}.${ext}`;
  const bytes = Buffer.from(base64, "base64");

  const { error: uploadError } = await storageClient()
    .storage.from(KYC_BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: true });

  if (uploadError) throw new Error(`Falha no upload do documento: ${uploadError.message}`);
  return path;
}

const AVATAR_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Recebe a foto em base64, salva no bucket público de avatares e retorna a
// URL pública (diferente do KYC — a foto de perfil é vista por outros usuários).
export async function uploadAvatar(
  userId: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const ext = AVATAR_MIME_EXT[mimeType];
  if (!ext) throw new Error("Formato de imagem não suportado");

  const path = `${userId}/${Date.now()}.${ext}`;
  const bytes = Buffer.from(base64, "base64");

  const { error: uploadError } = await storageClient()
    .storage.from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: true });

  if (uploadError) throw new Error(`Falha no upload da foto: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = storageClient().storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return publicUrl;
}
