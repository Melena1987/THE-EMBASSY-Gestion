// El bloque 'declare global' para ImportMetaEnv ha sido eliminado, ya que el uso de
// import.meta.env causaba un error en tiempo de ejecución.

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- INSTRUCCIONES IMPORTANTES ---
// Reemplaza los valores de marcador de posición ("YOUR_...") con las credenciales reales de tu proyecto de Firebase.
// Puedes encontrar esta configuración en la consola de Firebase, en la configuración de tu proyecto.
// Es fundamental para que la aplicación se conecte correctamente a Firebase.
const firebaseConfig = {
  apiKey: "YOUR_VITE_FIREBASE_API_KEY",
  authDomain: "YOUR_VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_VITE_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "YOUR_VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "YOUR_VITE_FIREBASE_APP_ID",
  measurementId: "YOUR_VITE_FIREBASE_MEASUREMENT_ID"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
