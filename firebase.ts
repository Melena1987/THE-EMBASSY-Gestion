
// Importa las funciones necesarias de los SDKs que necesitas
import { initializeApp } from "https://aistudiocdn.com/firebase@12.4.0/app.js";
import { getFirestore } from "https://aistudiocdn.com/firebase@12.4.0/firestore.js";
import { getAuth } from "https://aistudiocdn.com/firebase@12.4.0/auth.js";
import { getStorage } from "https://aistudiocdn.com/firebase@12.4.0/storage.js";

declare global {
  interface ImportMetaEnv {
    readonly VITE_FIREBASE_API_KEY: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string;
    readonly VITE_FIREBASE_PROJECT_ID: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    readonly VITE_FIREBASE_APP_ID: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// Lee las variables de entorno de Vite/Netlify de forma segura
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta los servicios que necesitas
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;