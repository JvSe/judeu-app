-- Fase 5: KYC v2 — selfie (câmera) e certidão de antecedentes, ao lado do
-- documento que já existia (documentUrl). Arquivos no bucket privado kyc-documents.
ALTER TABLE providerprofile
  ADD COLUMN IF NOT EXISTS "selfieUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "backgroundCheckUrl" TEXT;
