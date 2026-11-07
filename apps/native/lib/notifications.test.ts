import { describe, expect, it } from "vitest";

import { pathForNotification } from "./notifications";

describe("pathForNotification", () => {
  it("sem orderId não navega pra lugar nenhum", () => {
    expect(pathForNotification({})).toBeNull();
    expect(pathForNotification({ type: "order", role: "client" })).toBeNull();
  });

  it("chat -> chat da chamada, qualquer lado", () => {
    expect(pathForNotification({ type: "chat", orderId: "abc", role: "client" })).toBe(
      "/client/chat/abc",
    );
    expect(pathForNotification({ type: "chat", orderId: "abc", role: "provider" })).toBe(
      "/client/chat/abc",
    );
  });

  it("pedido + role cliente -> pagamento", () => {
    expect(pathForNotification({ type: "order", orderId: "abc", role: "client" })).toBe(
      "/client/payment/abc",
    );
  });

  it("pedido + role de quem atende -> mapa da chamada", () => {
    expect(pathForNotification({ type: "order", orderId: "abc", role: "provider" })).toBe(
      "/client/attend/abc",
    );
  });

  it("sem type reconhecido não navega", () => {
    expect(pathForNotification({ orderId: "abc", role: "client" })).toBeNull();
  });

  it("suporte -> chamado (não depende de orderId nem do lado)", () => {
    expect(pathForNotification({ type: "support", ticketId: "t1", role: "client" })).toBe(
      "/client/support-ticket/t1",
    );
    expect(pathForNotification({ type: "support", ticketId: "t1", role: "provider" })).toBe(
      "/client/support-ticket/t1",
    );
  });

  it("suporte sem ticketId não navega", () => {
    expect(pathForNotification({ type: "support", role: "client" })).toBeNull();
  });

  it("vaga: empresa vê candidatos, candidato vê a vaga", () => {
    expect(pathForNotification({ type: "job", jobId: "j1", role: "provider" })).toBe(
      "/client/vaga/applicants/j1",
    );
    expect(pathForNotification({ type: "job", jobId: "j1", role: "candidate" })).toBe("/jobs/j1");
    expect(pathForNotification({ type: "job", role: "candidate" })).toBeNull();
  });

  it("status do cadastro de quem atende -> perfil", () => {
    expect(pathForNotification({ type: "provider_status" })).toBe("/client/profile");
  });
});
