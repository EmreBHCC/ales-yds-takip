/* Google ile cihazlar arası senkron (Firebase Auth + Firestore). Yapılandırma yoksa hiçbir şey yapmaz.
   Veri tek bir belgede: kullanicilar/{uid} = { veri: "<durum JSON>", guncel: <ms> }.
   Birleştirme Logic.durumBirlestir ile; iki cihaz da aynı sonuca varır, kayıt kaybolmaz. */
(function () {
  'use strict';
  var L = window.Logic;
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var cfg = window.FIREBASE_CONFIG;
  var api = null, auth = null, db = null, belge = null, iptal = null;
  var durum = { kod: cfg ? 'giris-yok' : 'kapali', ileti: '', zaman: null, eposta: null };
  var bekle = null, yukleniyor = null, itiyor = false;

  function bildir() { if (api && api.durumDegisti) api.durumDegisti(); }
  function ayarla(kod, ileti) { durum.kod = kod; durum.ileti = ileti || ''; bildir(); }

  /* Anahtar sırası ve dizi sırasından bağımsız karşılaştırma için kanonik metin. */
  function kanon(o) {
    var diziler = ['calisma', 'deneme', 'hata', 'kelime', 'alesSonuc'];
    function sirala(x, anahtar) {
      if (Array.isArray(x)) {
        var kopya = x.map(function (y) { return sirala(y); });
        if (anahtar && diziler.indexOf(anahtar) >= 0) kopya.sort(function (p, q) { return String(p.id) < String(q.id) ? -1 : 1; });
        return kopya;
      }
      if (x && typeof x === 'object') {
        var s = {}; Object.keys(x).sort().forEach(function (k) { s[k] = sirala(x[k], k); }); return s;
      }
      return x;
    }
    return JSON.stringify(sirala(o));
  }

  function betik(url) {
    return new Promise(function (coz, red) {
      var s = document.createElement('script'); s.src = url; s.onload = coz; s.onerror = function () { red(new Error('Firebase yüklenemedi (çevrimdışı olabilir)')); };
      document.head.appendChild(s);
    });
  }
  function yukle() {
    if (yukleniyor) return yukleniyor;
    yukleniyor = betik(SDK + 'firebase-app-compat.js')
      .then(function () { return Promise.all([betik(SDK + 'firebase-auth-compat.js'), betik(SDK + 'firebase-firestore-compat.js')]); })
      .then(function () {
        window.firebase.initializeApp(cfg);
        auth = window.firebase.auth(); db = window.firebase.firestore();
        auth.onAuthStateChanged(oturum);
      });
    return yukleniyor;
  }

  function oturum(kullanici) {
    if (iptal) { iptal(); iptal = null; }
    belge = null;
    if (!kullanici) { durum.eposta = null; ayarla('giris-yok'); return; }
    durum.eposta = kullanici.email || null;
    belge = db.collection('kullanicilar').doc(kullanici.uid);
    ayarla('esitleniyor');
    iptal = belge.onSnapshot(function (snap) { uzaktanGeldi(snap); }, function (e) { ayarla('hata', hataMetni(e)); });
  }

  function hataMetni(e) {
    var k = e && e.code || '';
    if (k === 'permission-denied') return 'Firestore kuralları bu hesaba izin vermiyor. Kuralları README’deki gibi ayarla.';
    if (k === 'auth/unauthorized-domain') return 'Bu alan adı Firebase → Authentication → Ayarlar → Yetkili alan adları listesinde yok.';
    if (k === 'auth/popup-closed-by-user') return 'Giriş penceresi kapatıldı.';
    if (k === 'unavailable') return 'Bağlantı yok; çevrimiçi olunca eşitlenir.';
    return (e && e.message) || 'Bilinmeyen hata';
  }

  function uzaktanGeldi(snap) {
    if (itiyor) { return; }
    var yerel = api.al(), uzak = null;
    if (snap.exists) {
      try { uzak = L.durumDogrula(JSON.parse(snap.data().veri)); } catch (e) { uzak = null; }
      if (!uzak) { ayarla('hata', 'Bulut verisi okunamadı; üzerine yazılmadı.'); return; }
      uzak = api.tamamla(uzak);
    }
    var birlesik = uzak ? L.durumBirlestir(yerel, uzak) : yerel;
    var yerelDegisti = kanon(birlesik) !== kanon(yerel);
    var uzakDegisti = !uzak || kanon(birlesik) !== kanon(uzak);
    if (yerelDegisti) api.ata(birlesik);
    if (uzakDegisti) it(birlesik); else { durum.zaman = new Date(); ayarla('tamam'); }
  }

  function it(d) {
    if (!belge) return Promise.resolve();
    itiyor = true; ayarla('esitleniyor');
    return belge.set({ veri: JSON.stringify(d), guncel: d.guncel || Date.now() }).then(function () {
      itiyor = false; durum.zaman = new Date(); ayarla('tamam');
    }, function (e) { itiyor = false; ayarla('hata', hataMetni(e)); });
  }

  window.Sync = {
    kullanilabilir: !!cfg,
    durum: function () { return durum; },
    baslat: function (a) {
      api = a;
      if (!cfg) return;
      // Daha önce giriş yapıldıysa SDK'yı hemen yükle (oturum kendiliğinden döner); yapılmadıysa tıklamayı bekle.
      var onceki = false; try { onceki = localStorage.getItem('ales-yds-takip:sync') === '1'; } catch (e) { }
      if (onceki) yukle().catch(function (e) { ayarla('hata', hataMetni(e)); });
    },
    giris: function () {
      if (!cfg) return;
      ayarla('esitleniyor');
      yukle().then(function () {
        var s = new window.firebase.auth.GoogleAuthProvider();
        return auth.signInWithPopup(s).catch(function (e) {
          if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return auth.signInWithRedirect(s);
          throw e;
        });
      }).then(function () { try { localStorage.setItem('ales-yds-takip:sync', '1'); } catch (e) { } })
        .catch(function (e) { ayarla(durum.eposta ? 'tamam' : 'giris-yok', ''); ayarla('hata', hataMetni(e)); });
    },
    cikis: function () {
      try { localStorage.removeItem('ales-yds-takip:sync'); } catch (e) { }
      if (auth) auth.signOut();
    },
    /* Yerel değişiklikten sonra çağrılır: kısa gecikmeyle birleştirip yazar. */
    degisti: function () {
      if (!belge) return;
      if (bekle) clearTimeout(bekle);
      bekle = setTimeout(function () { bekle = null; belge.get().then(uzaktanGeldiZorla).catch(function (e) { ayarla('hata', hataMetni(e)); }); }, 1500);
    },
    simdi: function () { if (belge) belge.get().then(uzaktanGeldiZorla).catch(function (e) { ayarla('hata', hataMetni(e)); }); }
  };
  /* Yerel değişiklik sonrası: son uzak durumu çekip birleştir (başka cihaz arada yazmış olabilir), sonra it. */
  function uzaktanGeldiZorla(snap) { itiyor = false; uzaktanGeldi(snap); }
})();
