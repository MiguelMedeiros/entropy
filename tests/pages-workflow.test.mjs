import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
test("README links prominently to the live GitHub Pages app", () => {
  const readme = readFileSync(new URL("README.md", root), "utf8");
  assert.equal(
    readme.split("\n")[4],
    "**[Open the live educational demo →](https://miguelmedeiros.github.io/entropy/)**",
  );
});

test("Pages workflow builds the verified offline export and deploys only dist", () => {
  const workflow = readFileSync(new URL(".github/workflows/pages.yml", root), "utf8");
  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm audit signatures/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(workflow, /npm rebuild esbuild/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /npm run test:offline-export/);
  assert.match(workflow, /path:\s*dist/);
  for (const action of workflow.matchAll(/uses:\s*([^\s#]+)/g)) {
    const revision = action[1].split("@")[1];
    assert.match(revision, /^[0-9a-f]{40}$/);
  }
  assert.match(workflow, /actions\/upload-pages-artifact@/);
  assert.match(workflow, /actions\/deploy-pages@/);
});
