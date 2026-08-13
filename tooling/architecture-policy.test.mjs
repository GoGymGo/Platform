import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateImport,
  extractImportSpecifiers,
  validateWorkspaceDependencies,
} from "./architecture-policy.mjs";

test("extracts static, dynamic, and CommonJS imports", () => {
  assert.deepEqual(
    new Set(
      extractImportSpecifiers(`
        import value from './value';
        export { other } from "./other";
        const lazy = import('./lazy');
        const legacy = require('./legacy');
      `),
    ),
    new Set(["./value", "./other", "./lazy", "./legacy"]),
  );
});

test("allows public shared packages and same-boundary aliases", () => {
  assert.equal(
    evaluateImport({
      importer: "apps/member-app/src/data/appData.ts",
      specifier: "@gogymgo/contracts",
    }),
    null,
  );
  assert.equal(
    evaluateImport({
      importer: "apps/member-app/src/data/appData.ts",
      specifier: "@/services/api/client",
    }),
    null,
  );
});

test("rejects source imports across runtime owners", () => {
  assert.match(
    evaluateImport({
      importer: "apps/admin/app/dashboard.tsx",
      specifier: "../../member-app/src/data/appData",
    }),
    /may not import member-app source/i,
  );
  assert.match(
    evaluateImport({
      importer: "services/api/src/main.ts",
      specifier: "@gogymgo/contracts",
    }),
    /may not import workspace package/i,
  );
});

test("rejects undeclared workspace dependency directions", () => {
  assert.deepEqual(
    validateWorkspaceDependencies([
      {
        name: "@gogymgo/landing",
        dependencies: { "@gogymgo/contracts": "*" },
      },
    ]),
    [
      "@gogymgo/landing: workspace dependency @gogymgo/contracts is outside its allowed boundary.",
    ],
  );
});
