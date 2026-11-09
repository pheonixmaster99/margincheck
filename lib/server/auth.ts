import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { readBearerToken } from "@/lib/server/auth-header";
import { ServerConfigurationError } from "@/lib/server/errors";
import { getFirebaseAdminAuth } from "@/lib/server/firebase-admin";

export class FirebaseAuthenticationError extends Error {
  constructor() {
    super("A valid Firebase ID token is required.");
    this.name = "FirebaseAuthenticationError";
  }
}

export async function requireFirebaseUser(request: Request): Promise<DecodedIdToken> {
  const idToken = readBearerToken(request.headers.get("authorization"));
  if (!idToken) throw new FirebaseAuthenticationError();

  try {
    return await getFirebaseAdminAuth().verifyIdToken(idToken, true);
  } catch (error) {
    if (error instanceof ServerConfigurationError) throw error;
    throw new FirebaseAuthenticationError();
  }
}
