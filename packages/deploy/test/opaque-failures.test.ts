import { describe, expect, it } from "@effect/vitest";
import { NonInteractiveTerminal } from "alchemy/Interaction";
import { SchemaAST } from "effect";

import { ApprovalDenied } from "../../capability/src/approval-denied.js";
import { FlagAtomicityRequired } from "../../core/src/flag-atomicity-required.js";
import { UnknownFlag } from "../../core/src/unknown-flag.js";
import { DeployStepError } from "../src/contracts.js";
import { RollbackFailed } from "../src/rollback-failed.js";

const opaqueFailures = [
  ["FlagAtomicityRequired", FlagAtomicityRequired],
  ["UnknownFlag", UnknownFlag],
  ["DeployStepError", DeployStepError],
  ["RollbackFailed", RollbackFailed],
  ["ApprovalDenied", ApprovalDenied],
] as const;

describe("opaque narrowing boundaries", () => {
  for (const [name, schema] of opaqueFailures) {
    it(`${name} declares no cause on either side of its schema`, () => {
      expect(Object.keys(schema.fields)).not.toContain("cause");
      const encoded = SchemaAST.toEncoded(schema.ast);
      expect(SchemaAST.isObjects(encoded)).toBe(true);

      if (SchemaAST.isObjects(encoded)) {
        expect(
          encoded.propertySignatures.map((field) => field.name)
        ).not.toContain("cause");
      }
    });
  }

  it("Alchemy's non-schema prompt refusal carries only fixed operator fields", () => {
    const error = new NonInteractiveTerminal({
      message: "Approval required",
      operation: "confirmation",
    });

    expect(Object.keys(error).toSorted()).toEqual(["_tag", "operation"]);
    expect(error.message).toBe("Approval required");
    expect(error).not.toHaveProperty("cause");
  });
});
