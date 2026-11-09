import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ServerConfigurationError } from "@/lib/server/errors";

const ADMIN_APP_NAME = "margincheck-admin";

interface FirebaseAdminConfiguration {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket: string;
}

function readFirebaseAdminConfiguration(): FirebaseAdminConfiguration {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();

  if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    throw new ServerConfigurationError(
      "Firebase Admin is not configured. Add the server-only Firebase Admin environment variables.",
    );
  }

  return { projectId, clientEmail, privateKey, storageBucket };
}

function getFirebaseAdminApp(): App {
  const existingApp = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existingApp) return existingApp;

  const configuration = readFirebaseAdminConfiguration();
  return initializeApp(
    {
      credential: cert(configuration),
      projectId: configuration.projectId,
      storageBucket: configuration.storageBucket,
    },
    ADMIN_APP_NAME,
  );
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}

export function getFirebaseAdminBucket() {
  return getStorage(getFirebaseAdminApp()).bucket();
}
