// scripts/update_products.mjs — Shopee 強化版（跟隨短連結 + 解析 ld+json + 圖片兜底）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'data', 'sources.csv');
const OUT = path.join(ROOT, 'data', 'products.json');
const AFF_PREFIX = (process.env.AFF_PREFIX || '').trim();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function uidFor(url){ return 'id-' + crypto.createHash('md5').update(url).digest('hex').slice(0,12); }
function m(html, re){ const x = html.match(re); return x ? x[1] : ''; }

// 解析 OG / Twitter / <title> / canonical
function parseBasic(html){
  const prop = p => m(html, new RegExp(`<meta[^>]*property=["']${p}["'][^>]*content=["']([^"']+)["']`, 'i'));
  const name = n => m(html, new RegExp(`<meta[^>]*name=["']${n}["'][^>]*content=["']([^"']+)["']`, 'i'));
  const link = r => m(html, new RegExp(`<link[^>]*rel=["']${r}["'][^>]*href=["']([^"']+)["']`, 'i'));
  const title = prop('og:title') || name('twitter:title') || name('title') || m(html, /<title[^>]*>([^<]+)<\/title>/i) || '';
  const image = prop('og:image') || prop('og:image:secure_url') || name('twitter:image') || name('image') || '';
  const canonical = link('canonical') || '';
  return { title, image, canonical };
}

// 解析 <script type="application/ld+json"> 裡的 Product.name / image
function parseLD(html){
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/ig)];
  for (const b of blocks){
    try{
      const json = JSON.parse(b[1].trim());
      // 可能是陣列或物件
      const nodes = Array.isArray(json) ? json : [json];
      for (const n of nodes){
        if (!n) continue;
        if (n['@type'] && String(n['@type']).toLowerCase().includes('product')){
          const title = n.name || '';
          let image = '';
          if (Array.isArray(n.image)) image = n.image[0] || '';
          else if (typeof n.image === 'string') image = n.image;
          if (title || image) return { title, image };
        }
        // 有時會把 product 放在 graph
        if (Array.isArray(n['@graph'])){
          for (const g of n['@graph']){
            if (g && g['@type'] && String(g['@type']).toLowerCase().includes('product')){
              const title = g.name || '';
              let image = '';
              if (Array.isArray(g.image)) image = g.image[0] || '';
              else if (typeof g.image === 'string') image = g.image;
              if (title || image) return { title, image };
            }
          }
        }
      }
    } catch(_) {}
  }
  return { title:'', image:'' };
}

// 兜底：直接掃出 Shopee 圖片 CDN
function fallbackShopeeImage(html){
  const hit = html.match(/https?:\/\/(?:cf|down-[\w-]+)\.shopee\.tw\/file\/[A-Za-z0-9_.-]+/i);
  return hit ? hit[0] : '';
}

// 追蹤短連結 → 取得最終商品頁 HTML
async function fetchHTML(url){
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': UA, 'accept': 'text/html,application/xhtml+xml' }
  });
  if (!res.ok) throw new Error('HTTP '+res.status);
  const html = await res.text();
  return { finalUrl: res.url || url, html };
}

// 綜合解析：優先 ld+json，其次 OG，最後兜底
async function extractFrom(target){
  const { finalUrl, html } = await fetchHTML(target);
  const b = parseBasic(html);
  const ld = parseLD(html);
  const title = ld.title || b.title || '';
  const image = ld.image || b.image || fallbackShopeeImage(html) || '';
  const productUrl = b.canonical || finalUrl || target;
  return { productUrl, title, image };
}

function readCSV(file){
  const raw = fs.readFileSync(file,'utf8');
  const lines = raw.split(/\r?\n/).filter(l=>l.trim()!=='');
  const header = lines[0].split(',').map(s=>s.trim());
  const rows = lines.slice(1).map(line=>{
    const cells=[]; let cur='', inQ=false;
    for (let i=0;i<line.length;i++){
      const ch=line[i];
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

function loadJSON(file, fb){ try{ return JSON.parse(fs.readFileSync(file,'utf8')); } catch(_){ return fb; } }
function isPlaceholder(aff){ return /example\.com|shope\.ee\/xxxx/i.test(aff); }
function buildAff(url, given){
  if (given && !isPlaceholder(given)) return given;
  if (AFF_PREFIX && url) return AFF_PREFIX + encodeURIComponent(url);
  return given || url;
}

async function main(){
  const rows = readCSV(SRC);
  const prev = loadJSON(OUT, { items: [], lastUpdated: '' });
  const prevMap = new Map(prev.items.map(it=>[it.id,it]));

  const items = [];
  for (const row of rows){
    const target = row.url || row.affiliate_url;   // ← 允許只填短連結
    if (!target) continue;

    const id = uidFor(target);
    const prevIt = prevMap.get(id);

    let title='', image='', productUrl=target;
    try{
      const r = await extractFrom(target);
      title = r.title; image = r.image; productUrl = r.productUrl;
    }catch(e){
      console.error('[extract error]', target, e.message);
    }

    const now = new Date().toISOString();
    items.push({
      id,
      title: row.title || title || prevIt?.title || productUrl,
      price: row.price || prevIt?.price || '',
      rating: row.rating || prevIt?.rating || '',
      category: row.category || prevIt?.category || '',
      brand: row.brand || prevIt?.brand || '',
      tags: row.tags || prevIt?.tags || '',
      image: row.image || image || prevIt?.image || 'https://dummyimage.com/600x600/1b1d26/ffffff&text=No+Image',
      url: productUrl,
      affiliate_url: buildAff(productUrl, row.affiliate_url),
      note: row.note || prevIt?.note || '',
      added_at: prevIt?.added_at || now,
      updated_at: now,
      active: (row.active || prevIt?.active || 'true').toString().toLowerCase() !== 'false'
    });
  }

  fs.writeFileSync(OUT, JSON.stringify({ items, lastUpdated: new Date().toISOString() }, null, 2));
  console.log('Updated', OUT);
}

main().catch(e=>{ console.error(e); process.exit(1); });
