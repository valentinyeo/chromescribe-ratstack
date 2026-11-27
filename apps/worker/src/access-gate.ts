import { AccessVerifier } from "@chromescribe/core";
import { Clock, Effect, Exit, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/http";

export const accessIssuer = "https://vwo-analyzer.cloudflareaccess.com";
export const accessCertsUrl = `${accessIssuer}/cdn-cgi/access/certs`;

export interface AccessSettings {
  readonly CHRO10_API_GATE?: string;
  readonly ACCESS_AUD?: string;
  readonly ACCESS_CERTS_URL?: string;
}

const JwtHeader = Schema.Struct({ alg: Schema.Literal("RS256"), kid: Schema.String });
const JwtPayload = Schema.Struct({
  aud: Schema.Union([Schema.String, Schema.Array(Schema.String)]),
  iss: Schema.Literal(accessIssuer),
  exp: Schema.Finite,
  nbf: Schema.optionalKey(Schema.Finite),
});
const Jwks = Schema.Struct({ keys: Schema.Array(Schema.Struct({
  kty: Schema.Literal("RSA"), kid: Schema.String, n: Schema.String, e: Schema.String,
})) });
const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };

class AccessVerificationError extends Schema.TaggedError<AccessVerificationError>()(
  "AccessVerificationError", { cause: Schema.Defect() }
) {}

const verifyAssertion = Effect.fn("AccessVerifier.verifyAssertion")(function* verifyAssertion(
  assertion: string,
  audience: string,
  keys: typeof Jwks.Type
) {
  const parts = assertion.split(".");
  const [head, body, signature] = parts;
  if (parts.length !== 3 || !head || !body || !signature) return false;
  const headerJson = yield* Schema.decodeUnknownEffect(Schema.StringFromBase64Url)(head);
  const payloadJson = yield* Schema.decodeUnknownEffect(Schema.StringFromBase64Url)(body);
  const header = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(JwtHeader))(headerJson);
  const payload = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(JwtPayload))(payloadJson);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const now = yield* Clock.currentTimeMillis;
  if (!audiences.includes(audience) || payload.exp * 1000 <= now || (payload.nbf !== undefined && payload.nbf * 1000 > now)) return false;
  const jwk = keys.keys.find((key) => key.kid === header.kid);
  if (!jwk) return false;
  const key = yield* Effect.tryPromise({
    try: () => crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]),
    catch: (cause) => new AccessVerificationError({ cause }),
  });
  const bytes = yield* Schema.decodeUnknownEffect(Schema.Uint8ArrayFromBase64Url)(signature);
  return yield* Effect.tryPromise({
    try: () => crypto.subtle.verify(algorithm, key, bytes, new TextEncoder().encode(`${head}.${body}`)),
    catch: (cause) => new AccessVerificationError({ cause }),
  });
});

export const accessVerifierLayer = (settings: AccessSettings) => Layer.effect(
  AccessVerifier,
  Effect.gen(function* makeAccessVerifier() {
    const client = yield* HttpClient.HttpClient;
    const fetchKeys = client.get(settings.ACCESS_CERTS_URL || accessCertsUrl).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(Jwks))
    );
    const getKeys = yield* Effect.cachedWithTTL(fetchKeys, (exit) => Exit.isSuccess(exit) ? "10 minutes" : 0);
    return AccessVerifier.of({
      verify: Effect.fn("AccessVerifier.verify")(function* verify(assertion: string | null) {
        if (settings.CHRO10_API_GATE === "0") return true;
        const audience = settings.ACCESS_AUD?.trim();
        if (!assertion || !audience) return false;
        return yield* getKeys.pipe(
          Effect.flatMap((keys) => verifyAssertion(assertion, audience, keys)),
          Effect.catch(() => Effect.succeed(false))
        );
      }),
    });
  })
).pipe(Layer.provide(FetchHttpClient.layer));

export const accessGate = Effect.fn("accessGate")(function* accessGate(request: Request) {
  const verifier = yield* AccessVerifier;
  const allowed = yield* verifier.verify(request.headers.get("Cf-Access-Jwt-Assertion"));
  return allowed ? null : Response.json({ success: false, error: "Login required" }, {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
});
