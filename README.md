# ALES · YDS takip

ALES ve YDS/YÖKDİL hazırlığını izlemek için tek sayfalık web uygulaması. Hesap, sunucu, API ya da yapay zekâ çağrısı yok; her şey tarayıcıda çalışır ve veri yalnızca o tarayıcıda (`localStorage`) durur.

**Canlı:** https://emrebhcc.github.io/ales-yds-takip/

## Özellikler

- **Bugün:** sınav geri sayımı, haftalık çalışma çubuğu ve hedef, seri, bekleyen kelime kartları, son denemeler
- **Çalışma:** günlük kayıt, kronometre (sayfa yenilense de sürer)
- **Deneme:** YDS (puan = doğru × 1,25, harf notu) ve ALES (net = doğru − yanlış/4); hedef çizgili gidişat grafiği
- **Hata defteri:** konu, neden, not, çözüldü işareti; nedene göre dağılım
- **Kelime kartları:** aralıklı tekrar (1-3-7-16-35 gün), toplu ekleme (`kelime - karşılık`)
- **Konular:** ALES ve YDS konu listesi, üç durumlu ilerleme
- **Ayarlar:** hedefler, sınav tarihleri, açık/koyu tema, JSON yedek indirme ve yükleme

## Veri ve yedek

Kayıtlar tarayıcıya özeldir: başka cihazda ya da tarayıcı verisi silindikten sonra görünmez. Ayarlar → **Yedeği indir** ile JSON alın, **Yedekten yükle** ile geri getirin. Okunamayan bir kayıt bulunursa üzerine yazılmadan `ales-yds-takip:v1:bozuk` anahtarına kopyalanır.

## Sınav tarihleri

Varsayılan tarihler (YÖKDİL/1 28 Şubat, YDS/1 28 Mart, ALES/1 18 Nisan 2027) ikincil kaynaklardan alınmış taslaktır; osym.gov.tr’den doğrulanmalıdır. ÖSYM tarih değiştirebilir. Ayarlar’dan düzenlenir, doğrulayınca “doğrulandı” işaretlenir.

## Geliştirme

Derleme yok, bağımlılık yok: `index.html`, `style.css`, `app.js`, `logic.js` (saf mantık).

```
node --test test/logic.test.js   # birim testleri
node test/ui-smoke.mjs           # gerçek Chrome'da uçtan uca duman testi (Chrome yolu: CHROME)
```

Yayın: `main` dalının kökünden GitHub Pages.
