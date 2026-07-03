// Vitest configuration for the frontend test suite.
//
// See ROADMAP.md "Testing Checkpoints" §A.2.
//
// Why this file lives in `src/frontend/` (not `tests/frontend/`):
//   - `vitest/config` must be resolvable from the working directory that
//     runs the tests. With npm scripts running inside `src/frontend/`,
//     Node's module resolution only searches `src/frontend/node_modules`.
//   - We could add `tests/frontend` to NODE_PATH, but co-locating the
//     config with the rest of the frontend tooling is simpler and matches
//     how Next.js, Vite, etc. discover their own configs.
//
// Key choices:
//   - `environment: 'jsdom'` — DOM globals (window, document, etc.) are
//     available without spinning up a real browser.
//   - Path alias `@/*` mirrors `tsconfig.json` so component imports work
//     identically inside tests.
//   - `setupFiles` registers `@testing-library/jest-dom` matchers.
//
// Run: `npm run test` (single pass) or `npm run test:watch` (interactive).

import { defineConfig } from "vitest/config";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const TESTS_DIR = path.join(REPO_ROOT, "tests/frontend");
const NODE_MODULES = path.resolve(__dirname, "node_modules");

export default defineConfig({
  // We let Vite serve files from the entire repo, since the test suite
  // lives outside src/frontend/. This is safe in a local dev/CI context
  // where the working directory is trusted.
  server: {
    fs: {
      allow: [REPO_ROOT],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Force bare imports of test-only deps to resolve against
      // src/frontend/node_modules — vite's resolver can't traverse
      // from tests/frontend/setup.ts back to the frontend's node_modules
      // by itself. Each alias points to the package's main entry.
      "@testing-library/jest-dom": path.join(
        NODE_MODULES,
        "@testing-library/jest-dom/dist/index.js"
      ),
      "@testing-library/react": path.join(
        NODE_MODULES,
        "@testing-library/react/dist/index.js"
      ),
      // React itself + JSX runtime must also resolve from the frontend's
      // node_modules. Otherwise the automatic JSX runtime fails to find
      // `react/jsx-dev-runtime`.
      react: path.join(NODE_MODULES, "react"),
      "react/jsx-dev-runtime": path.join(
        NODE_MODULES,
        "react/jsx-dev-runtime.js"
      ),
      "react/jsx-runtime": path.join(NODE_MODULES, "react/jsx-runtime.js"),
      "react-dom": path.join(NODE_MODULES, "react-dom"),
      "react-dom/client": path.join(NODE_MODULES, "react-dom/client.js"),
    },
  },
  // Match Next.js / production: JSX uses the automatic runtime so test
  // files don't need to `import React` at the top.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [path.join(TESTS_DIR, "setup.ts")],
    include: [`${TESTS_DIR}/**/*.test.{ts,tsx}`],
    css: false, // The CSS design system is visual — don't pull it into unit tests.
  },
});