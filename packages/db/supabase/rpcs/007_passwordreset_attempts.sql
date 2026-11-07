-- Fase 1 (QA C-01 cliente): limite de tentativas por código de recuperação.
ALTER TABLE passwordresettoken
  ADD COLUMN IF NOT EXISTS "attempts" INT NOT NULL DEFAULT 0;
