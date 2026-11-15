// Firebase Web config. Estos valores identifican el proyecto y son públicos.
export const firebaseConfig = {
  apiKey: "AIzaSyDIB7ijiuVHMMjRzzz4rWy8DUbe423QRkk",
  authDomain: "simuladoresestudio.firebaseapp.com",
  projectId: "simuladoresestudio",
  appId: "1:110694865226:web:19c8e1674b568e4cc9c9b3",
  messagingSenderId: "110694865226",
  storageBucket: "simuladoresestudio.firebasestorage.app"
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
}