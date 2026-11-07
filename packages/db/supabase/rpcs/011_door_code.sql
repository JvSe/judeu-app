-- Fase 5: código de chegada ("código na porta"). Gerado no aceite; quem atende
-- digita o código que o cliente vê para iniciar o serviço. Pedidos antigos ficam
-- com NULL e seguem sem código.
ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS "doorCode" TEXT,
  ADD COLUMN IF NOT EXISTS "doorCodeAttempts" INT NOT NULL DEFAULT 0;
