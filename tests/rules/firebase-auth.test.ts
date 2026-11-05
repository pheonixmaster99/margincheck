import assert from "node:assert/strict";
import test from "node:test";
import { connectAuthEmulator } from "firebase/auth";

process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-api-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo-margincheck.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-margincheck";
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "demo-margincheck.appspot.com";
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "123456789";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:123456789:web:demo";

test("email/password authentication supports signup, logout, login, and observation", async () => {
  const { getFirebaseAuth } = await import("../../lib/firebase");
  const { observeAuthState, signIn, signOutUser, signUp } = await import("../../lib/auth-service");
  const auth = getFirebaseAuth();
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });

  const email = `contractor-${crypto.randomUUID()}@example.com`;
  const password = "margincheck-test-password";
  const observedUsers: Array<string | null> = [];
  const unsubscribe = observeAuthState((user) => observedUsers.push(user?.uid ?? null));

  const createdUser = await signUp(email, password);
  assert.equal(createdUser.email, email);
  assert.equal(auth.currentUser?.uid, createdUser.uid);

  await signOutUser();
  assert.equal(auth.currentUser, null);

  const signedInUser = await signIn(email, password);
  assert.equal(signedInUser.uid, createdUser.uid);
  assert.equal(getFirebaseAuth().currentUser?.email, email);

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(observedUsers.includes(createdUser.uid));
  assert.ok(observedUsers.includes(null));
  unsubscribe();
  await signOutUser();
});
