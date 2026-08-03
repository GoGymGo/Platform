import { AdminDashboard } from "./admin-dashboard";
import type { FirebaseClientConfig } from "./admin-types";

export const dynamic = "force-dynamic";

export default function Home() {
  const firebaseConfig: FirebaseClientConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  };

  return <AdminDashboard firebaseConfig={firebaseConfig} />;
}
