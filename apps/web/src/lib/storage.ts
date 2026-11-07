import { env } from "@judeu/env/server";

import { supabase } from "./db";

// Upload de arquivos no Supabase Storage, via service role — o app nunca fala
// com o Supabase direto. Documento de KYC fica num bucket privado; foto de
// perfil (RF-A6) num bucket público, já que é exibida pra outros usuários.

const KYC_BUCKET = "kyc-documents";
const AVATAR_BUCKET = "avatars";

function requireStorage() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase Storage não configurado (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)");
  }
  return supabase;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export async function uploadKycDocument(
  userId: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const ext = MIME_EXT[mimeType];
  if (!ext) throw new Error("Formato de arquivo não suportado");

  const path = `${userId}/${Date.now()}.${ext}`;
  const bytes = Buffer.from(base64, "base64");

  const { error: uploadError } = await requireStorage()
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

export async function uploadAvatar(
  userId: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const ext = AVATAR_MIME_EXT[mimeType];
  if (!ext) throw new Error("Formato de imagem não suportado");

  const path = `${userId}/${Date.now()}.${ext}`;
  const bytes = Buffer.from(base64, "base64");

  const { error: uploadError } = await requireStorage()
    .storage.from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: true });

  if (uploadError) throw new Error(`Falha no upload da foto: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = requireStorage().storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return publicUrl;
}

/** Link temporário (10 min) para o admin ver um arquivo de KYC. */
export async function signedKycUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await requireStorage().storage.from(KYC_BUCKET).createSignedUrl(path, 600);
  if (error) {
    console.warn("[storage] link assinado falhou:", error.message);
    return null;
  }
  return data.signedUrl;
}

/** Remove arquivos de KYC (exclusão de conta / LGPD). */
export async function deleteKycFiles(paths: (string | null)[]): Promise<void> {
  const list = paths.filter((p): p is string => !!p);
  if (list.length === 0) return;
  const { error } = await requireStorage().storage.from(KYC_BUCKET).remove(list);
  if (error) console.warn("[storage] remoção de KYC falhou:", error.message);
}
