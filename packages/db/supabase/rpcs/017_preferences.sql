-- Fase 5: preferências do idoso. Quem pede pode exigir nota mínima, número
-- mínimo de tarefas concluídas e gênero de quem atende (gênero é opcional e
-- informado pela própria pessoa).
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "gender" TEXT CHECK ("gender" IN ('F', 'M', 'OTHER'));
ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS "prefMinRating" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "prefMinCompleted" INT,
  ADD COLUMN IF NOT EXISTS "prefGender" TEXT CHECK ("prefGender" IN ('F', 'M'));
