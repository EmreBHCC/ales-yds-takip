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
      kutu: kutu,
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

  var api = {
    KUTU_GUN: KUTU_GUN, bugun: bugun, gunEkle: gunEkle, gunFarki: gunFarki, haftaBasi: haftaBasi,
    ydsPuan: ydsPuan, ydsHarf: ydsHarf, alesNet: alesNet, denemeDeger: denemeDeger, dogrula: dogrula,
    haftalik: haftalik, seri: seri, kartCevapla: kartCevapla, bugunTekrar: bugunTekrar,
    kelimeAyikla: kelimeAyikla, geriSayim: geriSayim, durumDogrula: durumDogrula
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : this);
