import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";

let environment: RulesTestEnvironment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-margincheck",
    firestore: { rules: await readFile("firestore.rules", "utf8") },
    storage: { rules: await readFile("storage.rules", "utf8") },
  });
});

after(async () => {
  await environment.cleanup();
});

test("Firestore isolates jobs and entries by authenticated user", async () => {
  const userA = environment.authenticatedContext("user-a").firestore();
  const userB = environment.authenticatedContext("user-b").firestore();
  const anonymous = environment.unauthenticatedContext().firestore();
  const jobPath = "users/user-a/jobs/job-1";

  await assertSucceeds(setDoc(doc(userA, jobPath), { ownerId: "user-a" }));
  await assertSucceeds(getDoc(doc(userA, jobPath)));
  await assertSucceeds(updateDoc(doc(userA, jobPath), { ownerId: "user-a", status: "Completed" }));
  await assertFails(getDoc(doc(userB, jobPath)));
  await assertFails(getDoc(doc(anonymous, jobPath)));

  const labourPath = `${jobPath}/labourEntries/labour-1`;
  const expensePath = `${jobPath}/expenses/expense-1`;
  await assertSucceeds(setDoc(doc(userA, labourPath), { ownerId: "user-a", jobId: "job-1" }));
  await assertSucceeds(setDoc(doc(userA, expensePath), { ownerId: "user-a", jobId: "job-1" }));
  await assertFails(getDoc(doc(userB, labourPath)));
  await assertFails(getDoc(doc(userB, expensePath)));
  await assertFails(setDoc(doc(userB, jobPath), { ownerId: "user-b" }));
  await assertFails(updateDoc(doc(userB, jobPath), { ownerId: "user-b" }));
});

test("Storage isolates receipts and validates type and size", async () => {
  const userA = environment.authenticatedContext("user-a").storage();
  const userB = environment.authenticatedContext("user-b").storage();
  const anonymous = environment.unauthenticatedContext().storage();
  const path = "users/user-a/jobs/job-1/receipts/receipt-1/receipt.jpg";
  const bytes = new Uint8Array([1, 2, 3]);

  await assertSucceeds(uploadBytes(ref(userA, path), bytes, { contentType: "image/jpeg" }));
  await assertSucceeds(getBytes(ref(userA, path)));
  await assertFails(getBytes(ref(userB, path)));
  await assertFails(getBytes(ref(anonymous, path)));
  await assertFails(uploadBytes(ref(userB, path), bytes, { contentType: "image/jpeg" }));
  await assertSucceeds(uploadBytes(ref(userA, `${path}.png`), bytes, { contentType: "image/png" }));
  await assertSucceeds(uploadBytes(ref(userA, `${path}.pdf`), bytes, { contentType: "application/pdf" }));
  await assertFails(uploadBytes(ref(userA, `${path}.svg`), bytes, { contentType: "image/svg+xml" }));
  await assertFails(uploadBytes(ref(userA, `${path}.large`), new Uint8Array(10 * 1024 * 1024 + 1), { contentType: "image/png" }));
  await assertFails(deleteObject(ref(userB, path)));
  await assertSucceeds(deleteObject(ref(userA, path)));
  assert.ok(true);
});
