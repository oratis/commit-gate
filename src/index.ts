/**
 * commit-gate — a zero-dependency, config-driven Conventional-Commits linter.
 *
 * This module is the pure, IO-free core: {@link validateMessage} takes a commit
 * message string and returns a list of human-readable errors (empty = valid).
 * The CLI (`commit-gate`) wraps it with git / file / stdin plumbing.
 */

export interface BodyRule {
  /** A regular-expression source tested (multiline) against the commit body. */
  pattern: string;
  /** Message shown when the pattern does not match. */
  message: string;
}

export interface CommitGateConfig {
  /** Allowed commit types. Defaults to the Conventional Commits set. */
  types?: string[];
  /**
   * Allowed scopes. When omitted or empty, any scope (or none) is accepted.
   * When provided, every scope in the subject must be in this list.
   */
  scopes?: string[];
  /** Require a scope on every commit. Default: `false`. */
  requireScope?: boolean;
  /** Max length of the whole subject line. Default: `72`. */
  maxSubjectLength?: number;
  /** Allow the breaking-change `!` marker (e.g. `feat!:`). Default: `true`. */
  allowBreaking?: boolean;
  /** Body sections that must be present (e.g. require a `WHY:` line). */
  bodyRequired?: BodyRule[];
  /**
   * Extra regex sources for subjects that bypass all checks. Merged with the
   * built-ins for merge / revert / fixup! / squash! commits.
   */
  exemptPatterns?: string[];
}

export const DEFAULT_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
] as const;

export const DEFAULT_MAX_SUBJECT_LENGTH = 72;

const BUILTIN_EXEMPT = [/^Merge /, /^Revert /, /^fixup! /, /^squash! /];

export interface ResolvedConfig {
  types: string[];
  scopes: string[] | null;
  requireScope: boolean;
  maxSubjectLength: number;
  allowBreaking: boolean;
  bodyRequired: BodyRule[];
  exempt: RegExp[];
}

/** Fill a partial {@link CommitGateConfig} with defaults. */
export function resolveConfig(config: CommitGateConfig = {}): ResolvedConfig {
  return {
    types: config.types && config.types.length ? config.types : [...DEFAULT_TYPES],
    scopes: config.scopes && config.scopes.length ? config.scopes : null,
    requireScope: config.requireScope ?? false,
    maxSubjectLength: config.maxSubjectLength ?? DEFAULT_MAX_SUBJECT_LENGTH,
    allowBreaking: config.allowBreaking ?? true,
    bodyRequired: config.bodyRequired ?? [],
    exempt: [
      ...BUILTIN_EXEMPT,
      ...(config.exemptPatterns ?? []).map((p) => new RegExp(p)),
    ],
  };
}

function splitSubjectBody(text: string): { subject: string; body: string } {
  const normalized = text.replace(/\r\n/g, "\n").trimEnd();
  const lines = normalized.split("\n");
  return {
    subject: (lines[0] ?? "").trim(),
    body: lines.slice(1).join("\n").trim(),
  };
}

const SUBJECT_RE = /^([a-z]+)(?:\(([^)]+)\))?(!)?: (.+)$/;

/**
 * Validate a single commit message against `config`.
 *
 * @returns An array of error strings. Empty means the message is valid.
 */
export function validateMessage(
  text: string,
  config: CommitGateConfig | ResolvedConfig = {}
): string[] {
  const cfg = "exempt" in config ? config : resolveConfig(config);
  const { subject, body } = splitSubjectBody(text);

  if (!subject) return ["subject line is empty"];
  if (cfg.exempt.some((re) => re.test(subject))) return [];

  const match = subject.match(SUBJECT_RE);
  if (!match) {
    return [`subject must match "type(scope): summary" — got: "${subject}"`];
  }

  const [, type, scopeText, breaking, summary] = match;
  const errors: string[] = [];

  if (!cfg.types.includes(type)) {
    errors.push(`type "${type}" is not allowed (allowed: ${cfg.types.join(", ")})`);
  }
  if (breaking && !cfg.allowBreaking) {
    errors.push('the breaking-change marker "!" is not allowed');
  }
  if (cfg.requireScope && !scopeText) {
    errors.push('a scope is required, e.g. "type(scope): summary"');
  }
  if (scopeText && cfg.scopes) {
    for (const raw of scopeText.split(",")) {
      const scope = raw.trim();
      if (!scope) {
        errors.push("empty scope in the scope list");
      } else if (!cfg.scopes.includes(scope)) {
        errors.push(`scope "${scope}" is not allowed (allowed: ${cfg.scopes.join(", ")})`);
      }
    }
  }
  if (!/^[a-z0-9]/.test(summary)) {
    errors.push("summary must start with a lowercase letter or a digit");
  }
  if (summary.endsWith(".")) {
    errors.push("summary must not end with a period");
  }
  if ([...subject].length > cfg.maxSubjectLength) {
    errors.push(`subject must be ${cfg.maxSubjectLength} characters or fewer`);
  }
  for (const rule of cfg.bodyRequired) {
    let re: RegExp;
    try {
      re = new RegExp(rule.pattern, "m");
    } catch {
      errors.push(`invalid bodyRequired pattern: ${rule.pattern}`);
      continue;
    }
    if (!re.test(body)) errors.push(rule.message);
  }

  return errors;
}

/** Convenience boolean form of {@link validateMessage}. */
export function isValid(text: string, config?: CommitGateConfig): boolean {
  return validateMessage(text, config).length === 0;
}
