import { describe, expect, it } from "vitest";

import { pathForNotification } from "./notifications";

describe("pathForNotification", () => {
  it("sem orderId não navega pra lugar nenhum", () => {
    expect(pathForNotification({})).toBeNull();
    expect(pathForNotification({ type: "order", role: "client" })).toBeNull();
  });

  it("chat + role cliente -> chat do cliente", () => {
    expect(pathForNotification({ type: "chat", orderId: "abc", role: "client" })).toBe(
      "/client/chat/abc",
    );
  });

  it("chat + role prestador -> chat do prestador", () => {
    expect(pathForNotification({ type: "chat", orderId: "abc", role: "provider" })).toBe(
      "/provider/chat/abc",
    );
  });

  it("pedido + role cliente -> detalhe do pedido", () => {
    expect(pathForNotification({ type: "order", orderId: "abc", role: "client" })).toBe(
      "/client/order/abc",
    );
  });

  it("pedido + role prestador -> dashboard do prestador (sem tela de detalhe dedicada)", () => {
    expect(pathForNotification({ type: "order", orderId: "abc", role: "provider" })).toBe(
      "/provider",
    );
  });

  it("sem type reconhecido não navega", () => {
    expect(pathForNotification({ orderId: "abc", role: "client" })).toBeNull();
  });

  it("suporte + role cliente -> chamado do cliente (não depende de orderId)", () => {
    expect(pathForNotification({ type: "support", ticketId: "t1", role: "client" })).toBe(
      "/client/support-ticket/t1",
    );
  });

  it("suporte + role prestador -> chamado do prestador", () => {
    expect(pathForNotification({ type: "support", ticketId: "t1", role: "provider" })).toBe(
      "/provider/support-ticket/t1",
    );
  });

  it("suporte sem ticketId não navega", () => {
    expect(pathForNotification({ type: "support", role: "client" })).toBeNull();
  });
});
