// commit-msg hook entry point.
// Lefthook's {1} placeholder splits paths containing spaces (common on Windows),
// so the message file is resolved from git itself and passed as a single argv entry.
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const messageFile = execFileSync(
  "git",
  ["rev-parse", "--path-format=absolute", "--git-path", "COMMIT_EDITMSG"],
  { encoding: "utf8" },
).trim();

const cli = require.resolve("@commitlint/cli/cli.js");
const result = spawnSync(process.execPath, [cli, "--edit", messageFile], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
