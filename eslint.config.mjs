import { config as baseConfig } from "./packages/eslint-config/base.js";
import { nextJsConfig } from "./packages/eslint-config/next.js";
import { config as reactInternalConfig } from "./packages/eslint-config/react-internal.js";

/**
 * Scope a shared flat config to a set of directories.
 *
 * The shared configs were written for `eslint .` inside each workspace, so they
 * do not declare `files` patterns. `lint-staged` runs ESLint from the monorepo
 * root and passes explicit file paths, which requires every config entry to be
 * matched against the workspace directories.
 *
 * @param {import("eslint").Linter.Config[]} configs
 * @param {string[]} patterns
 * @returns {import("eslint").Linter.Config[]}
 */
function scopeConfigs(configs, patterns) {
  return configs
    .filter((entry) => !(entry.ignores && !entry.files))
    .map((entry) => ({
      ...entry,
      files: [...(entry.files ?? []), ...patterns],
    }));
}

export default [
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/out/**",
      "**/build/**",
      "**/coverage/**",
      "**/next-env.d.ts",
    ],
  },
  ...scopeConfigs(baseConfig, ["apps/api/**/*.{js,mjs,cjs,ts,tsx}"]),
  ...scopeConfigs(reactInternalConfig, [
    "packages/ui/**/*.{js,mjs,cjs,ts,tsx}",
  ]),
  ...scopeConfigs(nextJsConfig, ["apps/web/**/*.{js,mjs,cjs,ts,tsx}"]),
  ...scopeConfigs(baseConfig, [
    "*.{js,mjs,cjs,ts,tsx}",
    "scripts/**/*.{js,mjs,cjs,ts,tsx}",
  ]),
];
