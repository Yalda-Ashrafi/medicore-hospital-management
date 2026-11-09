(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyCAMleJBANzEEP2gmERx0PxYLXpL-q-xPQ",
    authDomain: "medicore-hospital-management.firebaseapp.com",
    projectId: "medicore-hospital-management",
    storageBucket: "medicore-hospital-management.firebasestorage.app",
    messagingSenderId: "769037670405",
    appId: "1:769037670405:web:0aa1b9073219ca2e77a46c",
    measurementId: "G-30Z29HXQ3C"
  };

  if (!window.firebase) throw new Error("Firebase SDK did not load.");
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  window.MediCoreFirebase = firebase;
  window.MediCoreFirebaseAuth = firebase.auth();
})();
