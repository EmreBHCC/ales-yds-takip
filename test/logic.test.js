const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

test('YDS puan ve harf: 64 doğru = 80 = B', () => {
  assert.equal(L.ydsPuan(64, 80), 80);
  assert.equal(L.ydsHarf(80), 'B');
  assert.equal(L.ydsHarf(79.9), 'C');
  assert.equal(L.ydsPuan(72, 80), 90);
  assert.equal(L.ydsHarf(90), 'A');
  assert.equal(L.ydsHarf(49), '—');
  assert.equal(L.ydsPuan(10, 0), 0);
});

test('ALES net: 4 yanlış 1 doğruyu götürür', () => {
  assert.equal(L.alesNet(40, 8), 38);
  assert.equal(L.alesNet(30, 3), 29.25);
});

test('tarih yardımcıları', () => {
  assert.equal(L.gunEkle('2026-12-31', 1), '2027-01-01');
  assert.equal(L.gunFarki('2026-11-13', '2027-03-28'), 135);
  assert.equal(L.haftaBasi('2026-11-15'), '2026-11-09'); // Pazar -> önceki Pazartesi
  assert.equal(L.haftaBasi('2026-11-09'), '2026-11-09');
});

test('haftalık dakika ve seri', () => {
  const c = [
    { tarih: '2026-11-09', dk: 30 }, { tarih: '2026-11-09', dk: 20 },
    { tarih: '2026-11-11', dk: 60 }, { tarih: '2026-11-16', dk: 99 }
  ];
  assert.deepEqual(L.haftalik(c, '2026-11-09'), [50, 0, 60, 0, 0, 0, 0]);
  const s = [{ tarih: '2026-11-11', dk: 5 }, { tarih: '2026-11-12', dk: 5 }, { tarih: '2026-11-13', dk: 5 }];
  assert.equal(L.seri(s, '2026-11-13'), 3);
  assert.equal(L.seri(s, '2026-11-14'), 3); // bugün boş, dün sayılır
  assert.equal(L.seri(s, '2026-11-15'), 0);
});

test('Leitner kartı', () => {
  const k = { en: 'a', tr: 'b', kutu: 0, sonraki: '2026-11-13' };
  const bildi = L.kartCevapla(k, true, '2026-11-13');
  assert.equal(bildi.kutu, 1);
  assert.equal(bildi.sonraki, '2026-11-14');
  const bilemedi = L.kartCevapla({ ...k, kutu: 3 }, false, '2026-11-13');
  assert.equal(bilemedi.kutu, 0);
  assert.equal(bilemedi.sonraki, '2026-11-14');
  const tavan = L.kartCevapla({ ...k, kutu: 5 }, true, '2026-11-13');
  assert.equal(tavan.kutu, 5);
  assert.equal(tavan.sonraki, '2026-12-18');
  assert.equal(L.bugunTekrar([k, { ...k, sonraki: '2026-12-01' }], '2026-11-13').length, 1);
});

test('kelime ayıklama', () => {
  const r = L.kelimeAyikla('enhance - geliştirmek\nboost = artırmak\n\nkötü satır\nrely on; güvenmek\nuse\tkullanmak');
  assert.equal(r.kelimeler.length, 4);
  assert.equal(r.atlanan, 1);
  assert.deepEqual(r.kelimeler[0], { en: 'enhance', tr: 'geliştirmek' });
  assert.equal(r.kelimeler[2].en, 'rely on');
});

test('deneme doğrulama', () => {
  assert.equal(L.dogrula({ sinav: 'yds', soru: 80, dogru: 64 }).length, 0);
  assert.equal(L.dogrula({ sinav: 'yds', soru: 80, dogru: 81 }).length, 1);
  assert.equal(L.dogrula({ sinav: 'ales-sayisal', soru: 50, dogru: 30, yanlis: 21 }).length, 1);
  assert.equal(L.dogrula({ sinav: 'ales-sayisal', soru: 0, dogru: 0, yanlis: 0 }).length, 1);
  assert.equal(L.denemeDeger({ sinav: 'yds', soru: 80, dogru: 56 }), 70);
  assert.equal(L.denemeDeger({ sinav: 'ales-sozel', soru: 50, dogru: 40, yanlis: 8 }), 38);
});

test('içe aktarma denetimi', () => {
  const iyi = { v: 1, ayar: { tarihler: [] }, calisma: [], deneme: [], hata: [], kelime: [], konu: {} };
  assert.ok(L.durumDogrula(iyi));
  assert.equal(L.durumDogrula({ v: 2 }), null);
  assert.equal(L.durumDogrula({ ...iyi, hata: 'x' }), null);
  assert.equal(L.durumDogrula(null), null);
});
