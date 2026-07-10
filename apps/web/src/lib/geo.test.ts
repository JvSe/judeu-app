import { describe, expect, it } from "vitest";

import { decodePolyline6 } from "./geo";

describe("decodePolyline6", () => {
  it("decodifica string vazia como lista vazia", () => {
    expect(decodePolyline6("")).toEqual([]);
  });

  it("decodifica um ponto na origem (0,0)", () => {
    // encodeValue(0) = "?" (chunk único, char code 63) — dois deltas zerados = "??".
    expect(decodePolyline6("??")).toEqual([{ lat: 0, lng: 0 }]);
  });

  it("decodifica o exemplo canônico do algoritmo de polyline (Google), ajustado pra precisão 1e6", () => {
    // Exemplo oficial (precisão 1e5) decodifica pra:
    //   (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
    // decodePolyline6 usa precisão 1e6 (1 casa decimal a mais), então o mesmo
    // encoded string produz os mesmos dígitos com a vírgula uma casa pra esquerda.
    const encoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
    const points = decodePolyline6(encoded);

    expect(points).toHaveLength(3);
    expect(points[0].lat).toBeCloseTo(3.85, 6);
    expect(points[0].lng).toBeCloseTo(-12.02, 6);
    expect(points[1].lat).toBeCloseTo(4.07, 6);
    expect(points[1].lng).toBeCloseTo(-12.095, 6);
    expect(points[2].lat).toBeCloseTo(4.3252, 6);
    expect(points[2].lng).toBeCloseTo(-12.6453, 6);
  });

  it("acumula deltas negativos corretamente (lat/lng decrescendo entre pontos)", () => {
    const encoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
    const points = decodePolyline6(encoded);

    // O 2º e 3º pontos se movem pra sudoeste em relação ao anterior.
    expect(points[1].lng).toBeLessThan(points[0].lng);
    expect(points[2].lng).toBeLessThan(points[1].lng);
  });
});
