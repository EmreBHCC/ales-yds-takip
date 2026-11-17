# ALES · YDS takip

ALES ve YDS/YÖKDİL hazırlığını izlemek için tek sayfalık web uygulaması. Derleme yok, bağımlılık yok, yapay zekâ/API çağrısı yok. Veri varsayılan olarak yalnız tarayıcıda (`localStorage`) durur; istenirse Google girişiyle telefon ve bilgisayar arasında eşitlenir.

**Canlı:** https://emrebhcc.github.io/ales-yds-takip/

## Özellikler

- **Bugün:** günün planı (kart tekrarı, çalışma payı, hata defteri, deneme; kayıtlardan türetilir, kendiliğinden işaretlenir), başvuru takvimi uyarısı, hedefe yol ("haftada ≈ X net yeter"), haftalık özet, sınav geri sayımı, seri. Ara verince suçlamaz, tek maddeyle dönmeyi önerir.
- **Çalışma:** günlük kayıt, kronometre (sayfa yenilense de sürer)
- **Deneme:** YDS (puan = doğru × 1,25, harf notu) ve ALES (net = doğru − yanlış/4); hedef çizgili gidişat grafiği
- **ALES puan tahmini:** ÖSYM katsayı yayımlamaz, bu yüzden tahmin yalnız girdiğin **gerçek ALES sonuçlarından** kurulur (net → puan aralığı, sonuç arttıkça daralır). Sonuç yoksa puan gösterilmez; uydurma katsayı yok.
- **Hata defteri:** konu, neden, not, çözüldü işareti; nedene göre dağılım
- **Kelime kartları:** aralıklı tekrar (1-3-7-16-35 gün), toplu ekleme (`kelime - karşılık`)
- **Konular:** ALES ve YDS konu listesi, üç durumlu ilerleme
- **Ayarlar:** hedefler, sınav tarihleri (başvuru ve sonuç dahil), açık/koyu tema, Google senkronu, JSON yedek

## Sınav tarihleri (2027)

ÖSYM 2027 takvimini 28 Ekim 2026'da yayımladı. Uygulamadaki 7 sınavın sınav/başvuru/sonuç tarihleri haber sitelerinden alınmıştır, **ÖSYM'nin kendi sayfasından doğrulanmadı** (`ais.osym.gov.tr` / `osym.gov.tr` takvim). Doğrulayınca Ayarlar'da "doğrulandı" işaretle. ÖSYM tarih değiştirebilir (2026'da ALES/2 ve YÖKDİL/2 değişti). e-YDS / e-YÖKDİL tarihleri bulunamadı, elle eklenir.

## Google senkronu (bir kez kurulur)

Statik site olduğu için sunucu yok; senkron Firebase Auth + Firestore ile (ücretsiz katman yeter). Yapılandırma yoksa senkron kapalıdır ve uygulama yalnız yerel çalışır.

1. https://console.firebase.google.com → **Proje ekle** (Analytics gerekmez).
2. **Build → Authentication → Başla → Google** sağlayıcısını etkinleştir.
3. Authentication → **Ayarlar → Yetkili alan adları** → `emrebhcc.github.io` ekle.
4. **Build → Firestore Database → Veritabanı oluştur** (production modu), sonra **Kurallar** sekmesine yapıştır:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /kullanicilar/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
   (İstersen `&& request.auth.token.email == 'senin-adresin@gmail.com'` ekleyerek yalnız kendi hesabına kilitle.)
5. **Proje ayarları → Uygulamalarınız → Web (`</>`)** → uygulamayı kaydet → çıkan `firebaseConfig` nesnesini `firebase-config.js` içine `window.FIREBASE_CONFIG = {...}` olarak yapıştır, commit + push.
6. Her cihazda Ayarlar → **Google ile giriş yap**. İki cihazın verisi birleşir.

`firebaseConfig` değerleri gizli değildir; veriyi yukarıdaki kurallar korur. Birleştirme: kayıtlar `id` ile birleşir, çakışmada yeni olan kazanır, silinenler iz bırakır (geri gelmez). Giriş yapmadan da uygulama çalışır; senkron bozulursa yerel veri kaybolmaz.

## Veri ve yedek

Senkron kapalıyken kayıtlar tarayıcıya özeldir. Ayarlar → **Yedeği indir** ile JSON alın, **Yedekten yükle** ile geri getirin. Okunamayan bir kayıt bulunursa üzerine yazılmadan `ales-yds-takip:v1:bozuk` anahtarına kopyalanır. Repoda kişisel puan/veri yoktur.

## Geliştirme

`index.html`, `style.css`, `app.js` (arayüz), `logic.js` (saf mantık), `sync.js` + `firebase-config.js` (senkron).

```
node --test test/logic.test.js test/v2.test.js   # birim testleri
node test/ui-smoke.mjs                           # gerçek Chrome'da uçtan uca duman testi (Chrome yolu: CHROME)
```

Yayın: `main` dalının kökünden GitHub Pages.
