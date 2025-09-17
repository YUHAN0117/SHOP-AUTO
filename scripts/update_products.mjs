// scripts/update_products.mjs (enhanced)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'data', 'sources.csv');
const OUT = path.join(ROOT, 'data', 'products.json');

function uidFor(url){
  return 'id-' + crypto.createHash('md5').update(url).digest('hex').slice(0,12);
}

function pick(re, html){
  const m = html.match(re);
  return m ? m[1] : '';
}

function parseOG(html){
  const og = (prop) => pick(new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'), html);
  const byName = (name) => pick(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'), html);
  const title = og('og:title') || byName('twitter:title') || byName('title') || pick(/<title[^>]*>([^<]+)<\/title>/i, html);
  const image = og('og:image') || og('og:image:secure_url') || byName('twitter:image') || byName('image');
  return { title: title || '', image: image || '' };
}

async function fetchOG(url){
  try{
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml'
      }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    return parseOG(html);
  }catch(e){
    console.error('[fetchOG] Failed:', url, String(e));
    return { title: '', image: '' };
  }
}

function readCSV(file){
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim() !== '');
  const header = lines[0].split(',').map(s => s.trim());
  const rows = lines.slice(1).map(l => {
    const cells = [];
    let cur = '', inQ = false;
    for (let i=0;i<l.length;i++){
      const ch = l[i];
      if (ch === '"'){ inQ = !inQ; continue; }
      if (ch === ',' && !inQ){ cells.push(cur); cur=''; continue; }
      cur += ch;
    }
    cells.push(cur);
    const obj = {};
    header.forEach((h,i)=> obj[h] = (cells[i]||'').trim());
    return obj;
  });
  return rows;
}

function loadJSON(file, fallback){
  try{ return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(_){ return fallback; }
}

async function main(){
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });

  const rows = readCSV(SRC);
  const prev = loadJSON(OUT, { items: [], lastUpdated: '' });
  const prevMap = new Map(prev.items.map(it => [it.id, it]));

  const items = [];
  for (const row of rows){
    if (!row.url) continue;
    const id = uidFor(row.url);
    const prevIt = prevMap.get(id);

    const og = await fetchOG(row.url);
    const now = new Date().toISOString();

    const item = {
      id,
      title: row.title || og.title || prevIt?.title || row.url,
      price: row.price || prevIt?.price || '',
      rating: row.rating || prevIt?.rating || '',
      category: row.category || prevIt?.category || '',
      brand: row.brand || prevIt?.brand || '',
      tags: row.tags || prevIt?.tags || '',
      image: row.image || og.image || prevIt?.image || '',
      url: row.url,
      affiliate_url: row.affiliate_url || prevIt?.affiliate_url || row.url,
      note: row.note || prevIt?.note || '',
      added_at: prevIt?.added_at || now,
      updated_at: now,
      active: (row.active || prevIt?.active || 'true').toString().toLowerCase() != 'false'
    };
    items.push(item);
  }

  const out = { items, lastUpdated: new Date().toISOString() };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('Wrote', OUT, 'items:', items.length);
}

main().catch(err => { console.error(err); process.exit(1); });
