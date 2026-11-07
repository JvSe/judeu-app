-- Fase 5: modo família. O cliente cadastra um contato de confiança; cada pedido
-- novo ganha um link público de acompanhamento (shareToken) e o contato recebe
-- e-mails no aceite, na saída, na chegada e na conclusão.
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "trustedContactName" TEXT,
  ADD COLUMN IF NOT EXISTS "trustedContactEmail" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS order_sharetoken_key ON "order" ("shareToken");
