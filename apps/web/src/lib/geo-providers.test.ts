import { describe, expect, it } from "vitest";

import { osrmBaseUrl } from "./geo";
import {
  googleRouteBody,
  osrmRouteUrl,
  parseGoogleGeocode,
  parseGoogleRoute,
  parseNominatim,
  parseOsrmRoute,
  parseValhallaRoute,
  valhallaRouteBody,
} from "./geo-providers";

const a = { lat: -10.18, lng: -48.33 };
const b = { lat: -10.2, lng: -48.35 };
// "_p~iF~ps|U" = (38.5, -120.2) em precisão 1e5; em 1e6 = (3.85, -12.02).
const POLY = "_p~iF~ps|U";

describe("osrmBaseUrl (compatibilidade)", () => {
  it("OSRM_URL tem prioridade", () => {
    expect(osrmBaseUrl({ OSRM_URL: "https://osrm.x/", VALHALLA_URL: "https://v.x" })).toBe("https://osrm.x");
  });
  it("sem OSRM_URL usa o VALHALLA_URL legado, como antes", () => {
    expect(osrmBaseUrl({ VALHALLA_URL: "https://router.project-osrm.org" })).toBe("https://router.project-osrm.org");
  });
  it("sem nada, OSRM público", () => {
    expect(osrmBaseUrl({})).toBe("https://router.project-osrm.org");
  });
});

describe("OSRM", () => {
  it("monta a URL lng,lat", () => {
    expect(osrmRouteUrl("https://o", a, b).toString()).toBe(
      "https://o/route/v1/driving/-48.33,-10.18;-48.35,-10.2?overview=full&geometries=polyline",
    );
  });
  it("converte metros/segundos e decodifica polyline 1e5", () => {
    const r = parseOsrmRoute({ code: "Ok", routes: [{ distance: 2500, duration: 400, geometry: POLY }] });
    expect(r.distanceKm).toBe(2.5);
    expect(r.durationMin).toBe(7);
    expect(r.points?.[0].lat).toBeCloseTo(38.5);
  });
  it("erro do OSRM vira exceção (o chamador cai na linha reta)", () => {
    expect(() => parseOsrmRoute({ code: "NoRoute" })).toThrow();
  });
});

describe("Valhalla", () => {
  it("corpo com lat/lon e carro", () => {
    expect(valhallaRouteBody(a, b)).toMatchObject({
      locations: [{ lat: -10.18, lon: -48.33 }, { lat: -10.2, lon: -48.35 }],
      costing: "auto",
    });
  });
  it("km/segundos e polyline 1e6", () => {
    const r = parseValhallaRoute({ trip: { summary: { length: 3.2, time: 610 }, legs: [{ shape: POLY }] } });
    expect(r.distanceKm).toBe(3.2);
    expect(r.durationMin).toBe(10);
    expect(r.points?.[0].lat).toBeCloseTo(3.85);
  });
  it("sem trip vira exceção", () => {
    expect(() => parseValhallaRoute({})).toThrow();
  });
});

describe("Google Routes", () => {
  it("corpo com latLng e DRIVE", () => {
    expect(googleRouteBody(a, b)).toMatchObject({
      origin: { location: { latLng: { latitude: -10.18, longitude: -48.33 } } },
      travelMode: "DRIVE",
    });
  });
  it("duration em '123s'", () => {
    const r = parseGoogleRoute({
      routes: [{ duration: "125s", distanceMeters: 1800, polyline: { encodedPolyline: POLY } }],
    });
    expect(r).toMatchObject({ distanceKm: 1.8, durationMin: 2 });
    expect(r.points?.[0].lat).toBeCloseTo(38.5);
  });
});

describe("geocodificação", () => {
  it("Nominatim", () => {
    expect(parseNominatim([{ lat: "-10.1", lon: "-48.3", display_name: "Palmas" }])).toEqual({
      lat: -10.1,
      lng: -48.3,
      displayName: "Palmas",
    });
    expect(parseNominatim([])).toBeNull();
  });
  it("Google: OK, ZERO_RESULTS e erro", () => {
    expect(
      parseGoogleGeocode({
        status: "OK",
        results: [{ formatted_address: "Q. 104 Norte", geometry: { location: { lat: -10.1, lng: -48.3 } } }],
      }),
    ).toEqual({ lat: -10.1, lng: -48.3, displayName: "Q. 104 Norte" });
    expect(parseGoogleGeocode({ status: "ZERO_RESULTS", results: [] })).toBeNull();
    expect(() => parseGoogleGeocode({ status: "REQUEST_DENIED" })).toThrow();
  });
});
