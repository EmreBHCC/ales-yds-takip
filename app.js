(function () {
  'use strict';
  var L = window.Logic;
  var ANAHTAR = 'ales-yds-takip:v1';
  var ZAMAN_ANAHTAR = 'ales-yds-takip:zamanlayici';

  var SINAVLAR = {
    'ales-sayisal': { ad: 'ALES Sayısal', kisa: 'ALES-S', soru: 50, sinif: 'ales', ales: true },
    'ales-sozel': { ad: 'ALES Sözel', kisa: 'ALES-Sö', soru: 50, sinif: 'ales', ales: true },
    'yds': { ad: 'YDS / YÖKDİL', kisa: 'YDS', soru: 80, sinif: 'yds', ales: false }
  };
  var CALISMA_ALANLARI = { ales: 'ALES', yds: 'YDS / İngilizce' };
  var NEDENLER = ['Bilgi eksiği', 'Dikkat hatası', 'Süre yetmedi', 'Kelime bilmiyordum', 'Tahminle doğru çıktı', 'Soruyu yanlış okudum'];

  var KONULAR = [
    { grup: 'ALES · Temel matematik', konular: ['Temel kavramlar', 'Bölme ve bölünebilme', 'Rasyonel sayılar', 'Üslü ve köklü ifadeler', 'Mutlak değer', 'Eşitsizlikler', 'Çarpanlara ayırma'] },
    { grup: 'ALES · Problemler', konular: ['Sayı ve kesir problemleri', 'Yaş problemleri', 'Yüzde, kâr-zarar', 'Hız problemleri', 'Tablo ve grafik yorumu'] },
    { grup: 'ALES · Sayısal mantık', konular: ['Sayı dizileri', 'Örüntüler', 'Modüler kurgular', 'İşlem yeteneği'] },
    { grup: 'ALES · Geometri', konular: ['Doğruda ve üçgende açılar', 'Özel üçgenler', 'Çokgenler', 'Çember ve daire', 'Analitik geometri'] },
    { grup: 'ALES · Sözel', konular: ['Paragraf', 'Sözel mantık'] },
    { grup: 'YDS · Dil bilgisi', konular: ['Tenses', 'Modals', 'Active / passive', 'Conjunctions ve transitions', 'Relative clauses', 'Noun clauses', 'Prepositions'] },
    { grup: 'YDS · Soru tipleri', konular: ['Kelime bilgisi', 'Cloze test', 'Cümle tamamlama', 'Çeviri (İng-Tür / Tür-İng)', 'Paragraf soruları', 'Diyalog tamamlama', 'Restatement', 'Paragraf tamamlama', 'Anlam bütünlüğünü bozan cümle'] }
  ];

  function varsayilan() {
    return {
      v: 1,
      ayar: {
        ydsHedef: 80, alesHedefNet: 40, alesHedefPuan: 70, haftalikSaat: 5, tema: 'oto', sonYedek: null,
        tarihler: L.takvimiBirlestir([])
      },
      calisma: [], deneme: [], hata: [], kelime: [], konu: {}, alesSonuc: [], silinen: {}, guncel: 0
    };
  }
  /* Eski/eksik alanları varsayılanla doldurur; sınav takvimini eksik satırlarla tamamlar. */
  function tamamla(o) {
    var v = varsayilan();
    Object.keys(v.ayar).forEach(function (k) { if (o.ayar[k] === undefined) o.ayar[k] = v.ayar[k]; });
    o.ayar.tarihler = L.takvimiBirlestir(o.ayar.tarihler);
    if (!Array.isArray(o.alesSonuc)) o.alesSonuc = [];
    if (!o.silinen || typeof o.silinen !== 'object') o.silinen = {};
    if (typeof o.guncel !== 'number') o.guncel = 0;
    return o;
  }

  /* ---------- depolama ---------- */
  var depoVar = true, bozukKayit = false;
  var durum;
  function yukle() {
    var ham = null;
    try { ham = localStorage.getItem(ANAHTAR); } catch (e) { depoVar = false; return varsayilan(); }
    if (ham) {
      var o = null;
      try { o = L.durumDogrula(JSON.parse(ham)); } catch (e) { o = null; }
      if (o) return o;
      // Okunamayan kayıt: üzerine yazmadan önce ayrı anahtara kopyala, kullanıcı kurtarabilsin.
      try { localStorage.setItem(ANAHTAR + ':bozuk', ham); } catch (e) { }
      bozukKayit = true;
    }
    return varsayilan();
  }
  function kaydet(yerel) {
    if (!yerel) durum.guncel = Date.now(); // yerel=true: buluttan gelen birleşik durum, zamanı bozulmasın
    try { localStorage.setItem(ANAHTAR, JSON.stringify(durum)); depoVar = true; }
    catch (e) { depoVar = false; uyar(); }
    if (!yerel && window.Sync) window.Sync.degisti();
  }
  /* Silinen kaydı diziden çıkarır ve iz bırakır (senkronda geri dirilmesin). */
  function sil(dizi, kid) {
    durum[dizi] = durum[dizi].filter(function (x) { return x.id !== kid; });
    durum.silinen[kid] = Date.now();
  }
  function uyar() {
    var u = document.getElementById('uyari');
    if (!depoVar) { u.hidden = false; u.textContent = 'Tarayıcı kayıt tutmuyor (gizli pencere ya da site verisi kapalı olabilir). Girdiğin veri sekme kapanınca kaybolur; Ayarlar’dan yedek alabilirsin.'; }
    else if (bozukKayit) { u.hidden = false; u.textContent = 'Önceki kayıt okunamadı, boş başlandı. Eski ham veri tarayıcıda “ales-yds-takip:v1:bozuk” anahtarında duruyor.'; }
    else u.hidden = true;
  }
  durum = tamamla(yukle());

  /* ---------- yardımcılar ---------- */
  function h(tag, a) {
    var e = document.createElement(tag);
    a = a || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v === false || v == null) return;
      if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else if (k === 'class') e.className = v;
      else if (k === 'value') e.value = v;
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) ekle(e, arguments[i]);
    return e;
  }
  function ekle(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { ekle(e, x); });
    else e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function bugun() { return L.bugun(); }
  function sayi(v) { var n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? NaN : n; }
  function tarihTR(t) {
    var p = t.split('-'); var ay = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    return +p[2] + ' ' + ay[+p[1] - 1] + ' ' + p[0];
  }
  function saatDk(dk) {
    var s = Math.floor(dk / 60), m = dk % 60;
    return s ? s + ' sa ' + (m ? m + ' dk' : '') : m + ' dk';
  }
  function alan(etiket, girdi) { return h('div', {}, h('label', {}, etiket), girdi); }
  function secenekler(map, secili) {
    return Object.keys(map).map(function (k) {
      return h('option', { value: k, selected: k === secili }, typeof map[k] === 'string' ? map[k] : map[k].ad);
    });
  }
  function onayla(m) { return window.confirm(m); }

  /* ---------- grafik (inline SVG) ---------- */
  function svgEl(tag, a) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(a || {}).forEach(function (k) { e.setAttribute(k, a[k]); });
    for (var i = 2; i < arguments.length; i++) if (arguments[i] != null) e.appendChild(typeof arguments[i] === 'string' ? document.createTextNode(arguments[i]) : arguments[i]);
    return e;
  }
  function cizgiGrafik(noktalar, hedef, etiketY, aciklama) {
    var W = 640, Ht = 230, sol = 44, sag = 16, ust = 14, alt = 34;
    var vals = noktalar.map(function (n) { return n.y; });
    if (hedef != null) vals.push(hedef);
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var pay = Math.max((mx - mn) * 0.15, 2);
    mn = Math.max(0, Math.floor(mn - pay)); mx = Math.ceil(mx + pay);
    if (mx === mn) mx = mn + 1;
    var yx = function (v) { return ust + (Ht - ust - alt) * (1 - (v - mn) / (mx - mn)); };
    var n = noktalar.length;
    var xx = function (i) { return n === 1 ? (sol + (W - sol - sag) / 2) : sol + (W - sol - sag) * i / (n - 1); };
    var svg = svgEl('svg', { 'class': 'grafik', viewBox: '0 0 ' + W + ' ' + Ht, role: 'img', 'aria-label': aciklama });
    for (var t = 0; t <= 4; t++) {
      var v = mn + (mx - mn) * t / 4, y = yx(v);
      svg.appendChild(svgEl('line', { 'class': 'izgara-cizgi', x1: sol, x2: W - sag, y1: y, y2: y }));
      svg.appendChild(svgEl('text', { x: sol - 6, y: y + 4, 'text-anchor': 'end' }, String(Math.round(v * 10) / 10)));
    }
    if (hedef != null) {
      svg.appendChild(svgEl('line', { 'class': 'hedef', x1: sol, x2: W - sag, y1: yx(hedef), y2: yx(hedef) }));
      svg.appendChild(svgEl('text', { x: W - sag, y: yx(hedef) - 5, 'text-anchor': 'end' }, 'hedef ' + hedef));
    }
    if (n > 1) svg.appendChild(svgEl('polyline', { 'class': 'cizgi', points: noktalar.map(function (p, i) { return xx(i) + ',' + yx(p.y); }).join(' ') }));
    noktalar.forEach(function (p, i) {
      svg.appendChild(svgEl('circle', { 'class': 'nokta', cx: xx(i), cy: yx(p.y), r: 4.5 }, svgEl('title', {}, tarihTR(p.tarih) + ': ' + p.y + ' ' + etiketY)));
    });
    svg.appendChild(svgEl('text', { x: xx(0), y: Ht - 10, 'text-anchor': n === 1 ? 'middle' : 'start' }, tarihTR(noktalar[0].tarih)));
    if (n > 1) svg.appendChild(svgEl('text', { x: xx(n - 1), y: Ht - 10, 'text-anchor': 'end' }, tarihTR(noktalar[n - 1].tarih)));
    return svg;
  }

  /* ---------- yönlendirme ---------- */
  var SEKMELER = [
    ['bugun', 'Bugün'], ['calis', 'Çalışma'], ['deneme', 'Deneme'], ['hata', 'Hata defteri'],
    ['kelime', 'Kelime'], ['konu', 'Konular'], ['ayar', 'Ayarlar']
  ];
  var zamanlayiciTik = null;
  function aktifSekme() {
    var k = (location.hash || '').replace('#', '');
    return SEKMELER.some(function (s) { return s[0] === k; }) ? k : 'bugun';
  }
  function ciz() {
    if (zamanlayiciTik) { clearInterval(zamanlayiciTik); zamanlayiciTik = null; }
    var k = aktifSekme();
    var nav = document.getElementById('nav'); nav.textContent = '';
    SEKMELER.forEach(function (s) {
      nav.appendChild(h('a', { href: '#' + s[0], 'aria-current': s[0] === k ? 'page' : false }, s[1]));
    });
    var ana = document.getElementById('ana'); ana.textContent = '';
    ana.appendChild(EKRANLAR[k]());
    tema();
    uyar();
  }
  function yenile() { var y = window.scrollY; ciz(); window.scrollTo(0, y); }
  function tema() {
    var t = durum.ayar.tema;
    if (t === 'acik' || t === 'koyu') document.documentElement.setAttribute('data-tema', t);
    else document.documentElement.removeAttribute('data-tema');
  }

  /* ---------- Bugün: teşvik katmanı ---------- */
  var PLAN_SEKME = { kelime: '#kelime', calisma: '#calis', hata: '#hata', deneme: '#deneme' };
  function kartPlan(bg) {
    var plan = L.gunlukPlan(durum, bg);
    var biten = plan.filter(function (p) { return p.bitti; }).length;
    var tamam = biten === plan.length;
    var ara = L.araMesaji(durum.calisma, bg);
    var kart = h('div', { 'class': 'kart plan' },
      h('div', { 'class': 'satir' }, h('h3', { style: 'margin:0' }, 'Bugünün planı'), h('span', { 'class': 'bosluk' }), h('span', { 'class': 'soluk' }, biten + ' / ' + plan.length)),
      h('div', { 'class': 'cubuk', style: 'margin:.5rem 0', role: 'progressbar', 'aria-valuenow': biten, 'aria-valuemin': 0, 'aria-valuemax': plan.length, 'aria-label': 'Günün planı' },
        h('i', { style: 'width:' + (plan.length ? biten / plan.length * 100 : 0) + '%' })));
    if (ara && !tamam && !biten) kart.appendChild(h('p', { 'class': 'soluk' }, ara.gun + ' gündür ara var, sorun değil. Bugün tek bir maddeyle başla; ilki yeter.'));
    plan.forEach(function (p) {
      kart.appendChild(h('a', { href: PLAN_SEKME[p.anahtar], 'class': 'plan-satir' + (p.bitti ? ' bitti' : '') },
        h('span', { 'class': 'tik', 'aria-hidden': 'true' }, p.bitti ? '✓' : ''),
        h('span', { 'class': 'ad' }, h('strong', {}, p.baslik), h('span', { 'class': 'soluk' }, ' · ' + p.ayrinti)),
        h('span', { 'class': 'sr-only' }, p.bitti ? 'tamamlandı' : 'yapılacak')));
    });
    if (tamam) kart.appendChild(h('p', { 'class': 'tamam' }, 'Bugünlük tamam. Dinlen; yarın aynı yerden devam.'));
    return kart;
  }
  function kartBasvuru(bg) {
    var liste = L.basvuruDurumu(durum.ayar.tarihler, bg);
    if (!liste.length) return null;
    return h('div', { 'class': 'kart', style: 'border-color:var(--uyari)' },
      h('h3', {}, 'Başvuru takvimi'),
      liste.slice(0, 3).map(function (b) {
        return h('p', { style: 'margin:.25rem 0' }, h('strong', {}, b.ad), b.durum === 'acik'
          ? ' başvurusu açık: son gün ' + tarihTR(b.kapanis) + ' (' + (b.gun === 0 ? 'bugün' : b.gun + ' gün kaldı') + ')'
          : ' başvurusu ' + b.gun + ' gün sonra açılıyor (' + tarihTR(b.acilis) + ' – ' + tarihTR(b.kapanis) + ')');
      }),
      h('p', { 'class': 'soluk' }, 'Başvuruyu kaçırırsan sınava giremezsin. Tarihler taslak; ais.osym.gov.tr’den doğrula.'));
  }
  function kartYol(bg) {
    var parcalar = ['yds', 'ales-sayisal'].map(function (k) { return L.hedefYolu(durum, bg, k); }).filter(Boolean);
    if (!parcalar.length) return null;
    return h('div', { 'class': 'kart' }, h('h3', {}, 'Hedefe yol'), parcalar.map(function (y) {
      var birim = y.sinav === 'YDS' ? 'puan' : 'net';
      return h('p', { style: 'margin:.35rem 0' }, h('strong', {}, y.sinav + ' '), 'şu an ' + y.son + ', hedef ' + y.hedef + ' ' + birim + '. ',
        y.tamam ? 'Hedefe ulaştın; seviyeyi koru.'
          : y.sinavAd + '’e ' + y.hafta + ' hafta var: haftada ≈ ' + y.haftalik + ' ' + birim + ' artış yeter.');
    }));
  }
  function kartOzet(bg) {
    var o = L.haftalikOzet(durum, bg);
    if (!o.bu && !o.once) return null;
    var fark = o.bu - o.once;
    return h('div', { 'class': 'kart' }, h('h3', {}, 'Haftanın özeti'),
      h('p', { style: 'margin:.25rem 0' }, o.gunSay + ' gün çalıştın, toplam ' + saatDk(o.bu) + '.',
        o.once ? (fark >= 0 ? ' Geçen haftadan ' + saatDk(fark) + ' fazla.' : ' Geçen hafta ' + saatDk(o.once) + ' idi; bu hafta ' + saatDk(-fark) + ' geride, hafta bitmedi.') : ''),
      o.enNeden && o.enNedenSay >= 2 ? h('p', { 'class': 'soluk' }, 'Son iki haftada en sık hata nedenin “' + o.enNeden + '” (' + o.enNedenSay + '). Bir sonraki denemede buna dikkat et.') : null);
  }

  /* ---------- Bugün ---------- */
  function ekranBugun() {
    var bg = bugun(), kok = h('div');
    kok.appendChild(h('h2', {}, 'Bugün'));
    var bas = kartBasvuru(bg); if (bas) kok.appendChild(bas);
    kok.appendChild(kartPlan(bg));
    var yol = kartYol(bg); if (yol) kok.appendChild(h('div', { style: 'margin-top:1rem' }, yol));
    var oz = kartOzet(bg); if (oz) kok.appendChild(h('div', { style: 'margin-top:1rem' }, oz));
    kok.appendChild(h('div', { style: 'margin-top:1rem' }));

    // Sınav geri sayımı
    var tarihler = durum.ayar.tarihler.slice().sort(function (a, b) { return a.tarih < b.tarih ? -1 : 1; });
    var gelecek = tarihler.filter(function (t) { return L.geriSayim(t.tarih, bg) >= 0; });
    var sayacKartlari = gelecek.slice(0, 3).map(function (t) {
      var g = L.geriSayim(t.tarih, bg);
      return h('div', { 'class': 'kart' },
        h('div', { 'class': 'etiket' }, t.ad + ' · ' + tarihTR(t.tarih)),
        h('div', { 'class': 'sayac' }, String(g), ' ', h('small', {}, g === 0 ? 'bugün' : 'gün kaldı')),
        !t.dogrulandi && h('div', { 'class': 'soluk' }, 'Tarih taslak: ÖSYM’den doğrula'));
    });
    if (!sayacKartlari.length) sayacKartlari = [h('div', { 'class': 'kart' }, h('div', { 'class': 'etiket' }, 'Sınav tarihi yok'), h('a', { href: '#ayar' }, 'Ayarlar’dan ekle'))];

    // Hafta
    var hb = L.haftaBasi(bg), gunler = L.haftalik(durum.calisma, hb);
    var toplam = gunler.reduce(function (a, b) { return a + b; }, 0);
    var hedefDk = durum.ayar.haftalikSaat * 60;
    var enBuyuk = Math.max.apply(null, gunler.concat([30]));
    var adlar = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    var bgIdx = L.gunFarki(hb, bg);
    var hafta = h('div', { 'class': 'kart' },
      h('h3', {}, 'Bu hafta'),
      h('div', { 'class': 'sayac' }, saatDk(toplam), ' ', h('small', {}, '/ ' + durum.ayar.haftalikSaat + ' sa hedef')),
      h('div', { 'class': 'cubuk', role: 'progressbar', 'aria-valuenow': Math.min(100, Math.round(toplam / hedefDk * 100)), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Haftalık hedef' },
        h('i', { style: 'width:' + Math.min(100, toplam / hedefDk * 100) + '%' })),
      h('div', { 'class': 'hafta' }, gunler.map(function (dk, i) {
        return h('div', { 'class': i === bgIdx ? 'bugun' : '', title: saatDk(dk) }, h('i', { style: 'height:' + Math.max(2, dk / enBuyuk * 90) + 'px' }), adlar[i]);
      })));

    var seriN = L.seri(durum.calisma, bg);
    var tekrar = L.bugunTekrar(durum.kelime, bg).length;
    var tum = 0, bitti = 0;
    KONULAR.forEach(function (g) { g.konular.forEach(function (k) { tum++; bitti += (durum.konu[k] || 0) / 2; }); });
    var diger = h('div', { 'class': 'kart' },
      h('div', { 'class': 'etiket' }, 'Seri'),
      h('div', { 'class': 'sayac' }, String(seriN), ' ', h('small', {}, 'gün')),
      h('p', { 'class': 'soluk' }, seriN ? 'Bugün çalışırsan seri sürer.' : 'Bir çalışma kaydı seriyi başlatır.'),
      h('div', { 'class': 'etiket' }, 'Kelime tekrarı'),
      h('p', {}, tekrar ? h('a', { href: '#kelime' }, tekrar + ' kart bekliyor') : 'Bekleyen kart yok'),
      h('div', { 'class': 'etiket' }, 'Konu ilerlemesi'),
      h('div', { 'class': 'cubuk' }, h('i', { style: 'width:' + (tum ? bitti / tum * 100 : 0) + '%' })),
      h('p', { 'class': 'soluk' }, Math.round(tum ? bitti / tum * 100 : 0) + '% · ', h('a', { href: '#konu' }, 'konular')));

    kok.appendChild(h('div', { 'class': 'izgara' }, sayacKartlari));
    kok.appendChild(h('div', { 'class': 'izgara', style: 'margin-top:1rem' }, hafta, diger));

    // Son denemeler
    var son = h('div', { 'class': 'kart', style: 'margin-top:1rem' }, h('h3', {}, 'Son denemeler'));
    var satirlar = Object.keys(SINAVLAR).map(function (k) {
      var d = durum.deneme.filter(function (x) { return x.sinav === k; }).sort(function (a, b) { return a.tarih < b.tarih ? 1 : -1; })[0];
      if (!d) return null;
      var deger = L.denemeDeger(d);
      return h('tr', {}, h('td', {}, h('span', { 'class': 'rozet ' + SINAVLAR[k].sinif }, SINAVLAR[k].kisa)), h('td', {}, tarihTR(d.tarih)),
        h('td', { 'class': 'sayi' }, k === 'yds' ? deger + ' puan (' + L.ydsHarf(deger) + ')' : deger + ' net'),
        h('td', { 'class': 'sayi soluk' }, k === 'yds' ? 'hedef ' + durum.ayar.ydsHedef : (k === 'ales-sayisal' ? 'hedef ' + durum.ayar.alesHedefNet + ' net' : '')));
    }).filter(Boolean);
    if (satirlar.length) son.appendChild(h('div', { 'class': 'kaydir' }, h('table', {}, h('tbody', {}, satirlar))));
    else son.appendChild(h('div', { 'class': 'bos' }, 'Henüz deneme yok. İlk deneme baz çizgin olur: ', h('a', { href: '#deneme' }, 'ekle')));
    kok.appendChild(son);

    // Yedek hatırlatması
    var veriVar = durum.calisma.length + durum.deneme.length + durum.hata.length + durum.kelime.length > 0;
    var sy = durum.ayar.sonYedek;
    if (veriVar && (!sy || L.gunFarki(sy, bg) > 14)) {
      kok.appendChild(h('div', { 'class': 'kart', style: 'border-color:var(--uyari)' },
        h('p', {}, sy ? 'Son yedeğin ' + tarihTR(sy) + '.' : 'Henüz yedek almadın.', ' Tarayıcı verisi silinirse kayıtlar gider.'),
        h('a', { href: '#ayar', 'class': 'dugme' }, 'Yedek al')));
    }
    return kok;
  }

  /* ---------- Çalışma ---------- */
  function zamanBaslangic() { try { return +localStorage.getItem(ZAMAN_ANAHTAR) || 0; } catch (e) { return 0; } }
  function zamanYaz(v) { try { if (v) localStorage.setItem(ZAMAN_ANAHTAR, String(v)); else localStorage.removeItem(ZAMAN_ANAHTAR); } catch (e) { } }
  function ekranCalis() {
    var kok = h('div'); kok.appendChild(h('h2', {}, 'Çalışma günlüğü'));
    var onDk = null;

    var dkGirdi = h('input', { type: 'number', min: '1', max: '1440', step: '1', inputmode: 'numeric', required: true });
    var sinavSec = h('select', {}, secenekler(CALISMA_ALANLARI, 'yds'));
    var konuGirdi = h('input', { type: 'text', maxlength: '80', placeholder: 'ör. Passive, Yaş problemleri', list: 'konu-oneri' });
    var tarihGirdi = h('input', { type: 'date', value: bugun(), max: bugun(), required: true });
    var notGirdi = h('input', { type: 'text', maxlength: '200' });
    var hata = h('p', { 'class': 'hata-metni', role: 'alert' });
    var oneri = h('datalist', { id: 'konu-oneri' });
    KONULAR.forEach(function (g) { g.konular.forEach(function (k) { oneri.appendChild(h('option', { value: k })); }); });

    // Kronometre
    var zamanGoster = h('div', { 'class': 'zaman', 'aria-live': 'off' }, '00:00');
    var baslat = h('button', { 'class': 'ana', type: 'button' });
    var bitir = h('button', { type: 'button' }, 'Bitir ve forma aktar');
    function guncelleZaman() {
      var b = zamanBaslangic();
      var sn = b ? Math.floor((Date.now() - b) / 1000) : 0;
      zamanGoster.textContent = pad2(Math.floor(sn / 60)) + ':' + pad2(sn % 60);
      baslat.textContent = b ? 'Sıfırla' : 'Başlat';
      bitir.disabled = !b;
    }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    baslat.addEventListener('click', function () {
      if (zamanBaslangic()) zamanYaz(0); else zamanYaz(Date.now());
      guncelleZaman();
    });
    bitir.addEventListener('click', function () {
      var b = zamanBaslangic(); if (!b) return;
      var dk = Math.max(1, Math.round((Date.now() - b) / 60000));
      zamanYaz(0); guncelleZaman(); dkGirdi.value = dk; dkGirdi.focus();
    });
    guncelleZaman();
    zamanlayiciTik = setInterval(guncelleZaman, 1000);

    kok.appendChild(h('div', { 'class': 'kart' }, h('h3', {}, 'Kronometre'), zamanGoster,
      h('div', { 'class': 'satir', style: 'justify-content:center' }, baslat, bitir),
      h('p', { 'class': 'soluk', style: 'text-align:center;margin-top:.5rem' }, 'Sayfayı yenilesen de devam eder.')));

    var form = h('form', { 'class': 'kart', novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var dk = Math.round(sayi(dkGirdi.value));
      if (!(dk >= 1 && dk <= 1440)) { hata.textContent = 'Süreyi 1–1440 dakika arasında gir.'; dkGirdi.focus(); return; }
      if (!tarihGirdi.value) { hata.textContent = 'Tarih seç.'; return; }
      durum.calisma.push({ id: id(), tarih: tarihGirdi.value, sinav: sinavSec.value, konu: konuGirdi.value.trim(), dk: dk, not: notGirdi.value.trim() });
      kaydet(); yenile();
    } },
      h('h3', {}, 'Çalışma ekle'),
      h('div', { 'class': 'form' }, alan('Tarih', tarihGirdi), alan('Alan', sinavSec), alan('Süre (dk)', dkGirdi), alan('Konu', konuGirdi), alan('Not', notGirdi),
        h('div', {}, h('button', { 'class': 'ana', type: 'submit' }, 'Kaydet'))), oneri, hata);
    kok.appendChild(form);

    var liste = durum.calisma.slice().sort(function (a, b) { return a.tarih < b.tarih ? 1 : (a.tarih > b.tarih ? -1 : 0); }).slice(0, 40);
    var kart = h('div', { 'class': 'kart' }, h('h3', {}, 'Son kayıtlar'));
    if (!liste.length) kart.appendChild(h('div', { 'class': 'bos' }, 'Henüz kayıt yok.'));
    else kart.appendChild(h('div', { 'class': 'kaydir' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Tarih'), h('th', {}, 'Alan'), h('th', {}, 'Konu'), h('th', { 'class': 'sayi' }, 'Süre'), h('th', {}, ''))),
      h('tbody', {}, liste.map(function (c) {
        return h('tr', {}, h('td', {}, tarihTR(c.tarih)), h('td', {}, h('span', { 'class': 'rozet ' + c.sinav }, CALISMA_ALANLARI[c.sinav] || c.sinav)),
          h('td', {}, c.konu || '', c.not ? h('div', { 'class': 'soluk' }, c.not) : null), h('td', { 'class': 'sayi' }, saatDk(c.dk)),
          h('td', {}, h('button', { 'class': 'kucuk tehlike', type: 'button', 'aria-label': 'Kaydı sil', onclick: function () {
            if (!onayla('Bu çalışma kaydı silinsin mi?')) return;
            sil('calisma', c.id); kaydet(); yenile();
          } }, 'Sil')));
      })))));
    kok.appendChild(kart);
    return kok;
  }

  /* ---------- Deneme ---------- */
  var ALES_TUR = { 'ales-sayisal': 'sayisal', 'ales-sozel': 'sozel' };
  /* ALES neti -> tahmini puan aralığı. Yalnızca Emre'nin girdiği GERÇEK sonuçlardan hesaplanır. */
  function tahminAraligi(sinavKey, net) {
    var tur = ALES_TUR[sinavKey]; if (!tur) return null;
    var t = L.alesTahmin(durum.alesSonuc, tur, net);
    return t ? { metin: '≈ ' + t.alt + '–' + t.ust + ' puan', t: t } : null;
  }
  function kartAlesSonuc() {
    var tur = h('select', {}, secenekler({ sayisal: 'ALES Sayısal', sozel: 'ALES Sözel' }, 'sayisal'));
    var tarih = h('input', { type: 'date', value: bugun(), max: bugun(), required: true });
    var net = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'ör. 36,5', required: true });
    var puan = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'ör. 71,2', required: true });
    var hata = h('p', { 'class': 'hata-metni', role: 'alert' });
    var kart = h('div', { 'class': 'kart' }, h('h3', {}, 'Gerçek ALES sonuçların'),
      h('p', { 'class': 'soluk' }, 'ÖSYM katsayı yayımlamıyor; puan her oturumun ortalamasına bağlı. Bu yüzden net → puan tahmini yalnız senin gerçek sonuçlarından kurulur: ne kadar çok girersen aralık o kadar daralır. Net = o bölümün (sayısal ya da sözel) neti.'),
      h('form', { novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var n = sayi(net.value), p = sayi(puan.value);
        if (!(n >= 0 && n <= 50)) { hata.textContent = 'Net 0–50 arasında olmalı.'; return; }
        if (!(p > 0 && p <= 100)) { hata.textContent = 'Puan 0–100 arasında olmalı.'; return; }
        if (!tarih.value) { hata.textContent = 'Tarih seç.'; return; }
        durum.alesSonuc.push({ id: id(), tur: tur.value, tarih: tarih.value, net: n, puan: p, guncel: Date.now() });
        kaydet(); yenile();
      } }, h('div', { 'class': 'form' }, alan('Bölüm', tur), alan('Tarih', tarih), alan('Net', net), alan('Puan', puan),
        h('div', {}, h('button', { type: 'submit' }, 'Sonuç ekle'))), hata));
    durum.alesSonuc.slice().sort(function (a, b) { return a.tarih < b.tarih ? 1 : -1; }).forEach(function (s) {
      kart.appendChild(h('div', { 'class': 'konu' }, h('span', { 'class': 'ad' }, tarihTR(s.tarih) + ' · ' + (s.tur === 'sayisal' ? 'Sayısal' : 'Sözel') + ' · ' + s.net + ' net → ' + s.puan + ' puan'),
        h('button', { 'class': 'kucuk tehlike', type: 'button', 'aria-label': 'Sonucu sil', onclick: function () {
          if (!onayla('Bu ALES sonucu silinsin mi?')) return;
          sil('alesSonuc', s.id); kaydet(); yenile();
        } }, 'Sil')));
    });
    var hp = durum.ayar.alesHedefPuan, gn = L.alesHedefNet(durum.alesSonuc, 'sayisal', hp);
    if (gn != null) kart.appendChild(h('p', {}, h('strong', {}, hp + ' puan'), ' için ALES Sayısal’da yaklaşık ', h('strong', {}, String(gn) + ' net'), ' gerekir (tahmin).'));
    return kart;
  }
  var denemeGrafikSinav = 'yds';
  function ekranDeneme() {
    var kok = h('div'); kok.appendChild(h('h2', {}, 'Denemeler'));
    var tarih = h('input', { type: 'date', value: bugun(), max: bugun(), required: true });
    var sinav = h('select', {}, secenekler(SINAVLAR, 'yds'));
    var soru = h('input', { type: 'number', min: '1', max: '200', value: '80', inputmode: 'numeric' });
    var dogru = h('input', { type: 'number', min: '0', max: '200', inputmode: 'numeric' });
    var yanlis = h('input', { type: 'number', min: '0', max: '200', inputmode: 'numeric', value: '0' });
    var yanlisKutu = alan('Yanlış', yanlis); yanlisKutu.hidden = true;
    var notG = h('input', { type: 'text', maxlength: '200', placeholder: 'ör. süre yetmedi, tam deneme' });
    var hata = h('p', { 'class': 'hata-metni', role: 'alert' });
    sinav.addEventListener('change', function () {
      soru.value = SINAVLAR[sinav.value].soru;
      yanlisKutu.hidden = !SINAVLAR[sinav.value].ales;
    });
    var form = h('form', { 'class': 'kart', novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var d = { sinav: sinav.value, soru: Math.round(sayi(soru.value)), dogru: Math.round(sayi(dogru.value)), yanlis: SINAVLAR[sinav.value].ales ? Math.round(sayi(yanlis.value) || 0) : 0 };
      var hatalar = L.dogrula(d);
      if (!tarih.value) hatalar.unshift('Tarih seç.');
      if (hatalar.length) { hata.textContent = hatalar.join(' '); return; }
      d.id = id(); d.tarih = tarih.value; d.not = notG.value.trim();
      durum.deneme.push(d); kaydet(); denemeGrafikSinav = d.sinav; yenile();
    } },
      h('h3', {}, 'Deneme ekle'),
      h('div', { 'class': 'form' }, alan('Tarih', tarih), alan('Sınav', sinav), alan('Soru sayısı', soru), alan('Doğru', dogru), yanlisKutu, alan('Not', notG),
        h('div', {}, h('button', { 'class': 'ana', type: 'submit' }, 'Kaydet'))), hata,
      h('p', { 'class': 'soluk' }, 'YDS: puan = doğru × 1,25 (80 soruda), yanlış doğruyu götürmez. ALES: 4 yanlış 1 doğruyu götürür, net = doğru − yanlış/4. Bölüm denemesinde soru sayısını değiştir.'));
    kok.appendChild(form);
    kok.appendChild(kartAlesSonuc());

    // Grafik
    var secici = h('div', { 'class': 'sekme-sec', role: 'group', 'aria-label': 'Grafik sınavı' }, Object.keys(SINAVLAR).map(function (k) {
      return h('button', { type: 'button', 'aria-pressed': k === denemeGrafikSinav ? 'true' : 'false', onclick: function () { denemeGrafikSinav = k; yenile(); } }, SINAVLAR[k].kisa);
    }));
    var seri = durum.deneme.filter(function (d) { return d.sinav === denemeGrafikSinav; }).sort(function (a, b) { return a.tarih < b.tarih ? -1 : (a.tarih > b.tarih ? 1 : 0); });
    var g = h('div', { 'class': 'kart' }, h('div', { 'class': 'satir' }, h('h3', { style: 'margin:0' }, 'Gidişat'), h('span', { 'class': 'bosluk' }), secici));
    if (!seri.length) g.appendChild(h('div', { 'class': 'bos', style: 'margin-top:.75rem' }, 'Bu sınav için deneme yok.'));
    else {
      var yds = denemeGrafikSinav === 'yds';
      var hedef = yds ? durum.ayar.ydsHedef : (denemeGrafikSinav === 'ales-sayisal' ? durum.ayar.alesHedefNet : null);
      g.appendChild(cizgiGrafik(seri.map(function (d) { return { tarih: d.tarih, y: L.denemeDeger(d) }; }), hedef, yds ? 'puan' : 'net',
        SINAVLAR[denemeGrafikSinav].ad + ' deneme ' + (yds ? 'puanları' : 'netleri') + ', ' + seri.length + ' deneme'));
    }
    kok.appendChild(g);

    var liste = durum.deneme.slice().sort(function (a, b) { return a.tarih < b.tarih ? 1 : (a.tarih > b.tarih ? -1 : 0); });
    var kart = h('div', { 'class': 'kart' }, h('h3', {}, 'Tüm denemeler'));
    if (!liste.length) kart.appendChild(h('div', { 'class': 'bos' }, 'Henüz deneme yok.'));
    else kart.appendChild(h('div', { 'class': 'kaydir' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Tarih'), h('th', {}, 'Sınav'), h('th', { 'class': 'sayi' }, 'D/Y/Soru'), h('th', { 'class': 'sayi' }, 'Sonuç'), h('th', {}, ''))),
      h('tbody', {}, liste.map(function (d) {
        var yd = d.sinav === 'yds', v = L.denemeDeger(d);
        return h('tr', {}, h('td', {}, tarihTR(d.tarih)), h('td', {}, h('span', { 'class': 'rozet ' + SINAVLAR[d.sinav].sinif }, SINAVLAR[d.sinav].kisa), d.not ? h('div', { 'class': 'soluk' }, d.not) : null),
          h('td', { 'class': 'sayi' }, d.dogru + (yd ? '' : '/' + d.yanlis) + '/' + d.soru),
          h('td', { 'class': 'sayi' }, yd ? v + ' (' + L.ydsHarf(v) + ')' : v + ' net', (function () { var t = yd ? null : tahminAraligi(d.sinav, v); return t ? h('div', { 'class': 'tahmin' }, t.metin) : null; })()),
          h('td', {}, h('button', { 'class': 'kucuk tehlike', type: 'button', 'aria-label': 'Denemeyi sil', onclick: function () {
            if (!onayla('Bu deneme silinsin mi?')) return;
            sil('deneme', d.id); kaydet(); yenile();
          } }, 'Sil')));
      })))));
    kok.appendChild(kart);
    return kok;
  }

  /* ---------- Hata defteri ---------- */
  var hataFiltre = { sinav: 'hepsi', sadeceAcik: true };
  function ekranHata() {
    var kok = h('div'); kok.appendChild(h('h2', {}, 'Hata defteri'));
    kok.appendChild(h('p', { 'class': 'soluk' }, 'Yanlış ya da tahminle doğru çıkan her soru için: neden yanlış, neyi kaçırdım. Çözdüğünü işaretle.'));
    var tarih = h('input', { type: 'date', value: bugun(), max: bugun(), required: true });
    var sinav = h('select', {}, secenekler({ 'ales': 'ALES', 'yds': 'YDS / İngilizce' }, 'yds'));
    var konu = h('input', { type: 'text', maxlength: '80', list: 'hata-konu', required: true, placeholder: 'ör. Relative clauses' });
    var oneri = h('datalist', { id: 'hata-konu' }); KONULAR.forEach(function (g) { g.konular.forEach(function (k) { oneri.appendChild(h('option', { value: k })); }); });
    var neden = h('select', {}, NEDENLER.map(function (n) { return h('option', { value: n }, n); }));
    var notG = h('textarea', { maxlength: '600', placeholder: 'Neyi kaçırdım? Doğru mantık ne?' });
    var hata = h('p', { 'class': 'hata-metni', role: 'alert' });
    kok.appendChild(h('form', { 'class': 'kart', novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      if (!konu.value.trim()) { hata.textContent = 'Konu yaz.'; konu.focus(); return; }
      if (!tarih.value) { hata.textContent = 'Tarih seç.'; return; }
      durum.hata.push({ id: id(), tarih: tarih.value, sinav: sinav.value, konu: konu.value.trim(), neden: neden.value, not: notG.value.trim(), cozuldu: false });
      kaydet(); yenile();
    } }, h('h3', {}, 'Hata ekle'),
      h('div', { 'class': 'form' }, alan('Tarih', tarih), alan('Alan', sinav), alan('Konu', konu), alan('Neden', neden),
        h('div', { 'class': 'genis' }, alan('Not', notG)), h('div', {}, h('button', { 'class': 'ana', type: 'submit' }, 'Kaydet'))), oneri, hata));

    var fSinav = h('select', { 'aria-label': 'Alan süzgeci', onchange: function () { hataFiltre.sinav = fSinav.value; yenile(); } },
      h('option', { value: 'hepsi', selected: hataFiltre.sinav === 'hepsi' }, 'Hepsi'),
      h('option', { value: 'ales', selected: hataFiltre.sinav === 'ales' }, 'ALES'),
      h('option', { value: 'yds', selected: hataFiltre.sinav === 'yds' }, 'YDS'));
    var fAcik = h('input', { type: 'checkbox', id: 'f-acik', checked: hataFiltre.sadeceAcik, onchange: function () { hataFiltre.sadeceAcik = fAcik.checked; yenile(); } });
    var liste = durum.hata.filter(function (x) {
      return (hataFiltre.sinav === 'hepsi' || x.sinav === hataFiltre.sinav) && (!hataFiltre.sadeceAcik || !x.cozuldu);
    }).sort(function (a, b) { return a.tarih < b.tarih ? 1 : (a.tarih > b.tarih ? -1 : 0); });
    var acikSayi = durum.hata.filter(function (x) { return !x.cozuldu; }).length;

    var kart = h('div', { 'class': 'kart' }, h('div', { 'class': 'satir' }, h('h3', { style: 'margin:0' }, 'Kayıtlar (' + acikSayi + ' açık)'), h('span', { 'class': 'bosluk' }),
      fSinav, h('label', { 'for': 'f-acik', style: 'display:flex;gap:.4rem;align-items:center;margin:0' }, fAcik, 'Yalnız çözülmemiş')));
    if (!liste.length) kart.appendChild(h('div', { 'class': 'bos', style: 'margin-top:.75rem' }, durum.hata.length ? 'Süzgece uyan kayıt yok.' : 'Henüz kayıt yok.'));
    else liste.forEach(function (x) {
      kart.appendChild(h('div', { 'class': 'konu', style: 'align-items:flex-start' },
        h('div', { 'class': 'ad' }, h('strong', {}, x.konu), ' ', h('span', { 'class': 'rozet ' + x.sinav }, x.sinav === 'ales' ? 'ALES' : 'YDS'), ' ', h('span', { 'class': 'rozet' }, x.neden),
          h('div', { 'class': 'soluk' }, tarihTR(x.tarih)), x.not ? h('div', {}, x.not) : null),
        h('div', { 'class': 'satir' },
          h('button', { 'class': 'kucuk' + (x.cozuldu ? ' d2' : ''), type: 'button', 'aria-pressed': x.cozuldu ? 'true' : 'false', onclick: function () { x.cozuldu = !x.cozuldu; x.cozulduTarih = x.cozuldu ? bugun() : null; x.guncel = Date.now(); kaydet(); yenile(); } }, x.cozuldu ? 'Çözüldü' : 'Çözüldü yap'),
          h('button', { 'class': 'kucuk tehlike', type: 'button', 'aria-label': 'Kaydı sil', onclick: function () {
            if (!onayla('Bu hata kaydı silinsin mi?')) return;
            sil('hata', x.id); kaydet(); yenile();
          } }, 'Sil'))));
    });
    kok.appendChild(kart);

    // Neden dağılımı
    if (durum.hata.length >= 3) {
      var say = {}; durum.hata.forEach(function (x) { say[x.neden] = (say[x.neden] || 0) + 1; });
      var ks = Object.keys(say).sort(function (a, b) { return say[b] - say[a]; });
      kok.appendChild(h('div', { 'class': 'kart' }, h('h3', {}, 'Hangi nedenle yanlış yapıyorum?'),
        ks.map(function (k) { return h('div', { style: 'margin-bottom:.5rem' }, h('div', { 'class': 'satir' }, k, h('span', { 'class': 'bosluk' }), h('span', { 'class': 'soluk' }, String(say[k]))), h('div', { 'class': 'cubuk' }, h('i', { style: 'width:' + say[k] / durum.hata.length * 100 + '%' }))); })));
    }
    return kok;
  }

  /* ---------- Kelime ---------- */
  var kartOturum = { kuyruk: null, acik: false };
  function ekranKelime() {
    var kok = h('div'); kok.appendChild(h('h2', {}, 'Kelime kartları'));
    var bg = bugun();
    if (!kartOturum.kuyruk) kartOturum.kuyruk = L.bugunTekrar(durum.kelime, bg).map(function (k) { return k.id; });
    var kuyruk = kartOturum.kuyruk.filter(function (kid) { return durum.kelime.some(function (k) { return k.id === kid; }); });
    kartOturum.kuyruk = kuyruk;

    var ust = h('div', { 'class': 'kart' });
    if (!durum.kelime.length) ust.appendChild(h('div', { 'class': 'bos' }, 'Henüz kelime yok. Aşağıdan ekle.'));
    else if (!kuyruk.length) ust.appendChild(h('div', { 'class': 'bos' }, 'Bugünlük tekrar bitti. Yeni kelime ekleyebilir ya da yarın dönebilirsin.'));
    else {
      var kart = durum.kelime.filter(function (k) { return k.id === kuyruk[0]; })[0];
      var cevap = function (bildi) {
        var i = durum.kelime.findIndex(function (k) { return k.id === kart.id; });
        durum.kelime[i] = L.kartCevapla(kart, bildi, bg);
        kartOturum.kuyruk.shift(); kartOturum.acik = false; kaydet(); yenile();
      };
      ust.appendChild(h('div', { 'class': 'etiket' }, kuyruk.length + ' kart kaldı'));
      ust.appendChild(h('div', { 'class': 'kelime-kart' }, h('div', { 'class': 'en' }, kart.en),
        h('div', { 'class': 'tr', 'aria-live': 'polite' }, kartOturum.acik ? kart.tr : ''), kartOturum.acik && kart.ornek ? h('div', { 'class': 'ornek' }, kart.ornek) : null));
      ust.appendChild(kartOturum.acik
        ? h('div', { 'class': 'satir', style: 'justify-content:center' }, h('button', { type: 'button', onclick: function () { cevap(false); } }, 'Bilemedim'), h('button', { 'class': 'ana', type: 'button', onclick: function () { cevap(true); } }, 'Bildim'))
        : h('div', { 'class': 'satir', style: 'justify-content:center' }, h('button', { 'class': 'ana', type: 'button', onclick: function () { kartOturum.acik = true; yenile(); } }, 'Cevabı göster')));
    }
    kok.appendChild(ust);

    // Ekle
    var en = h('input', { type: 'text', maxlength: '80', required: true });
    var tr = h('input', { type: 'text', maxlength: '120', required: true });
    var ornek = h('input', { type: 'text', maxlength: '200', placeholder: 'isteğe bağlı örnek cümle' });
    var hata = h('p', { 'class': 'hata-metni', role: 'alert' });
    kok.appendChild(h('form', { 'class': 'kart', novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      if (!en.value.trim() || !tr.value.trim()) { hata.textContent = 'İngilizce ve Türkçe karşılık gerekli.'; return; }
      durum.kelime.push({ id: id(), en: en.value.trim(), tr: tr.value.trim(), ornek: ornek.value.trim(), kutu: 0, sonraki: bugun() });
      kartOturum.kuyruk = null; kaydet(); yenile();
    } }, h('h3', {}, 'Kelime ekle'),
      h('div', { 'class': 'form' }, alan('İngilizce', en), alan('Türkçe', tr), alan('Örnek', ornek), h('div', {}, h('button', { 'class': 'ana', type: 'submit' }, 'Ekle'))), hata,
      h('p', { 'class': 'soluk' }, 'Kartı eş anlamlısıyla ya da cümle içinde yaz: ', h('em', {}, 'enhance = improve'), '. Bilmediğin kelime yarın, bildiğin 1-3-7-16-35 günde bir döner.')));

    var toplu = h('textarea', { rows: '5', placeholder: 'her satıra bir kelime:\nenhance - geliştirmek\nboost = artırmak\nrely on; güvenmek' });
    var topluSonuc = h('p', { 'class': 'soluk', role: 'status' });
    kok.appendChild(h('details', { 'class': 'kart' }, h('summary', {}, 'Toplu ekle'),
      toplu, h('div', { 'class': 'satir', style: 'margin-top:.5rem' }, h('button', { 'class': 'ana', type: 'button', onclick: function () {
        var r = L.kelimeAyikla(toplu.value);
        r.kelimeler.forEach(function (k) { durum.kelime.push({ id: id(), en: k.en, tr: k.tr, ornek: '', kutu: 0, sonraki: bugun() }); });
        if (r.kelimeler.length) { kartOturum.kuyruk = null; kaydet(); yenile(); }
        else topluSonuc.textContent = 'Geçerli satır yok. Biçim: "kelime - karşılık".';
      } }, 'Ekle'), topluSonuc)));

    // Liste
    if (durum.kelime.length) {
      var say = [0, 0, 0, 0, 0, 0]; durum.kelime.forEach(function (k) { say[k.kutu]++; });
      var liste = durum.kelime.slice().sort(function (a, b) { return a.en.toLowerCase() < b.en.toLowerCase() ? -1 : 1; });
      kok.appendChild(h('details', { 'class': 'kart' }, h('summary', {}, 'Tüm kelimeler (' + durum.kelime.length + ')'),
        h('p', { 'class': 'soluk' }, 'Kutulara göre: ' + say.map(function (n, i) { return (i + 1) + '. kutu ' + n; }).join(' · ')),
        h('div', { 'class': 'kaydir' }, h('table', {}, h('tbody', {}, liste.map(function (k) {
          return h('tr', {}, h('td', {}, k.en), h('td', {}, k.tr), h('td', { 'class': 'soluk' }, 'K' + (k.kutu + 1)),
            h('td', {}, h('button', { 'class': 'kucuk tehlike', type: 'button', 'aria-label': k.en + ' kelimesini sil', onclick: function () {
              sil('kelime', k.id); kartOturum.kuyruk = null; kaydet(); yenile();
            } }, 'Sil')));
        }))))));
    }
    return kok;
  }

  /* ---------- Konular ---------- */
  var DURUM_AD = ['Başlamadım', 'Çalıştım', 'Pekişti'];
  function ekranKonu() {
    var kok = h('div'); kok.appendChild(h('h2', {}, 'Konu listesi'));
    kok.appendChild(h('p', { 'class': 'soluk' }, 'Düğmeye dokun: Başlamadım → Çalıştım → Pekişti. “Pekişti” = soruları hatasız çözebiliyorum.'));
    KONULAR.forEach(function (g) {
      var top = g.konular.reduce(function (a, k) { return a + (durum.konu[k] || 0); }, 0);
      var yuzde = top / (g.konular.length * 2) * 100;
      var kart = h('div', { 'class': 'kart konu-grup' }, h('div', { 'class': 'satir' }, h('h3', { style: 'margin:0' }, g.grup), h('span', { 'class': 'bosluk' }), h('span', { 'class': 'soluk' }, Math.round(yuzde) + '%')),
        h('div', { 'class': 'cubuk', style: 'margin:.5rem 0' }, h('i', { style: 'width:' + yuzde + '%' })));
      g.konular.forEach(function (k) {
        var d = durum.konu[k] || 0;
        kart.appendChild(h('div', { 'class': 'konu' }, h('span', { 'class': 'ad' }, k),
          h('button', { type: 'button', 'class': d ? 'd' + d : '', onclick: function () { durum.konu[k] = (d + 1) % 3; kaydet(); yenile(); }, 'aria-label': k + ': ' + DURUM_AD[d] + ', değiştirmek için bas' }, DURUM_AD[d])));
      });
      kok.appendChild(kart);
    });
    return kok;
  }

  /* ---------- Senkron kartı ---------- */
  function syncKart() {
    var S = window.Sync, kart = h('div', { 'class': 'kart', id: 'sync-kart' });
    kart.appendChild(h('h3', {}, 'Cihazlar arası senkron'));
    if (!S || !S.kullanilabilir) {
      kart.appendChild(h('p', { 'class': 'soluk' }, 'Kapalı: bu kurulumda Firebase ayarı yok. Telefon ve bilgisayarı Google ile eşlemek için README’deki “Google senkronu” adımlarını yap; o zamana kadar Yedek bölümünü kullan.'));
      return kart;
    }
    var d = S.durum();
    var metin = { 'giris-yok': 'Giriş yapılmadı. Veri yalnız bu cihazda.', esitleniyor: 'Eşitleniyor…', tamam: 'Eşitlendi' + (d.zaman ? ' · ' + d.zaman.toTimeString().slice(0, 5) : ''), hata: d.ileti }[d.kod] || '';
    kart.appendChild(h('p', { role: 'status', 'class': d.kod === 'hata' ? 'hata-metni' : 'soluk' }, metin));
    if (d.eposta) kart.appendChild(h('p', { 'class': 'soluk' }, 'Hesap: ' + d.eposta));
    kart.appendChild(h('div', { 'class': 'satir' },
      d.eposta
        ? [h('button', { type: 'button', onclick: function () { S.simdi(); } }, 'Şimdi eşitle'), h('button', { type: 'button', onclick: function () { S.cikis(); } }, 'Çıkış yap')]
        : h('button', { 'class': 'ana', type: 'button', onclick: function () { S.giris(); } }, 'Google ile giriş yap')));
    kart.appendChild(h('p', { 'class': 'soluk' }, 'Giriş yalnız eşitleme içindir; başka hesap ya da şifre yok. İki cihazda da aynı Google hesabıyla gir, veriler birleşir.'));
    return kart;
  }

  /* ---------- Ayarlar ---------- */
  function ekranAyar() {
    var kok = h('div'); kok.appendChild(h('h2', {}, 'Ayarlar'));
    var a = durum.ayar;
    var yds = h('input', { type: 'number', min: '1', max: '100', step: '1', value: a.ydsHedef });
    var ales = h('input', { type: 'number', min: '1', max: '50', step: '1', value: a.alesHedefNet });
    var alesP = h('input', { type: 'number', min: '1', max: '100', step: '1', value: a.alesHedefPuan });
    var saat = h('input', { type: 'number', min: '1', max: '80', step: '0.5', value: a.haftalikSaat });
    var temaSec = h('select', {}, secenekler({ oto: 'Cihaza göre', acik: 'Açık', koyu: 'Koyu' }, a.tema));
    var hata = h('p', { 'class': 'hata-metni', role: 'alert' });
    kok.appendChild(h('form', { 'class': 'kart', novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var y = sayi(yds.value), n = sayi(ales.value), s = sayi(saat.value), ap = sayi(alesP.value);
      if (!(y >= 1 && y <= 100) || !(n >= 1 && n <= 50) || !(s >= 1 && s <= 80) || !(ap >= 1 && ap <= 100)) { hata.textContent = 'Değerler aralık dışı: YDS 1–100, ALES net 1–50, ALES puan 1–100, saat 1–80.'; return; }
      a.ydsHedef = y; a.alesHedefNet = n; a.alesHedefPuan = ap; a.haftalikSaat = s; a.tema = temaSec.value;
      kaydet(); yenile();
    } }, h('h3', {}, 'Hedefler'),
      h('div', { 'class': 'form' }, alan('YDS hedef puan', yds), alan('ALES Sayısal hedef net', ales), alan('ALES hedef puan', alesP), alan('Haftalık çalışma (saat)', saat), alan('Tema', temaSec),
        h('div', {}, h('button', { 'class': 'ana', type: 'submit' }, 'Kaydet'))), hata,
      h('p', { 'class': 'soluk' }, 'ALES çalışması net üzerinden izlenir. Hedef puan, gerçek ALES sonuçlarını girince “şu puan için şu net” tahminine çevrilir (Deneme sekmesi).')));

    // Tarihler
    var tk = h('div', { 'class': 'kart' }, h('h3', {}, 'Sınav tarihleri'),
      h('p', { 'class': 'soluk' }, 'Varsayılanlar ikincil kaynaklardan alındı ve taslaktır. osym.gov.tr’den doğrulayınca kutuyu işaretle; ÖSYM tarih değiştirebilir.'));
    a.tarihler.slice().sort(function (x, y) { return x.tarih < y.tarih ? -1 : 1; }).forEach(function (t) {
      tk.appendChild(h('div', { 'class': 'konu' }, h('span', { 'class': 'ad' }, h('strong', {}, t.ad), ' ', tarihTR(t.tarih),
          t.basvuru ? h('div', { 'class': 'soluk' }, 'Başvuru ' + tarihTR(t.basvuru[0]) + ' – ' + tarihTR(t.basvuru[1]) + (t.sonuc ? ' · sonuç ' + tarihTR(t.sonuc) : '')) : null),
        h('label', { style: 'display:flex;gap:.4rem;align-items:center;margin:0', title: 'ÖSYM’den doğruladım' }, h('input', { type: 'checkbox', checked: !!t.dogrulandi, onchange: function (e) { t.dogrulandi = e.target.checked; kaydet(); } }), 'doğrulandı'),
        h('button', { 'class': 'kucuk tehlike', type: 'button', 'aria-label': t.ad + ' tarihini sil', onclick: function () { a.tarihler = a.tarihler.filter(function (x) { return x.id !== t.id; }); kaydet(); yenile(); } }, 'Sil')));
    });
    var tAd = h('input', { type: 'text', maxlength: '30', placeholder: 'ör. e-YDS' });
    var tTar = h('input', { type: 'date' });
    var tHata = h('p', { 'class': 'hata-metni', role: 'alert' });
    tk.appendChild(h('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      if (!tAd.value.trim() || !tTar.value) { tHata.textContent = 'Ad ve tarih gerekli.'; return; }
      a.tarihler.push({ id: id(), ad: tAd.value.trim(), tarih: tTar.value, dogrulandi: false }); kaydet(); yenile();
    } }, h('div', { 'class': 'form', style: 'margin-top:.75rem' }, alan('Ad', tAd), alan('Tarih', tTar), h('div', {}, h('button', { type: 'submit' }, 'Tarih ekle'))), tHata));
    kok.appendChild(tk);

    kok.appendChild(syncKart());

    // Yedek
    var yukleDosya = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    var yHata = h('p', { 'class': 'hata-metni', role: 'alert' });
    yukleDosya.addEventListener('change', function () {
      var f = yukleDosya.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var o = null; try { o = L.durumDogrula(JSON.parse(r.result)); } catch (e) { }
        if (!o) { yHata.textContent = 'Dosya geçerli bir yedek değil; hiçbir şey değişmedi.'; return; }
        if (!onayla('Mevcut tüm veri bu yedekle değiştirilsin mi?')) return;
        durum = tamamla(o); kartOturum.kuyruk = null; kaydet(); ciz();
      };
      r.readAsText(f);
    });
    kok.appendChild(h('div', { 'class': 'kart' }, h('h3', {}, 'Yedek'),
      h('p', { 'class': 'soluk' }, 'Veri yalnızca bu tarayıcıda. Tarayıcı verisini silersen ya da başka cihaza geçersen yedek dosyasını yükle.' + (a.sonYedek ? ' Son yedek: ' + tarihTR(a.sonYedek) + '.' : '')),
      h('div', { 'class': 'satir' },
        h('button', { 'class': 'ana', type: 'button', onclick: function () {
          var blob = new Blob([JSON.stringify(durum, null, 2)], { type: 'application/json' });
          var u = URL.createObjectURL(blob);
          var el = h('a', { href: u, download: 'ales-yds-takip-yedek-' + bugun() + '.json' });
          document.body.appendChild(el); el.click(); el.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
          durum.ayar.sonYedek = bugun(); kaydet(); yenile();
        } }, 'Yedeği indir'),
        h('button', { type: 'button', onclick: function () { yukleDosya.click(); } }, 'Yedekten yükle'), yukleDosya), yHata));

    kok.appendChild(h('div', { 'class': 'kart' }, h('h3', {}, 'Sıfırla'),
      h('p', { 'class': 'soluk' }, 'Tüm çalışma, deneme, hata, kelime ve konu kayıtlarını siler. Geri alınamaz; önce yedek al.'),
      h('button', { 'class': 'tehlike', type: 'button', onclick: function () {
        if (!onayla('Tüm veri silinsin mi? Bu işlem geri alınamaz.')) return;
        // Sıfırlama bulutta da geçerli olsun: tüm kayıtlar silinmiş sayılır (yoksa senkron hepsini geri getirir).
        var eski = durum, v = varsayilan(), simdi = Date.now();
        ['calisma', 'deneme', 'hata', 'kelime', 'alesSonuc'].forEach(function (dz) { eski[dz].forEach(function (x) { v.silinen[x.id] = simdi; }); });
        Object.keys(eski.silinen).forEach(function (k) { v.silinen[k] = eski.silinen[k]; });
        durum = v; kartOturum.kuyruk = null; kaydet(); location.hash = '#bugun'; ciz();
      } }, 'Tüm veriyi sil')));
    return kok;
  }

  var EKRANLAR = { bugun: ekranBugun, calis: ekranCalis, deneme: ekranDeneme, hata: ekranHata, kelime: ekranKelime, konu: ekranKonu, ayar: ekranAyar };
  window.addEventListener('hashchange', function () { ciz(); window.scrollTo(0, 0); document.getElementById('ana').focus({ preventScroll: true }); });
  window.__takip = { durum: function () { return durum; } }; // salt okunur kanca: ui-smoke testi
  ciz();
  if (window.Sync) window.Sync.baslat({
    al: function () { return durum; },
    tamamla: tamamla,
    // Buluttan birleşik durum geldi: yerel kaydı güncelle. Kullanıcı bir forma yazıyorsa ekranı yenileme.
    ata: function (d) {
      durum = tamamla(d); kartOturum.kuyruk = null; kaydet(true);
      var a = document.activeElement;
      if (!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) yenile();
    },
    // Yalnız Ayarlar'daki durum kartını yerinde tazele (formlardaki yazıyı bozma).
    durumDegisti: function () {
      var k = document.getElementById('sync-kart');
      if (k) k.replaceWith(syncKart());
    }
  });
})();
