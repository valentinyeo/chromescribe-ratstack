import { expect, it } from "@effect/vitest";
import { Clock, Effect } from "effect";
import { FetchHttpClient } from "effect/http";

import {
  accessGate,
  accessIssuer,
  accessVerifierLayer,
} from "../src/access-gate.js";
import type { AccessSettings } from "../src/access-gate.js";

const algorithm = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
};
const audience = "test-audience";
const on = { ACCESS_AUD: audience };

interface TestPayload {
  readonly aud: string | string[];
  readonly iss: string;
  readonly exp: number;
  readonly nbf?: number;
}

const fixture = Effect.fn("fixture")(function* fixture() {
  const pair = yield* Effect.promise(() =>
    crypto.subtle.generateKey(algorithm, true, ["sign", "verify"])
  );
  const other = yield* Effect.promise(() =>
    crypto.subtle.generateKey(algorithm, true, ["sign", "verify"])
  );
  const jwk = yield* Effect.promise(() =>
    crypto.subtle.exportKey("jwk", pair.publicKey)
  );
  const now = yield* Clock.currentTimeMillis;
  const good = { aud: [audience], iss: accessIssuer, exp: now / 1000 + 600 };
  const sign = Effect.fn("sign")(function* sign(
    payload: TestPayload,
    key = pair.privateKey,
    alg = "RS256",
    kid = "k1"
  ) {
    const head = Buffer.from(JSON.stringify({ alg, kid })).toString(
      "base64url"
    );
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = yield* Effect.promise(() =>
      crypto.subtle.sign(
        algorithm,
        key,
        new TextEncoder().encode(`${head}.${body}`)
      )
    );
    return `${head}.${body}.${Buffer.from(signature).toString("base64url")}`;
  });
  const gate = (token: string | null, settings: AccessSettings = on) =>
    accessGate(
      new Request("https://next.chromescribe.yeoux.net/api/transcripts", {
        headers: token ? { "Cf-Access-Jwt-Assertion": token } : {},
      })
    ).pipe(
      Effect.provide(accessVerifierLayer(settings)),
      Effect.provideService(FetchHttpClient.Fetch, () =>
        Promise.resolve(Response.json({ keys: [{ ...jwk, kid: "k1" }] }))
      )
    );
  return { pair, other, good, sign, gate, now };
});

it.effect(
  "accepts real RS256 Access assertions with array and string audiences",
  () =>
    Effect.gen(function* valid() {
      const { good, sign, gate } = yield* fixture();
      expect(yield* gate(yield* sign(good))).toBeNull();
      expect(yield* gate(yield* sign({ ...good, aud: audience }))).toBeNull();
    })
);

it.effect(
  "refuses missing, forged, foreign, expired and malformed assertions without CORS",
  () =>
    Effect.gen(function* refused() {
      const { good, sign, gate, other, now } = yield* fixture();
      const tokens = [
        null,
        "not.a.jwt",
        "bad",
        yield* sign(good, other.privateKey),
        yield* sign({ ...good, aud: ["wrong"] }),
        yield* sign({ ...good, iss: "https://evil.cloudflareaccess.com" }),
        yield* sign({ ...good, exp: now / 1000 }),
        yield* sign(good, undefined, "none"),
        yield* sign(good, undefined, "RS256", "unknown"),
      ];
      for (const token of tokens) {
        const response = yield* gate(token);
        expect(response?.status).toBe(401);
        expect(response?.headers.has("Access-Control-Allow-Origin")).toBe(
          false
        );
        expect(
          response ? yield* Effect.promise(() => response.json()) : null
        ).toEqual({ success: false, error: "Login required" });
      }
    })
);

it.effect(
  "fails closed without an audience, even when the switch is omitted",
  () =>
    Effect.gen(function* missingAudience() {
      const { good, sign, gate } = yield* fixture();
      const token = yield* sign(good);
      for (const settings of [
        {},
        { ACCESS_AUD: "" },
        { ACCESS_AUD: "   " },
        { CHRO10_API_GATE: "1" },
      ])
        expect((yield* gate(token, settings))?.status).toBe(401);
      expect(
        (yield* gate(null, { CHRO10_API_GATE: "unexpected" }))?.status
      ).toBe(401);
      expect(yield* gate(null, { CHRO10_API_GATE: "0" })).toBeNull();
    })
);

it.effect(
  "enforces not-before and fails closed when certificates are unavailable",
  () =>
    Effect.gen(function* notBefore() {
      const { good, sign, gate, now } = yield* fixture();
      const token = yield* sign({ ...good, nbf: now / 1000 + 60 });
      expect((yield* gate(token))?.status).toBe(401);
      const denied = yield* accessGate(
        new Request("https://next.chromescribe.yeoux.net/rpc", {
          headers: { "Cf-Access-Jwt-Assertion": yield* sign(good) },
        })
      ).pipe(
        Effect.provide(accessVerifierLayer(on)),
        Effect.provideService(FetchHttpClient.Fetch, () =>
          Promise.resolve(new Response("unavailable", { status: 503 }))
        )
      );
      expect(denied?.status).toBe(401);
    })
);
