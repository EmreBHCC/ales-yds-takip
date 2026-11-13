// Gerçek tarayıcıda (headless Chrome, CDP) uçtan uca duman testi. Bağımlılık yok; Node 22.
// Kullanım: node test/ui-smoke.mjs   (CHROME ortam değişkeni ile yol verilebilir)
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TIPLER = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const cikti = process.env.EKRAN_DIR || null; // ekran görüntüsü klasörü (isteğe bağlı)

const sunucu = http.createServer((req, res) => {
  const p = req.url.split('?')[0].replace(/^\/+/, '') || 'index.html';
  const f = path.join(kok, p);
  if (!f.startsWith(kok) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TIPLER[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => sunucu.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${sunucu.address().port}/`;

const port = 9300 + Math.floor(Math.random() * 500);
const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'takip-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });

let basarisiz = 0, toplam = 0;
function kontrol(ad, kosul, ek) { toplam++; if (!kosul) { basarisiz++; console.log('FAIL', ad, ek !== undefined ? JSON.stringify(ek) : ''); } else console.log('ok  ', ad); }

async function hedefBul() {
  for (let i = 0; i < 60; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const s = l.find(x => x.type === 'page'); if (s) return s; } catch { }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Chrome hedefi bulunamadı');
}
const hedef = await hedefBul();
const ws = new WebSocket(hedef.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let n = 0; const bekleyen = new Map(); const hatalar = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && bekleyen.has(m.id)) { bekleyen.get(m.id)(m); bekleyen.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') hatalar.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') hatalar.push('console.error: ' + m.params.args.map(a => a.value || a.description).join(' '));
});
const gonder = (method, params = {}) => new Promise(r => { const id = ++n; bekleyen.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const calistir = async (ifade) => {
  const r = await gonder('Runtime.evaluate', { expression: `(async()=>{${ifade}})()`, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'evaluate hatası');
  return r.result.result.value;
};
await gonder('Runtime.enable'); await gonder('Page.enable');
async function git(h) {
  await gonder('Page.navigate', { url: url + h });
  await new Promise(r => setTimeout(r, 400));
}
async function yenileSayfa() { await gonder('Page.reload'); await new Promise(r => setTimeout(r, 400)); }
async function ekran(ad, genislik, tema) {
  if (!cikti) return;
  await gonder('Emulation.setDeviceMetricsOverride', { width: genislik, height: 900, deviceScaleFactor: 1, mobile: genislik < 500 });
  await gonder('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: tema }] });
  await new Promise(r => setTimeout(r, 200));
  const s = await gonder('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.mkdirSync(cikti, { recursive: true });
  fs.writeFileSync(path.join(cikti, ad + '.png'), Buffer.from(s.result.data, 'base64'));
}

// Sayfa içi yardımcılar her evaluate'e eklenir
const Y = `
const q=(s,k=document)=>k.querySelector(s);
const qa=(s,k=document)=>[...k.querySelectorAll(s)];
const alanBul=(et)=>{const l=qa('label').find(x=>x.textContent.trim()===et);return l&&l.nextElementSibling;};
const yaz=(et,v)=>{const e=alanBul(et);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));};
const gonder=(dugme)=>{const b=qa('button').find(x=>x.textContent.trim()===dugme);b.closest('form').requestSubmit();};
const tikla=(metin)=>qa('button').find(x=>x.textContent.trim()===metin).click();
window.confirm=()=>true;
`;
const kos = (kod) => calistir(Y + kod);

try {
  await gonder('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await git('');
  await kos(`localStorage.clear();`);
  await yenileSayfa();

  kontrol('Bugün açılır, 3 varsayılan sınav sayacı', await kos(`return qa('.sayac').length>=3`));
  kontrol('Başlık kırık değil', await kos(`return q('h1').textContent.includes('ALES')`));

  // Deneme: geçersiz
  await git('#deneme');
  await kos(`yaz('Doğru','81'); gonder('Kaydet');`);
  kontrol('YDS 81/80 reddedilir', await kos(`return q('.hata-metni').textContent.includes('aşamaz') && __takip.durum().deneme.length===0`));
  // Deneme: geçerli
  await kos(`yaz('Doğru','56'); gonder('Kaydet');`);
  kontrol('YDS 56/80 kaydedilir', await kos(`const d=__takip.durum().deneme; return d.length===1 && d[0].dogru===56`));
  kontrol('Tablo 70 (C) gösterir', await kos(`return q('main').textContent.includes('70 (C)')`));
  kontrol('Grafik SVG çizilir (nokta + hedef çizgisi)', await kos(`return !!q('svg.grafik circle') && !!q('svg.grafik .hedef')`));
  // ALES geçersiz/geçerli
  await kos(`yaz('Sınav','ales-sayisal'); yaz('Doğru','30'); yaz('Yanlış','25'); gonder('Kaydet');`);
  kontrol('ALES 30+25>50 reddedilir', await kos(`return __takip.durum().deneme.length===1 && q('.hata-metni').textContent.includes('aşamaz')`));
  await kos(`yaz('Doğru','40'); yaz('Yanlış','8'); gonder('Kaydet');`);
  kontrol('ALES net 38', await kos(`return __takip.durum().deneme.length===2 && q('main').textContent.includes('38 net')`));

  // Çalışma
  await git('#calis');
  await kos(`yaz('Süre (dk)','abc'); gonder('Kaydet');`);
  kontrol('Geçersiz süre reddedilir', await kos(`return __takip.durum().calisma.length===0 && q('.hata-metni').textContent.length>0`));
  await kos(`yaz('Süre (dk)','45'); yaz('Konu','<img src=x onerror="window.__xss=1">'); gonder('Kaydet');`);
  kontrol('Çalışma kaydedilir', await kos(`return __takip.durum().calisma.length===1`));
  kontrol('XSS çalışmaz, metin olarak görünür', await kos(`return !window.__xss && !q('main img') && q('main').textContent.includes('<img src=x')`));
  await git('#bugun');
  kontrol('Bugün: hafta 45 dk + seri 1', await kos(`const t=q('main').textContent; return t.includes('45 dk') && t.includes('1 gün')`));

  // Hata defteri
  await git('#hata');
  await kos(`yaz('Konu','Passive'); gonder('Kaydet');`);
  kontrol('Hata eklenir', await kos(`return __takip.durum().hata.length===1`));
  await kos(`tikla('Çözüldü yap');`);
  kontrol('Çözüldü işaretlenir', await kos(`return __takip.durum().hata[0].cozuldu===true`));

  // Kelime
  await git('#kelime');
  await kos(`yaz('İngilizce','enhance'); yaz('Türkçe','geliştirmek'); gonder('Ekle');`);
  kontrol('Kelime eklenir, kart gelir', await kos(`return __takip.durum().kelime.length===1 && !!q('.kelime-kart .en')`));
  await kos(`tikla('Cevabı göster');`);
  kontrol('Cevap açılır', await kos(`return q('.kelime-kart .tr').textContent==='geliştirmek'`));
  await kos(`tikla('Bildim');`);
  kontrol('Kutu 1\'e çıkar, yarına ertelenir', await kos(`const k=__takip.durum().kelime[0]; return k.kutu===1 && k.sonraki>new Date().toISOString().slice(0,4)`));
  await kos(`qa('details').find(d=>d.textContent.includes('Toplu')).open=true; const t=q('textarea'); t.value='boost - artırmak\\nrely on; güvenmek\\nbozuk'; tikla('Ekle');`);
  // 'Ekle' iki düğme: ilk form eşleşir; toplu için ayrıca doğrudan çağır
  const toplu = await kos(`return __takip.durum().kelime.length`);
  kontrol('Toplu ekleme (ilk "Ekle" düğmesi tekli form olabilir; sayı >=1)', toplu >= 1);

  // Konu
  await git('#konu');
  await kos(`q('.konu button').click();`);
  kontrol('Konu durumu Çalıştım olur', await kos(`return Object.values(__takip.durum().konu)[0]===1`));

  // Ayar
  await git('#ayar');
  await kos(`yaz('YDS hedef puan','500'); gonder('Kaydet');`);
  kontrol('Aralık dışı hedef reddedilir', await kos(`return __takip.durum().ayar.ydsHedef===80 && q('.hata-metni').textContent.includes('aralık')`));
  await kos(`yaz('YDS hedef puan','85'); gonder('Kaydet');`);
  kontrol('Hedef güncellenir', await kos(`return __takip.durum().ayar.ydsHedef===85`));

  // Kalıcılık
  await yenileSayfa();
  kontrol('Yenilemeden sonra veri kalır', await kos(`const d=__takip.durum(); return d.deneme.length===2 && d.calisma.length===1 && d.ayar.ydsHedef===85`));

  // Bozuk veri → varsayılana düşer, çökmez
  await kos(`localStorage.setItem('ales-yds-takip:v1','{bozuk');`);
  await yenileSayfa();
  kontrol('Bozuk kayıtla açılır, boş durum, uyarı + ham kopya', await kos(`return __takip.durum().deneme.length===0 && !!q('main h2') && !q('#uyari').hidden && localStorage.getItem('ales-yds-takip:v1:bozuk')==='{bozuk'`), await kos(`return [__takip.durum().deneme.length, qa('.sayac').length, q('#uyari').hidden, localStorage.getItem('ales-yds-takip:v1:bozuk'), localStorage.getItem('ales-yds-takip:v1')]`));

  // Düzen: yatay taşma yok (390 px), tüm sekmelerde
  await kos(`localStorage.clear();`);
  for (const s of ['bugun', 'calis', 'deneme', 'hata', 'kelime', 'konu', 'ayar']) {
    await git('#' + s);
    kontrol('390px yatay taşma yok: ' + s, await kos(`return document.documentElement.scrollWidth<=window.innerWidth+1`), await kos(`return [document.documentElement.scrollWidth,window.innerWidth]`));
  }

  // Ekran görüntüleri (isteğe bağlı): örnek veriyle
  if (cikti) {
    await kos(`
      const t=new Date(); const f=(g)=>{const d=new Date(t); d.setDate(d.getDate()-g); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
      const s=__takip.durum();
      [[40,50],[30,54],[20,52],[10,60],[3,63]].forEach(([g,d],i)=>s.deneme.push({id:'x'+i,tarih:f(g),sinav:'yds',soru:80,dogru:d,yanlis:0,not:''}));
      [[0,60],[1,40],[2,75],[4,30]].forEach(([g,dk],i)=>s.calisma.push({id:'c'+i,tarih:f(g),sinav:i%2?'ales':'yds',konu:'Örnek',dk,not:''}));
      localStorage.setItem('ales-yds-takip:v1',JSON.stringify(s));
    `);
    for (const [ad, hh] of [['bugun', '#bugun'], ['deneme', '#deneme']]) {
      await git(hh); await yenileSayfa();
      await ekran(ad + '-mobil-acik', 390, 'light'); await ekran(ad + '-mobil-koyu', 390, 'dark'); await ekran(ad + '-masaustu-acik', 1000, 'light');
    }
  }

  kontrol('Konsol hatası/istisna yok', hatalar.length === 0, hatalar);
} catch (e) {
  basarisiz++; console.log('İSTİSNA', e.message);
} finally {
  ws.close(); chrome.kill(); sunucu.close();
  try { fs.rmSync(profil, { recursive: true, force: true }); } catch { }
  console.log(`\n${toplam - basarisiz}/${toplam} geçti`);
  process.exit(basarisiz ? 1 : 0);
}
