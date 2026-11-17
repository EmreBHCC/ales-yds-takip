/* Firebase web yapılandırması. Bu değerler gizli değildir (tarayıcıya zaten iner); veriyi koruyan şey
   Firestore güvenlik kurallarıdır (README → "Google senkronu"). Boş (null) bırakılırsa senkron kapalıdır
   ve uygulama yalnızca yerel çalışır.

   Firebase konsolu → Proje ayarları → Uygulamalarınız → Web uygulaması → "firebaseConfig" nesnesini
   aşağıya yapıştır:

   window.FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", appId: "..." };
*/
window.FIREBASE_CONFIG = null;
