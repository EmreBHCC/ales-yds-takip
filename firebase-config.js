/* Firebase web yapılandırması. Bu değerler gizli değildir (tarayıcıya zaten iner); veriyi koruyan şey
   Firestore güvenlik kurallarıdır (README → "Google senkronu"): kullanicilar/{uid} yalnız o uid'e açık.
   null bırakılırsa senkron kapalıdır ve uygulama yalnızca yerel çalışır. */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCoivIdvJHqRXqriccu8eGhAUc8ie5YQCg",
  authDomain: "ales-yds-takip.firebaseapp.com",
  projectId: "ales-yds-takip",
  storageBucket: "ales-yds-takip.firebasestorage.app",
  messagingSenderId: "271265104563",
  appId: "1:271265104563:web:3b9bc82aaac7066c0d66c6"
};
