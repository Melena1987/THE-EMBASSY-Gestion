import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// La configuración de Firebase se carga automáticamente desde las variables de entorno
// proporcionadas por el entorno de despliegue (ej. Netlify).
// No es necesario modificar este fichero manualmente.
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Validación para asegurar que las variables de entorno cruciales estén presentes.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error(
        "Error de configuración de Firebase: Faltan variables de entorno esenciales. " +
        "Asegúrate de que VITE_FIREBASE_API_KEY y VITE_FIREBASE_PROJECT_ID estén configuradas en tu entorno de despliegue."
    );
}

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
