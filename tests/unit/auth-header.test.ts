import assert from "node:assert/strict";
import test from "node:test";
import { readBearerToken } from "../../lib/server/auth-header";

test("readBearerToken accepts a bearer token case-insensitively", () => {
  assert.equal(readBearerToken("Bearer token-value"), "token-value");
  assert.equal(readBearerToken("bearer another-token"), "another-token");
});

test("readBearerToken rejects missing or malformed authorization headers", () => {
  assert.equal(readBearerToken(null), null);
  assert.equal(readBearerToken(""), null);
  assert.equal(readBearerToken("Basic token-value"), null);
  assert.equal(readBearerToken("Bearer   "), null);
});
