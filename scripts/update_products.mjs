// scripts/update_products.mjs — follow affiliate links & fix OG parsing
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'data', 'sources.csv');
const OUT = path.join(ROOT, 'data', 'products.json');
const AFF_PREFIX = (process.env.AFF_PREFIX || '').trim();

function uidFor(url){ return 'id-' + crypto.createHash('md5').update(url).digest('hex').slice(0,12); }
function pick(re, html){ const m = html.match(re); return m ? m[1] : ''; }

function parseOG(html){
  const og  = (p)=> pick(new RegExp(`<meta[^>]*property=["']${p}["'][^>]*content=["']([^"']+)["']`, 'i'), html);
  const nm  = (n)=> pick(new RegExp(`<meta[^>]*name=["']${n}["'][^>]*content=["']([^"']+)["']`, 'i'), html);
  const lnk = (r)=> pick(new RegExp(`<link[^>]*rel=["']${r}["'][^>]*href=["']([^"']+)["']`, 'i'), html);

  const title = og('og:title') || nm('twitter:title') || nm('title') || pick(/<title[^>]*>([^<]+)<\/title>/i, html) || '';
  const image = og('og:image') || og('og:image:secure_url') || nm('twitter:image') || nm('image') || '';
  const canonical = lnk('canonical') || '';
  return { title, image, canonical };
}

async function fetchFollow(url){
  try{
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml'
      }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const finalUrl = res.url || url;          // 追蹤短連結後的最終網址
    const html = await res.text();
    const og = parseOG(html);
    const productUrl = og.canonical || finalUrl || url;
    return { productUrl, title: og.title, image: og.image };
  }catch(e){
    console.error('[fetchFollow] Failed:', url, String(e));
    return { productUrl: url, title: '', image: '' };
  }
}

function readCSV(file){
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim() !== '');
  const header = lines[0].split(',').map(s => s.trim());
  const rows = lines.slice(1).map(l=>{
    const cells=[]; let cur='', inQ=false;
    for (let i=0;i<l.length;i++){
      const ch=l[i];
      if (ch === '"'){ inQ=!inQ; continue; }
      if (ch === ',' && !inQ){ cells.push(cur); cur=''; continue; }
      cur += ch;
    }
    cells.push(cur);
    const obj={}; header.forEach((h,i)=> obj[h]=(cells[i]||'').trim());
    return obj;
  });
  return rows;
}

function loadJSON(file, fallback){ try{ return JSON.parse(fs.readFileSync(file,'utf8')); } catch(_){ return fallback; } }
function isPlaceholder(aff){ return /example\.com|shope\.ee\/xxxx/i.test(aff); }
function buildAffiliate(url, given){
  if (given && !isPlaceholder(given)) return given;
  if (AFF_PREFIX && url) return AFF_PREFIX + encodeURIComponent(url);
  return given || url;
}

async function main(){
  const rows = readCSV(SRC);
  const prev = loadJSON(OUT, { items: [], lastUpdated: '' });
  const prevMap = new Map(prev.items.map(it => [it.id, it]));

  const items = [];
  for (const row of rows){
    // 1) 取得抓取目標：url 沒填就用 affiliate_url
    const target = row.url || row.affiliate_url;
    if (!target) continue;

    const id = uidFor(target);
    const prevIt = prevMap.get(id);

    // 2) 追蹤短連結並抓 OG
    const { productUrl, title, image } = await fetchFollow(target);
    const now = new Date().toISOString();

    const finalAffiliate = buildAffiliate(productUrl, row.affiliate_url);

    items.push({
      id,
      title: row.title || title || prevIt?.title || productUrl,
      price: row.price || prevIt?.price || '',
      rating: row.rating || prevIt?.rating || '',
      category: row.category || prevIt?.category || '',
      brand: row.brand || prevIt?.brand || '',
      tags: row.tags || prevIt?.tags || '',
      image: row.image || image || prevIt?.image || 'https://dummyimage.com/600x600/1b1d26/ffffff&text=No+Image',
      url: productUrl,                    // ← 解析後的最終商品頁
      affiliate_url: finalAffiliate,      // ← 你的分潤短連結或模板生成
      note: row.note || prevIt?.note || '',
      added_at: prevIt?.added_at || now,
      updated_at: now,
      active: (row.active || prevIt?.active || 'true').toString().toLowerCase() !== 'false'
    });
  }

  fs.writeFileSync(OUT, JSON.stringify({ items, lastUpdated: new Date().toISOString() }, null, 2));
  console.log('Updated', OUT, 'items:', items.length);
}
main().catch(e => { console.error(e); process.exit(1); });
