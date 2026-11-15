// Firebase Web config. Estos valores identifican el proyecto y son públicos.
// La seguridad de los datos depende de Authentication y firestore.rules, no de ocultar este archivo.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
  messagingSenderId: "",
  storageBucket: ""
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
}
