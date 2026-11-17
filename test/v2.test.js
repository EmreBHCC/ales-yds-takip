const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

/* v2: takvim, başvuru, ALES tahmini, günlük plan, özet, birleştirme */
function bosDurum() {
  return { v: 1, ayar: { ydsHedef: 80, alesHedefNet: 40, haftalikSaat: 5, tarihler: L.takvimiBirlestir([]) }, calisma: [], deneme: [], hata: [], kelime: [], konu: {}, alesSonuc: [] };
}

test('takvim: 7 sınav, başvuru pencereleri sınavdan önce', () => {
  assert.equal(L.TAKVIM_2027.length, 7);
  L.TAKVIM_2027.forEach(t => {
    assert.ok(t.basvuru[0] < t.basvuru[1], t.ad);
    assert.ok(t.basvuru[1] < t.tarih, t.ad);
    assert.ok(t.tarih < t.sonuc, t.ad);
  });
});

test('takvimiBirlestir: eski kaydı korur, eksik sınavı ekler, kullanıcı tarihine dokunmaz', () => {
  const eski = [
    { id: 'd1', ad: 'YÖKDİL/1', tarih: '2027-02-28', dogrulandi: true },
    { id: 'd2', ad: 'YDS/1', tarih: '2027-03-30', dogrulandi: false } // kullanıcı elle değiştirmiş
  ];
  const y = L.takvimiBirlestir(eski);
  assert.equal(y.length, 7);
  const yok1 = y.find(t => t.ad === 'YÖKDİL/1');
  assert.equal(yok1.dogrulandi, true);
  assert.deepEqual(yok1.basvuru, ['2027-01-12', '2027-01-20']);
  const yds1 = y.find(t => t.ad === 'YDS/1');
  assert.equal(yds1.tarih, '2027-03-30');
  assert.equal(yds1.basvuru, undefined);
  assert.equal(L.takvimiBirlestir(y).length, 7);
});

test('başvuru durumu: yakın, açık, geçmiş', () => {
  const t = L.takvimiBirlestir([]);
  const a = L.basvuruDurumu(t, '2027-01-14').find(x => x.ad === 'YDS/1');
  assert.equal(a.durum, 'yakin'); assert.equal(a.gun, 20);
  const b = L.basvuruDurumu(t, '2027-02-05').find(x => x.ad === 'YDS/1');
  assert.equal(b.durum, 'acik'); assert.equal(b.gun, 6);
  assert.equal(L.basvuruDurumu(t, '2027-02-12').find(x => x.ad === 'YDS/1'), undefined);
  assert.equal(L.basvuruDurumu(t, '2026-11-17').length, 0);
});

test('ALES tahmini: sonuç yoksa null, uydurma yok', () => {
  assert.equal(L.alesTahmin([], 'sayisal', 35), null);
  assert.equal(L.alesTahmin([{ tur: 'sozel', net: 30, puan: 70 }], 'sayisal', 35), null);
  assert.equal(L.alesHedefNet([], 'sayisal', 70), null);
});

test('ALES tahmini: tek sonuç -> geniş aralık, aynı netde sonucun kendisi', () => {
  const s = [{ tur: 'sayisal', net: 35, puan: 70 }];
  const t = L.alesTahmin(s, 'sayisal', 35);
  assert.equal(t.orta, 70); assert.equal(t.nokta, 1);
  assert.equal(t.ust - t.alt, 8);
  assert.ok(L.alesTahmin(s, 'sayisal', 40).orta > 70);
});

test('ALES tahmini: birkaç sonuçtan eğim öğrenir, aralık daralır', () => {
  const s = [{ tur: 'sayisal', net: 20, puan: 55 }, { tur: 'sayisal', net: 30, puan: 65 }, { tur: 'sayisal', net: 40, puan: 75 }];
  const t = L.alesTahmin(s, 'sayisal', 35);
  assert.equal(t.egim, 1);
  assert.equal(t.orta, 70);
  assert.equal(t.ust - t.alt, 5);
  assert.equal(L.alesHedefNet(s, 'sayisal', 80), 45);
});

test('günlük plan: boş durumda çalışma payı + ilk deneme, kart yok', () => {
  const p = L.gunlukPlan(bosDurum(), '2026-11-17');
  assert.deepEqual(p.map(x => x.anahtar), ['calisma', 'deneme']);
  assert.match(p[1].baslik, /baz çizgi/);
  assert.ok(p[0].dk >= 20 && p[0].dk <= 120);
});

test('günlük plan: bekleyen kart ve açık hata maddeleri, bitince işaretlenir', () => {
  const d = bosDurum();
  d.kelime = [{ id: 'k1', en: 'a', tr: 'b', kutu: 0, sonraki: '2026-11-17' }, { id: 'k2', en: 'c', tr: 'd', kutu: 1, sonraki: '2026-11-20' }];
  d.hata = [{ id: 'h1', tarih: '2026-11-16', sinav: 'yds', konu: 'x', neden: 'Bilgi eksiği', cozuldu: false }];
  let p = L.gunlukPlan(d, '2026-11-17');
  assert.equal(p.find(x => x.anahtar === 'kelime').bitti, false);
  assert.equal(p.find(x => x.anahtar === 'hata').bitti, false);
  d.kelime[0] = L.kartCevapla(d.kelime[0], true, '2026-11-17');
  d.hata[0].cozuldu = true; d.hata[0].cozulduTarih = '2026-11-17';
  d.calisma.push({ id: 'c', tarih: '2026-11-17', sinav: 'yds', dk: 120 });
  p = L.gunlukPlan(d, '2026-11-17');
  assert.equal(p.find(x => x.anahtar === 'kelime').bitti, true);
  assert.equal(p.find(x => x.anahtar === 'hata').bitti, true);
  assert.equal(p.find(x => x.anahtar === 'calisma').bitti, true);
});

test('günlük plan: yaklaşan sınav alanı önde, aşırı yüklenmişse diğerine geçer', () => {
  const d = bosDurum();
  d.ayar.tarihler = L.takvimiBirlestir([]).filter(t => t.ad !== 'YÖKDİL/1' && t.ad !== 'YDS/1');
  const bg = '2027-04-07';
  assert.equal(L.gunlukPlan(d, bg).find(x => x.anahtar === 'calisma').alan, 'ales');
  d.calisma.push({ id: 'x', tarih: '2027-04-05', sinav: 'ales', dk: 300 });
  assert.equal(L.gunlukPlan(d, bg).find(x => x.anahtar === 'calisma').alan, 'yds');
});

test('haftalık özet ve ara mesajı', () => {
  const d = bosDurum();
  d.calisma = [{ id: '1', tarih: '2026-11-10', sinav: 'yds', dk: 60 }, { id: '2', tarih: '2026-11-03', sinav: 'ales', dk: 30 }];
  d.hata = [{ id: 'h', tarih: '2026-11-10', sinav: 'yds', konu: 'x', neden: 'Dikkat hatası', cozuldu: false }];
  const o = L.haftalikOzet(d, '2026-11-12');
  assert.equal(o.bu, 60); assert.equal(o.once, 30); assert.equal(o.gunSay, 1); assert.equal(o.enNeden, 'Dikkat hatası');
  assert.equal(L.araMesaji(d.calisma, '2026-11-11'), null);
  assert.equal(L.araMesaji(d.calisma, '2026-11-14').gun, 4);
  assert.equal(L.araMesaji([], '2026-11-14'), null);
});

test('hedef yolu: kalan hafta ve haftalık gereken artış', () => {
  const d = bosDurum();
  d.deneme = [{ id: 'a', sinav: 'yds', soru: 80, dogru: 56, yanlis: 0, tarih: '2027-01-31' }];
  const y = L.hedefYolu(d, '2027-01-31', 'yds');
  assert.equal(y.son, 70); assert.equal(y.hedef, 80); assert.equal(y.fark, 10);
  assert.equal(y.hafta, 4); assert.equal(y.haftalik, 2.5);
  assert.equal(L.hedefYolu(d, '2027-01-31', 'ales-sayisal'), null);
});

test('birleştirme: iki cihaz birleşir, silinen geri gelmez, yeni kazanır', () => {
  const a = bosDurum(), b = bosDurum();
  a.guncel = 100; b.guncel = 200;
  a.calisma = [{ id: 'c1', dk: 30, tarih: '2026-11-17', sinav: 'yds' }];
  b.calisma = [{ id: 'c2', dk: 20, tarih: '2026-11-17', sinav: 'ales' }];
  a.hata = [{ id: 'h1', cozuldu: false, guncel: 100 }]; b.hata = [{ id: 'h1', cozuldu: true, guncel: 150 }];
  a.kelime = [{ id: 'k1', kutu: 3, guncel: 300 }]; b.kelime = [{ id: 'k1', kutu: 1, guncel: 120 }];
  b.deneme = [{ id: 'd1', guncel: 50 }]; a.silinen = { d1: 60 };
  a.ayar.ydsHedef = 70; b.ayar.ydsHedef = 85;
  const m = L.durumBirlestir(a, b);
  assert.deepEqual(m.calisma.map(x => x.id).sort(), ['c1', 'c2']);
  assert.equal(m.hata[0].cozuldu, true);
  assert.equal(m.kelime[0].kutu, 3);
  assert.equal(m.deneme.length, 0);
  assert.equal(m.ayar.ydsHedef, 85);
  assert.equal(m.guncel, 200);
  assert.deepEqual(L.durumBirlestir(b, a).calisma.map(x => x.id).sort(), ['c1', 'c2']);
  b.deneme = [{ id: 'd1', guncel: 90 }];
  assert.equal(L.durumBirlestir(a, b).deneme.length, 1);
});
