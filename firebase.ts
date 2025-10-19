import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- INSTRUCCIONES DE CONFIGURACIÓN ---
// Por favor, reemplace los valores de marcador de posición a continuación con la configuración
// real de su proyecto de Firebase. Puede encontrar esta información en la consola de Firebase,
// en la configuración de su proyecto (Project Settings > General > Your apps > Firebase SDK snippet).
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // Reemplazar con su API Key
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com", // Reemplazar con su Auth Domain
  projectId: "YOUR_PROJECT_ID", // Reemplazar con su Project ID
  storageBucket: "YOUR_PROJECT_ID.appspot.com", // Reemplazar con su Storage Bucket
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Reemplazar con su Messaging Sender ID
  appId: "YOUR_APP_ID", // Reemplazar con su App ID
};

// Validación para asegurar que la configuración de Firebase ha sido actualizada.
if (firebaseConfig.apiKey === "YOUR_API_KEY" || firebaseConfig.projectId === "YOUR_PROJECT_ID") {
    console.warn(
        "Configuración de Firebase incompleta: Por favor, edite el fichero 'firebase.ts' " +
        "y reemplace los valores de marcador de posición con las credenciales reales de su proyecto de Firebase."
    );
}

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
