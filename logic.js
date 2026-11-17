/* Saf mantık: DOM yok, yan etki yok. Tarayıcıda window.Logic, Node'da module.exports. */
(function (root) {
  'use strict';

  var KUTU_GUN = [0, 1, 3, 7, 16, 35]; // Leitner: kutu -> bir sonraki tekrara kadar gün

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function bugun(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function gunEkle(tarih, n) {
    var p = tarih.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return bugun(d);
  }
  function gunFarki(a, b) { // b - a, gün
    var pa = a.split('-'), pb = b.split('-');
    var da = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]);
    var db = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((db - da) / 86400000);
  }
  function haftaBasi(tarih) { // Pazartesi
    var p = tarih.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var g = (d.getDay() + 6) % 7;
    return gunEkle(tarih, -g);
  }

  /* YDS: puan = doğru × 1,25 (80 soruda). Bölüm denemesinde aynı oran (doğru/soru × 100). */
  function ydsPuan(dogru, soru) {
    if (!soru) return 0;
    return Math.round((dogru / soru) * 1000) / 10;
  }
  function ydsHarf(puan) {
    if (puan >= 90) return 'A';
    if (puan >= 80) return 'B';
    if (puan >= 70) return 'C';
    if (puan >= 60) return 'D';
    if (puan >= 50) return 'E';
    return '—';
  }
  /* ALES: 4 yanlış 1 doğruyu götürür. */
  function alesNet(dogru, yanlis) {
    return Math.round((dogru - yanlis / 4) * 100) / 100;
  }

  /* Deneme kaydından görüntülenecek tek değer (grafikte y ekseni). */
  function denemeDeger(d) {
    if (d.sinav === 'yds') return ydsPuan(d.dogru, d.soru);
    return alesNet(d.dogru, d.yanlis || 0);
  }

  function dogrula(d, yeniSoruSayisi) {
    var hatalar = [];
    if (!(d.soru > 0)) hatalar.push('Soru sayısı 0’dan büyük olmalı.');
    if (!(d.dogru >= 0)) hatalar.push('Doğru sayısı geçersiz.');
    if (d.dogru > d.soru) hatalar.push('Doğru sayısı soru sayısını aşamaz.');
    if (d.sinav !== 'yds') {
      if (!(d.yanlis >= 0)) hatalar.push('Yanlış sayısı geçersiz.');
      if (d.dogru + d.yanlis > d.soru) hatalar.push('Doğru + yanlış soru sayısını aşamaz.');
    }
    return hatalar;
  }

  /* Haftalık dakika: haftaBasi'ndan 7 gün, günlük dizi. */
  function haftalik(calisma, haftaBasiTarihi) {
    var gunler = [0, 0, 0, 0, 0, 0, 0];
    calisma.forEach(function (c) {
      var f = gunFarki(haftaBasiTarihi, c.tarih);
      if (f >= 0 && f < 7) gunler[f] += c.dk;
    });
    return gunler;
  }

  /* Seri: bugün (ya da bugün boşsa dünden) geriye ardışık çalışılan gün sayısı. */
  function seri(calisma, bugunTarihi) {
    var set = {};
    calisma.forEach(function (c) { if (c.dk > 0) set[c.tarih] = true; });
    var t = set[bugunTarihi] ? bugunTarihi : gunEkle(bugunTarihi, -1);
    var n = 0;
    while (set[t]) { n++; t = gunEkle(t, -1); }
    return n;
  }

  /* Leitner: bildi -> bir kutu ilerle, bilemedi -> kutu 0. Yeni durum döner. */
  function kartCevapla(kart, bildi, bugunTarihi) {
    var kutu = bildi ? Math.min(kart.kutu + 1, KUTU_GUN.length - 1) : 0;
    var gun = KUTU_GUN[kutu];
    if (!bildi) gun = 0; // aynı oturumda değil, ama bugün tekrar listesinde kalsın
    return Object.assign({}, kart, {
      kutu: kutu, son: bugunTarihi, guncel: Date.now(),
      sonraki: bildi ? gunEkle(bugunTarihi, gun) : gunEkle(bugunTarihi, 1)
    });
  }
  function bugunTekrar(kartlar, bugunTarihi) {
    return kartlar.filter(function (k) { return k.sonraki <= bugunTarihi; });
  }

  /* "en - tr" satırları. Ayraç: " - ", " – ", "=", ";" veya sekme. Geçersiz satırları sayar. */
  function kelimeAyikla(metin) {
    var sonuc = [], atlanan = 0;
    String(metin).split(/\r?\n/).forEach(function (satir) {
      satir = satir.trim();
      if (!satir) return;
      var m = satir.match(/^(.+?)\s*(?:\t|\s[-–—]\s|=|;)\s*(.+)$/);
      if (!m) { atlanan++; return; }
      sonuc.push({ en: m[1].trim(), tr: m[2].trim() });
    });
    return { kelimeler: sonuc, atlanan: atlanan };
  }

  function geriSayim(tarih, bugunTarihi) { return gunFarki(bugunTarihi, tarih); }

  /* İçe aktarılan JSON'un biçimini denetle; bozuksa null. */
  function durumDogrula(o) {
    if (!o || typeof o !== 'object' || o.v !== 1) return null;
    var dizi = ['calisma', 'deneme', 'hata', 'kelime'];
    for (var i = 0; i < dizi.length; i++) if (!Array.isArray(o[dizi[i]])) return null;
    if (!o.ayar || typeof o.ayar !== 'object' || !Array.isArray(o.ayar.tarihler)) return null;
    if (!o.konu || typeof o.konu !== 'object') return null;
    return o;
  }

  /* ---------- 2027 ÖSYM takvimi (ikincil kaynaklar; ÖSYM sayfasından doğrulanmadı) ---------- */
  var TAKVIM_2027 = [
    { ad: 'YÖKDİL/1', tur: 'yds', tarih: '2027-02-28', basvuru: ['2027-01-12', '2027-01-20'], sonuc: '2027-03-26' },
    { ad: 'YDS/1', tur: 'yds', tarih: '2027-03-28', basvuru: ['2027-02-03', '2027-02-11'], sonuc: '2027-04-21' },
    { ad: 'ALES/1', tur: 'ales', tarih: '2027-04-18', basvuru: ['2027-02-24', '2027-03-04'], sonuc: '2027-05-07' },
    { ad: 'ALES/2', tur: 'ales', tarih: '2027-07-11', basvuru: ['2027-05-25', '2027-06-02'], sonuc: '2027-07-30' },
    { ad: 'YÖKDİL/2', tur: 'yds', tarih: '2027-07-25', basvuru: ['2027-06-08', '2027-06-16'], sonuc: '2027-08-13' },
    { ad: 'YDS/2', tur: 'yds', tarih: '2027-11-21', basvuru: ['2027-10-05', '2027-10-13'], sonuc: '2027-12-10' },
    { ad: 'ALES/3', tur: 'ales', tarih: '2027-11-28', basvuru: ['2027-10-12', '2027-10-20'], sonuc: '2027-12-17' }
  ];
  function takvimTur(ad) { return /^ALES/.test(ad) ? 'ales' : 'yds'; }
  function takvimSatiri(t, i) {
    return { id: 'd' + (i + 1), ad: t.ad, tarih: t.tarih, basvuru: t.basvuru, sonuc: t.sonuc, dogrulandi: false };
  }
  /* Kayıtlı tarih listesine takvimi ekler; kullanıcının dokunduğu satıra (aynı ad) başvuru/sonuç bilgisini
     yalnız eksikse tamamlar, tarihine ve "doğrulandı" işaretine dokunmaz. Eksik sınavları ekler. */
  function takvimiBirlestir(tarihler) {
    var cikti = tarihler.map(function (t) { return Object.assign({}, t); });
    TAKVIM_2027.forEach(function (k, i) {
      var var_ = cikti.filter(function (t) { return t.ad === k.ad; })[0];
      if (var_) {
        if (!var_.basvuru && var_.tarih === k.tarih) { var_.basvuru = k.basvuru; var_.sonuc = k.sonuc; }
      } else {
        var s = takvimSatiri(k, i); s.id = 'k' + (i + 1); cikti.push(s);
      }
    });
    return cikti;
  }

  /* ---------- Başvuru hatırlatması ---------- */
  /* Her sınav için: başvuru açılmadıysa kalan gün (≤21 gün kala uyar), açıksa son güne kalan gün. */
  function basvuruDurumu(tarihler, bg) {
    var cikti = [];
    tarihler.forEach(function (t) {
      if (!t.basvuru || !t.basvuru[0] || !t.basvuru[1]) return;
      if (gunFarki(bg, t.tarih) < 0) return; // sınav geçti
      var acilis = gunFarki(bg, t.basvuru[0]), kapanis = gunFarki(bg, t.basvuru[1]);
      if (kapanis < 0) return;
      if (acilis > 0 && acilis <= 21) cikti.push({ ad: t.ad, durum: 'yakin', gun: acilis, acilis: t.basvuru[0], kapanis: t.basvuru[1] });
      else if (acilis <= 0) cikti.push({ ad: t.ad, durum: 'acik', gun: kapanis, acilis: t.basvuru[0], kapanis: t.basvuru[1] });
    });
    return cikti.sort(function (a, b) { return a.gun - b.gun; });
  }

  /* ---------- ALES puan tahmini ---------- */
  /* ÖSYM katsayı yayımlamaz; puan her oturumun ortalama/standart sapmasına bağlı. Bu yüzden tahmin
     yalnızca Emre'nin GERÇEK sonuçlarından kurulur: sonuç yoksa null (uydurma katsayı yok).
     sonuclar: [{tur:'sayisal'|'sozel', net, puan}]. */
  function alesTahmin(sonuclar, tur, net) {
    var s = (sonuclar || []).filter(function (x) { return x.tur === tur && x.net >= 0 && x.puan > 0; });
    if (!s.length) return null;
    var n = s.length;
    var mx = s.reduce(function (a, x) { return a + x.net; }, 0) / n;
    var my = s.reduce(function (a, x) { return a + x.puan; }, 0) / n;
    var egim = 0.8, yayilim = 0;
    s.forEach(function (x) { yayilim = Math.max(yayilim, Math.abs(x.net - mx)); });
    if (n >= 2 && yayilim >= 1.5) {
      var sxy = 0, sxx = 0;
      s.forEach(function (x) { sxy += (x.net - mx) * (x.puan - my); sxx += (x.net - mx) * (x.net - mx); });
      egim = Math.min(1.5, Math.max(0.3, sxy / sxx));
    }
    var orta = my + egim * (net - mx);
    var sd = 0;
    if (n >= 3) {
      var ss = 0; s.forEach(function (x) { var r = x.puan - (my + egim * (x.net - mx)); ss += r * r; });
      sd = Math.sqrt(ss / (n - 2 > 0 ? n - 2 : 1));
    }
    var pay = Math.max(n === 1 ? 4 : 2.5, sd * 1.5);
    var yuvar = function (v) { return Math.round(Math.max(0, Math.min(100, v)) * 10) / 10; };
    return { orta: yuvar(orta), alt: yuvar(orta - pay), ust: yuvar(orta + pay), nokta: n, egim: Math.round(egim * 100) / 100 };
  }

  /* Hedef puan için gereken net (tahmin doğrusunun tersi). Sonuç yoksa null. */
  function alesHedefNet(sonuclar, tur, hedefPuan) {
    var a = alesTahmin(sonuclar, tur, 0), b = alesTahmin(sonuclar, tur, 40);
    if (!a || !b) return null;
    var egim = (b.orta - a.orta) / 40;
    if (!(egim > 0)) return null;
    return Math.round(((hedefPuan - a.orta) / egim) * 10) / 10;
  }

  /* ---------- Günün planı ---------- */
  function dkToplam(calisma, tarih, alan) {
    return calisma.reduce(function (a, c) { return a + (c.tarih === tarih && (!alan || c.sinav === alan) ? c.dk : 0); }, 0);
  }
  function yaklasanSinav(tarihler, bg) {
    var g = tarihler.filter(function (t) { return gunFarki(bg, t.tarih) >= 0; })
      .sort(function (a, b) { return a.tarih < b.tarih ? -1 : 1; });
    return g[0] || null;
  }
  /* Bugünün en fazla 4 maddesi: kart tekrarı, çalışma payı, hata gözden geçirme, deneme.
     Her madde {anahtar, baslik, ayrinti, bitti}. Ek veri tutmadan, kayıtlardan türetilir. */
  function gunlukPlan(d, bg) {
    var plan = [];
    var tur = takvimTur((yaklasanSinav(d.ayar.tarihler, bg) || { ad: 'YDS' }).ad); // hangi alan önde
    // 1. Kelime kartları
    var bekleyen = bugunTekrar(d.kelime, bg).length;
    var bugunCevap = d.kelime.filter(function (k) { return k.son === bg; }).length;
    if (bekleyen + bugunCevap > 0) {
      plan.push({ anahtar: 'kelime', baslik: 'Kelime kartları', bitti: bekleyen === 0,
        ayrinti: bekleyen ? bekleyen + ' kart bekliyor (~' + Math.max(2, Math.round(bekleyen * 0.4)) + ' dk)' : 'Bugünkü tekrar bitti' });
    }
    // 2. Çalışma payı: haftalık hedefin kalanı, kalan güne bölünür; en az 20, en çok 120 dk
    var hb = haftaBasi(bg), kalanGun = 7 - gunFarki(hb, bg);
    var hedefDk = d.ayar.haftalikSaat * 60;
    var buHafta = haftalik(d.calisma, hb).reduce(function (a, b) { return a + b; }, 0);
    var bugunDk = dkToplam(d.calisma, bg);
    var haftaBaslangicBugun = buHafta - bugunDk;
    var pay = Math.round(Math.max(20, Math.min(120, (hedefDk - haftaBaslangicBugun) / kalanGun)) / 5) * 5;
    var yds = 0, ales = 0;
    d.calisma.forEach(function (c) { var f = gunFarki(hb, c.tarih); if (f >= 0 && f < 7) { if (c.sinav === 'ales') ales += c.dk; else yds += c.dk; } });
    var oncelik = tur === 'ales' ? 'ales' : 'yds';
    var toplam = yds + ales;
    if (toplam >= 120 && (oncelik === 'ales' ? ales : yds) / toplam > 0.7) oncelik = oncelik === 'ales' ? 'yds' : 'ales';
    plan.push({ anahtar: 'calisma', baslik: pay + ' dk ' + (oncelik === 'ales' ? 'ALES' : 'YDS / İngilizce') + ' çalış', bitti: bugunDk >= pay,
      ayrinti: bugunDk ? 'Bugün ' + bugunDk + ' dk' : (oncelik === 'ales' ? 'Sınava yakın alan' : 'Sınava yakın alan'), alan: oncelik, dk: pay });
    // 3. Hata defteri
    var acik = d.hata.filter(function (x) { return !x.cozuldu; });
    var bugunCozulen = d.hata.filter(function (x) { return x.cozulduTarih === bg; }).length;
    if (acik.length + bugunCozulen > 0) {
      plan.push({ anahtar: 'hata', baslik: 'Hata defterinden 3 soruyu yeniden çöz', bitti: bugunCozulen >= 1,
        ayrinti: acik.length + ' açık hata' + (bugunCozulen ? ' · bugün ' + bugunCozulen + ' çözüldü' : '') });
    }
    // 4. Deneme: son 14 günde yoksa
    var son14 = d.deneme.filter(function (x) { return gunFarki(x.tarih, bg) >= 0 && gunFarki(x.tarih, bg) <= 14; });
    var bugunDeneme = d.deneme.filter(function (x) { return x.tarih === bg; }).length;
    if (!son14.length || bugunDeneme) {
      plan.push({ anahtar: 'deneme', baslik: d.deneme.length ? 'Bir deneme çöz' : 'İlk deneme: baz çizgini ölç', bitti: bugunDeneme > 0,
        ayrinti: bugunDeneme ? 'Bugün çözdün' : (d.deneme.length ? 'Son 14 günde deneme yok' : 'Gidişat grafiği ilk denemeden sonra başlar') });
    }
    return plan;
  }

  /* ---------- Haftalık özet ---------- */
  function haftalikOzet(d, bg) {
    var hb = haftaBasi(bg), onceki = gunEkle(hb, -7);
    var bu = haftalik(d.calisma, hb).reduce(function (a, b) { return a + b; }, 0);
    var once = haftalik(d.calisma, onceki).reduce(function (a, b) { return a + b; }, 0);
    var gunSay = haftalik(d.calisma, hb).filter(function (x) { return x > 0; }).length;
    var nedenSay = {}, enNeden = null;
    d.hata.forEach(function (x) { if (gunFarki(hb, x.tarih) >= -14) nedenSay[x.neden] = (nedenSay[x.neden] || 0) + 1; });
    Object.keys(nedenSay).forEach(function (k) { if (!enNeden || nedenSay[k] > nedenSay[enNeden]) enNeden = k; });
    return { bu: bu, once: once, gunSay: gunSay, enNeden: enNeden, enNedenSay: enNeden ? nedenSay[enNeden] : 0 };
  }

  /* Hedefe giden yol: son net/puan, hedef, sınava kalan hafta, haftada gereken artış. */
  function hedefYolu(d, bg, sinavKey) {
    var seri_ = d.deneme.filter(function (x) { return x.sinav === sinavKey; }).sort(function (a, b) { return a.tarih < b.tarih ? -1 : 1; });
    if (!seri_.length) return null;
    var son = denemeDeger(seri_[seri_.length - 1]);
    var hedef = sinavKey === 'yds' ? d.ayar.ydsHedef : d.ayar.alesHedefNet;
    var ad = sinavKey === 'yds' ? 'YDS' : 'ALES';
    var sinav = yaklasanSinav(d.ayar.tarihler.filter(function (t) { return takvimTur(t.ad) === (sinavKey === 'yds' ? 'yds' : 'ales'); }), bg);
    if (!sinav) return null;
    var hafta = Math.max(1, Math.ceil(gunFarki(bg, sinav.tarih) / 7));
    var fark = Math.round((hedef - son) * 10) / 10;
    return { sinav: ad, sinavAd: sinav.ad, son: son, hedef: hedef, hafta: hafta, fark: fark, haftalik: fark > 0 ? Math.round(fark / hafta * 10) / 10 : 0, tamam: fark <= 0 };
  }

  /* Ara verildiyse (son çalışmadan beri ≥2 gün) yumuşak dönüş cümlesi; yoksa null. */
  function araMesaji(calisma, bg) {
    if (!calisma.length) return null;
    var son = calisma.reduce(function (a, c) { return c.tarih > a ? c.tarih : a; }, '0000-00-00');
    var ara = gunFarki(son, bg);
    return ara >= 2 ? { gun: ara } : null;
  }

  /* ---------- Senkron birleştirme ---------- */
  var DIZILER = ['calisma', 'deneme', 'hata', 'kelime', 'alesSonuc'];
  function kayitZamani(x) { return x && x.guncel ? x.guncel : 0; }
  /* İki cihaz durumunu birleştirir. Diziler id ile birleşir, çakışmada daha yeni `guncel` kazanır;
     silinenler `silinen` ({id: zaman}) ile anılır ki geri gelmesinler. Ayar/konu: `guncel`i yeni olan kazanır. */
  function durumBirlestir(a, b) {
    var sil = Object.assign({}, a.silinen || {}, b.silinen || {});
    Object.keys(b.silinen || {}).forEach(function (k) { if ((a.silinen || {})[k] > b.silinen[k]) sil[k] = a.silinen[k]; });
    var yeni = (a.guncel || 0) >= (b.guncel || 0) ? a : b, eski = yeni === a ? b : a;
    var sonuc = Object.assign({}, eski, yeni);
    sonuc.ayar = Object.assign({}, eski.ayar, yeni.ayar);
    sonuc.ayar.tarihler = takvimiBirlestir(yeni.ayar.tarihler);
    sonuc.konu = Object.assign({}, eski.konu, yeni.konu);
    DIZILER.forEach(function (ad) {
      var harita = {};
      (eski[ad] || []).concat(yeni[ad] || []).forEach(function (x) {
        var o = harita[x.id];
        if (!o || kayitZamani(x) >= kayitZamani(o)) harita[x.id] = x;
      });
      sonuc[ad] = Object.keys(harita).map(function (k) { return harita[k]; }).filter(function (x) {
        return !(sil[x.id] && sil[x.id] >= kayitZamani(x));
      });
    });
    sonuc.silinen = sil;
    sonuc.guncel = Math.max(a.guncel || 0, b.guncel || 0);
    return sonuc;
  }

  /* ---------- Oyunlaştırma: kayıtlardan türetilir, ayrıca saklanan bir sayı yok ---------- */
  var XP_KURAL = { calismaDk: 1, deneme: 40, hataCozuldu: 8, kartKutu: 3, konuCalistim: 6, konuTamam: 15 };
  var UNVANLAR = [[1, 'Çaylak'], [3, 'Çırak'], [5, 'Gezgin'], [8, 'Kâşif'], [12, 'Usta'], [17, 'Büyücü'], [23, 'Efsane']];

  function xpHesapla(d) {
    var k = XP_KURAL, xp = 0;
    d.calisma.forEach(function (c) { xp += (c.dk > 0 ? c.dk : 0) * k.calismaDk; });
    xp += d.deneme.length * k.deneme;
    d.hata.forEach(function (x) { if (x.cozuldu) xp += k.hataCozuldu; });
    d.kelime.forEach(function (c) { xp += (c.kutu > 0 ? c.kutu : 0) * k.kartKutu; });
    Object.keys(d.konu || {}).forEach(function (a) { xp += d.konu[a] === 2 ? k.konuTamam : d.konu[a] === 1 ? k.konuCalistim : 0; });
    return xp;
  }
  /* Seviye n, 50·(n−1)² XP'de başlar: 1→2: 50, 2→3: 150, 3→4: 250 ... */
  function seviyeEsik(n) { return 50 * (n - 1) * (n - 1); }
  function unvan(sv) { var u = UNVANLAR[0][1]; UNVANLAR.forEach(function (x) { if (sv >= x[0]) u = x[1]; }); return u; }
  function fidanAsama(sv) { return sv < 3 ? 0 : sv < 6 ? 1 : sv < 10 ? 2 : 3; }

  function enUzunSeri(calisma) {
    var gunler = {}, liste = [];
    calisma.forEach(function (c) { if (c.dk > 0 && !gunler[c.tarih]) { gunler[c.tarih] = true; liste.push(c.tarih); } });
    liste.sort();
    var en = 0, n = 0, onceki = null;
    liste.forEach(function (t) {
      n = onceki && gunFarki(onceki, t) === 1 ? n + 1 : 1;
      if (n > en) en = n;
      onceki = t;
    });
    return en;
  }

  /* Rozet tanımları: ad, nasıl açılır, simge, koşul. Koşullar yalnız kayıtlara bakar. */
  var ROZETLER = [
    { id: 'ilk-adim', ad: 'İlk adım', nasil: 'İlk çalışma kaydını gir', simge: '▲', kosul: function (d) { return d.calisma.some(function (c) { return c.dk > 0; }); } },
    { id: 'seri-3', ad: 'Isınma', nasil: '3 gün üst üste çalış', simge: '♦', kosul: function (d) { return enUzunSeri(d.calisma) >= 3; } },
    { id: 'seri-7', ad: 'Bir hafta', nasil: '7 gün üst üste çalış', simge: '★', kosul: function (d) { return enUzunSeri(d.calisma) >= 7; } },
    { id: 'seri-30', ad: 'Demirci', nasil: '30 gün üst üste çalış', simge: '✦', kosul: function (d) { return enUzunSeri(d.calisma) >= 30; } },
    { id: 'saat-10', ad: 'On saat', nasil: 'Toplam 10 saat çalış', simge: '●', kosul: function (d) { return dkTumu(d) >= 600; } },
    { id: 'saat-50', ad: 'Elli saat', nasil: 'Toplam 50 saat çalış', simge: '◆', kosul: function (d) { return dkTumu(d) >= 3000; } },
    { id: 'ilk-deneme', ad: 'Sınav provası', nasil: 'İlk denemeni gir', simge: '✚', kosul: function (d) { return d.deneme.length >= 1; } },
    { id: 'deneme-5', ad: 'Savaş tecrübesi', nasil: '5 deneme gir', simge: '⚔', kosul: function (d) { return d.deneme.length >= 5; } },
    { id: 'kelime-50', ad: 'Sözlük kurdu', nasil: '50 kelime kartı ekle', simge: '✎', kosul: function (d) { return d.kelime.length >= 50; } },
    { id: 'kutu-4', ad: 'Hafızada kalıcı', nasil: '10 kartı 5. kutuya çıkar', simge: '♥', kosul: function (d) { return d.kelime.filter(function (c) { return c.kutu >= 4; }).length >= 10; } },
    { id: 'hata-10', ad: 'Hata avcısı', nasil: '10 hatayı çözüldü yap', simge: '⚑', kosul: function (d) { return d.hata.filter(function (x) { return x.cozuldu; }).length >= 10; } },
    { id: 'konu-yari', ad: 'Yolun yarısı', nasil: 'Konuların yarısını bitir', simge: '◐', kosul: function (d, konuToplam) {
      if (!konuToplam) return false;
      var bitti = 0; Object.keys(d.konu || {}).forEach(function (a) { bitti += (d.konu[a] || 0) / 2; });
      return bitti / konuToplam >= 0.5;
    } }
  ];
  function dkTumu(d) { return d.calisma.reduce(function (a, c) { return a + (c.dk > 0 ? c.dk : 0); }, 0); }

  /* konuToplam: uygulamadaki toplam konu sayısı (liste app.js'te). */
  function oyuncu(d, konuToplam) {
    var xp = xpHesapla(d);
    var sv = Math.floor(Math.sqrt(xp / 50)) + 1;
    var bas = seviyeEsik(sv), son = seviyeEsik(sv + 1);
    return {
      xp: xp, seviye: sv, unvan: unvan(sv), asama: fidanAsama(sv),
      seviyeXp: xp - bas, seviyeGerek: son - bas, yuzde: (xp - bas) / (son - bas) * 100,
      rozetler: ROZETLER.map(function (r) { return { id: r.id, ad: r.ad, nasil: r.nasil, simge: r.simge, acik: !!r.kosul(d, konuToplam) }; })
    };
  }

  var api = {
    XP_KURAL: XP_KURAL, xpHesapla: xpHesapla, seviyeEsik: seviyeEsik, enUzunSeri: enUzunSeri, oyuncu: oyuncu,
    KUTU_GUN: KUTU_GUN, bugun: bugun, gunEkle: gunEkle, gunFarki: gunFarki, haftaBasi: haftaBasi,
    ydsPuan: ydsPuan, ydsHarf: ydsHarf, alesNet: alesNet, denemeDeger: denemeDeger, dogrula: dogrula,
    haftalik: haftalik, seri: seri, kartCevapla: kartCevapla, bugunTekrar: bugunTekrar,
    kelimeAyikla: kelimeAyikla, geriSayim: geriSayim, durumDogrula: durumDogrula,
    TAKVIM_2027: TAKVIM_2027, takvimTur: takvimTur, takvimiBirlestir: takvimiBirlestir, basvuruDurumu: basvuruDurumu,
    alesTahmin: alesTahmin, alesHedefNet: alesHedefNet, gunlukPlan: gunlukPlan, haftalikOzet: haftalikOzet,
    hedefYolu: hedefYolu, araMesaji: araMesaji, durumBirlestir: durumBirlestir
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : this);
