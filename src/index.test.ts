import { describe, it, expect } from "vitest";
import { validateMessage, isValid, resolveConfig, DEFAULT_TYPES } from "./index";

describe("validateMessage — defaults", () => {
  it("accepts a plain conventional commit", () => {
    expect(validateMessage("feat: add the thing")).toEqual([]);
  });

  it("accepts a scoped commit", () => {
    expect(validateMessage("fix(api): handle null user")).toEqual([]);
  });

  it("accepts a breaking-change marker by default", () => {
    expect(validateMessage("feat(api)!: drop v1 endpoints")).toEqual([]);
  });

  it("accepts a multi-scope subject", () => {
    expect(validateMessage("refactor(web,api): share the client")).toEqual([]);
  });

  it("rejects an unknown type", () => {
    const errors = validateMessage("wip: something");
    expect(errors.some((e) => e.includes('type "wip"'))).toBe(true);
  });

  it("rejects a missing type/colon", () => {
    expect(validateMessage("just some text")).toHaveLength(1);
  });

  it("rejects a trailing period", () => {
    expect(validateMessage("feat: add the thing.")).toContain(
      "summary must not end with a period"
    );
  });

  it("rejects an uppercase summary start", () => {
    expect(validateMessage("feat: Add the thing")).toContain(
      "summary must start with a lowercase letter or a digit"
    );
  });

  it("rejects an empty message", () => {
    expect(validateMessage("")).toEqual(["subject line is empty"]);
  });

  it("exempts merge and revert commits", () => {
    expect(validateMessage("Merge branch 'main' into dev")).toEqual([]);
    expect(validateMessage('Revert "feat: x"')).toEqual([]);
    expect(validateMessage("fixup! feat: x")).toEqual([]);
  });
});

describe("validateMessage — config", () => {
  it("enforces the allowed scope list", () => {
    const cfg = { scopes: ["web", "api"] };
    expect(validateMessage("feat(web): ok", cfg)).toEqual([]);
    expect(validateMessage("feat(db): nope", cfg).some((e) => e.includes('scope "db"'))).toBe(
      true
    );
  });

  it("can require a scope", () => {
    const cfg = { requireScope: true };
    expect(validateMessage("feat: no scope", cfg)).toContain(
      'a scope is required, e.g. "type(scope): summary"'
    );
    expect(validateMessage("feat(x): scoped", cfg)).toEqual([]);
  });

  it("honors a custom type list", () => {
    const cfg = { types: ["add", "remove"] };
    expect(validateMessage("add: a feature", cfg)).toEqual([]);
    expect(validateMessage("feat: nope", cfg).some((e) => e.includes('type "feat"'))).toBe(true);
  });

  it("can forbid breaking markers", () => {
    const cfg = { allowBreaking: false };
    expect(validateMessage("feat!: boom", cfg)).toContain(
      'the breaking-change marker "!" is not allowed'
    );
  });

  it("enforces a custom max subject length", () => {
    const cfg = { maxSubjectLength: 20 };
    expect(validateMessage("feat: short enough", cfg)).toEqual([]);
    expect(
      validateMessage("feat: this subject is definitely far too long to pass", cfg)
    ).toContain("subject must be 20 characters or fewer");
  });

  it("enforces required body sections", () => {
    const cfg = {
      bodyRequired: [{ pattern: "^WHY:\\s+\\S", message: "missing WHY: section" }],
    };
    expect(validateMessage("feat: x", cfg)).toContain("missing WHY: section");
    expect(validateMessage("feat: x\n\nWHY: because reasons", cfg)).toEqual([]);
  });
});

describe("resolveConfig / isValid", () => {
  it("fills defaults", () => {
    const r = resolveConfig();
    expect(r.types).toEqual([...DEFAULT_TYPES]);
    expect(r.scopes).toBeNull();
    expect(r.maxSubjectLength).toBe(72);
    expect(r.allowBreaking).toBe(true);
  });

  it("isValid mirrors validateMessage", () => {
    expect(isValid("feat: ok")).toBe(true);
    expect(isValid("nope")).toBe(false);
  });
});
