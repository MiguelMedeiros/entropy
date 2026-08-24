import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const workflowsDirectory = new URL("../.github/workflows/", import.meta.url);
const codeqlActionPattern = /uses:\s+github\/codeql-action\/[^@\s]+@([^\s#]+)/g;

test("each workflow uses one CodeQL action revision", () => {
  const workflowFiles = readdirSync(workflowsDirectory)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
  const mismatches = [];

  for (const workflowFile of workflowFiles) {
    const contents = readFileSync(join(workflowsDirectory.pathname, workflowFile), "utf8");
    const revisions = [...contents.matchAll(codeqlActionPattern)].map((match) => match[1]);
    if (new Set(revisions).size > 1) {
      mismatches.push(`${workflowFile}: ${revisions.join(", ")}`);
    }
  }

  assert.deepEqual(mismatches, []);
});
