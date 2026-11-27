import { Context } from "effect";
import type { Effect } from "effect";

export class AccessVerifier extends Context.Service<
  AccessVerifier,
  {
    readonly verify: (assertion: string | null) => Effect.Effect<boolean>;
  }
>()("@chromescribe/core/AccessVerifier") {}
