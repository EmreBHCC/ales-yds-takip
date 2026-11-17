const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

/* Oyunlaştırma: XP/seviye/rozet kayıtlardan türetilir; ayrıca saklanan sayı yok. */
function bos() {
  return { v: 1, ayar: { tarihler: [] }, calisma: [], deneme: [], hata: [], kelime: [], konu: {}, alesSonuc: [] };
}

test('boş kayıt: 0 XP, seviye 1, tüm rozetler kilitli', () => {
  const o = L.oyuncu(bos(), 30);
  assert.equal(o.xp, 0);
  assert.equal(o.seviye, 1);
  assert.equal(o.unvan, 'Çaylak');
  assert.equal(o.yuzde, 0);
  assert.ok(o.rozetler.length >= 10);
  assert.ok(o.rozetler.every(r => !r.acik));
});

test('XP kuralı: dakika, deneme, çözülen hata, kart kutusu, konu', () => {
  const d = bos();
  d.calisma.push({ tarih: '2026-11-10', dk: 30 }, { tarih: '2026-11-11', dk: 20 });
  d.deneme.push({ sinav: 'yds' });
  d.hata.push({ cozuldu: true }, { cozuldu: false });
  d.kelime.push({ kutu: 2 }, { kutu: 0 });
  d.konu = { a: 1, b: 2, c: 0 };
  // 50 + 40 + 8 + 6 + 6 + 15
  assert.equal(L.xpHesapla(d), 125);
});

test('seviye eşikleri 50·(n−1)²: 49 XP sv1, 50 XP sv2, 200 XP sv3', () => {
  const d = bos();
  const sv = (dk) => { d.calisma = [{ tarih: '2026-11-10', dk }]; return L.oyuncu(d, 30).seviye; };
  assert.equal(sv(49), 1);
  assert.equal(sv(50), 2);
  assert.equal(sv(199), 2);
  assert.equal(sv(200), 3);
  assert.equal(L.seviyeEsik(3), 200);
});

test('seviye içi ilerleme yüzdesi 0–100 aralığında, eşikte sıfırlanır', () => {
  const d = bos();
  d.calisma = [{ tarih: '2026-11-10', dk: 125 }]; // sv2: 50..200 → 75/150
  const o = L.oyuncu(d, 30);
  assert.equal(o.seviyeXp, 75);
  assert.equal(o.seviyeGerek, 150);
  assert.equal(Math.round(o.yuzde), 50);
  d.calisma = [{ tarih: '2026-11-10', dk: 200 }];
  assert.equal(L.oyuncu(d, 30).yuzde, 0);
});

test('negatif ya da bozuk dakika/kutu XP düşürmez', () => {
  const d = bos();
  d.calisma = [{ tarih: '2026-11-10', dk: -50 }, { tarih: '2026-11-10', dk: 10 }];
  d.kelime = [{ kutu: -1 }, {}];
  assert.equal(L.xpHesapla(d), 10);
});

test('en uzun seri: aradaki boşlukta sıfırlanır, geçmişteki en iyi korunur', () => {
  const c = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-08', '2026-11-09'].map(t => ({ tarih: t, dk: 10 }));
  assert.equal(L.enUzunSeri(c), 4);
  assert.equal(L.enUzunSeri([]), 0);
  assert.equal(L.enUzunSeri([{ tarih: '2026-11-01', dk: 0 }]), 0);
  // aynı gün iki kayıt seriyi şişirmez
  assert.equal(L.enUzunSeri([{ tarih: '2026-11-01', dk: 5 }, { tarih: '2026-11-01', dk: 5 }]), 1);
});

test('rozetler: koşulda açılır, açılan rozet seri bozulunca kapanmaz', () => {
  const d = bos();
  const ac = () => L.oyuncu(d, 30).rozetler.filter(r => r.acik).map(r => r.id);
  assert.deepEqual(ac(), []);
  d.calisma = ['2026-11-01', '2026-11-02', '2026-11-03'].map(t => ({ tarih: t, dk: 10 }));
  assert.deepEqual(ac().sort(), ['ilk-adim', 'seri-3']);
  d.calisma.push({ tarih: '2026-11-20', dk: 10 }); // seri bozuldu, rozet kalır
  assert.ok(ac().includes('seri-3'));
  d.deneme.push({ sinav: 'yds' });
  assert.ok(ac().includes('ilk-deneme'));
});

test('konu rozeti: toplam konu sayısı verilmezse açılmaz', () => {
  const d = bos();
  d.konu = { a: 2, b: 2 };
  assert.ok(!L.oyuncu(d, 0).rozetler.find(r => r.id === 'konu-yari').acik);
  assert.ok(L.oyuncu(d, 4).rozetler.find(r => r.id === 'konu-yari').acik);
  assert.ok(!L.oyuncu(d, 5).rozetler.find(r => r.id === 'konu-yari').acik);
});

test('ünvan ve fidan aşaması seviyeyle yükselir', () => {
  const d = bos();
  d.calisma = [{ tarih: '2026-11-10', dk: 50 * 4 * 4 }]; // sv5
  const o = L.oyuncu(d, 30);
  assert.equal(o.seviye, 5);
  assert.equal(o.unvan, 'Gezgin');
  assert.equal(o.asama, 1);
});
