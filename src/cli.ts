#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type CommitGateConfig,
  resolveConfig,
  validateMessage,
} from "./index";

function usage(): string {
  return `commit-gate — Conventional-Commits message linter

Usage:
  commit-gate <commit-msg-file>     Lint one message file (husky / commit-msg hook)
  commit-gate --message "<text>"    Lint a message passed inline  (alias: -m)
  commit-gate --range <base..head>  Lint every commit in a git range  (alias: -r)
  commit-gate --help                Show this help  (alias: -h)

Config (first match wins):
  commitgate.config.json | .commitgaterc.json | .commitgaterc | package.json#commitGate`;
}

function loadConfig(cwd: string = process.cwd()): CommitGateConfig {
  for (const name of ["commitgate.config.json", ".commitgaterc.json", ".commitgaterc"]) {
    const p = resolve(cwd, name);
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, "utf8")) as CommitGateConfig;
      } catch (err) {
        console.error(`commit-gate: failed to parse ${name}: ${(err as Error).message}`);
        process.exit(2);
      }
    }
  }
  const pkgPath = resolve(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        commitGate?: CommitGateConfig;
      };
      if (pkg && typeof pkg === "object" && pkg.commitGate) return pkg.commitGate;
    } catch {
      // ignore an unparseable package.json — not our job to gate on it
    }
  }
  return {};
}

/** Drop git comment lines and anything below the `--verbose` scissors line. */
function cleanCommitFile(raw: string): string {
  const scissors = "# ------------------------ >8 ------------------------";
  const head = raw.includes(scissors) ? raw.slice(0, raw.indexOf(scissors)) : raw;
  return head
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("#"))
    .join("\n")
    .trim();
}

interface Message {
  source: string;
  text: string;
}

function messagesFromRange(range: string): Message[] {
  const out = execFileSync("git", ["log", "--format=%H%x00%B%x1e", range], {
    encoding: "utf8",
  });
  return out
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha, ...rest] = entry.split("\x00");
      return { source: sha.slice(0, 12), text: rest.join("\x00").trim() };
    });
}

function main(argv: string[]): number {
  const [first, second] = argv;
  if (first === "-h" || first === "--help") {
    console.log(usage());
    return 0;
  }
  if (!first) {
    console.error(usage());
    return 2;
  }

  const resolved = resolveConfig(loadConfig());

  let messages: Message[];
  if (first === "--message" || first === "-m") {
    messages = [{ source: "--message", text: second ?? "" }];
  } else if (first === "--range" || first === "-r") {
    if (!second) {
      console.error("commit-gate: --range requires a revision range, e.g. origin/main..HEAD");
      return 2;
    }
    try {
      messages = messagesFromRange(second);
    } catch (err) {
      console.error(`commit-gate: git log failed: ${(err as Error).message}`);
      return 2;
    }
  } else {
    if (!existsSync(first)) {
      console.error(`commit-gate: commit message file not found: ${first}`);
      return 2;
    }
    messages = [{ source: first, text: cleanCommitFile(readFileSync(first, "utf8")) }];
  }

  const failures = messages
    .map((m) => ({ ...m, errors: validateMessage(m.text, resolved) }))
    .filter((r) => r.errors.length > 0);

  if (failures.length === 0) return 0;

  console.error("✖ commit-gate: commit message check failed\n");
  console.error('Expected: type(scope): summary   (scope optional unless configured)');
  console.error(`Types:    ${resolved.types.join(", ")}`);
  if (resolved.scopes) console.error(`Scopes:   ${resolved.scopes.join(", ")}`);
  console.error(
    `Subject:  ≤ ${resolved.maxSubjectLength} chars, starts lowercase/digit, no trailing period\n`
  );
  for (const failure of failures) {
    const subject = failure.text.split("\n")[0] || "(empty subject)";
    console.error(`  ${failure.source}: ${subject}`);
    for (const error of failure.errors) console.error(`    - ${error}`);
  }
  return 1;
}

process.exit(main(process.argv.slice(2)));
