// Vitest setup — runs once before any test file.
//
// See ROADMAP.md "Testing Checkpoints" §A.2.
//
// We import `@testing-library/jest-dom` to register matchers like
// `toBeInTheDocument()`, `toHaveTextContent()`, etc. across all component tests.
//
// Note: keep this file THIN. Anything stateful or per-test should live in
// individual test files or helpers, not here.

import "@testing-library/jest-dom";