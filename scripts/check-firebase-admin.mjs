import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Firebase Admin environment variables are missing from .env.local.");
}

const app = initializeApp(
  {
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  },
  "margincheck-credential-check",
);

try {
  await getAuth(app).listUsers(1);
  console.log("Firebase Admin connection verified.");
} finally {
  await deleteApp(app);
}
