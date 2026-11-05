import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

export async function signUp(email: string, password: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    email.trim(),
    password,
  );
  return credential.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email.trim(),
    password,
  );
  return credential.user;
}

export function signOutUser(): Promise<void> {
  return signOut(getFirebaseAuth());
}

export function observeAuthState(
  callback: (user: User | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onAuthStateChanged(getFirebaseAuth(), callback, onError);
}
