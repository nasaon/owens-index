// 사이트 파일 쓰기: public/data.js(상품), public/history.json(최저가 기록), public/i/<상품>.html(상품별 공유 미리보기)
// build.mjs가 매일 부름. 직접 실행하면 지금 data.js로 기록·공유 페이지만 다시 만듦: node publish.mjs
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

export const SITE = 'https://owens-index.pages.dev';
const file = (name) => new URL(`public/${name}`, import.meta.url);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const kstDay = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const readData = () => { const src = readFileSync(file('data.js'), 'utf8'); return JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1)); };
const daysBefore = (day, n) => new Date(Date.parse(day) - n * 864e5).toISOString().slice(0, 10);

// 지금 재고가 있는 곳 중 최저가 (사이트 상세와 같은 계산). 어디에도 재고가 없으면 null
export function bestPrice(it) {
  const prices = (it.offers ?? []).filter((o) => o[4]).map((o) => o[1]);
  if (!it.ext && it.sizes.some(([, ok]) => ok)) prices.push(it.price);
  return prices.length ? Math.min(...prices) : null;
}

// 최저가 기록: 상품마다 [날짜, 가격]. 1% 넘게 바뀐 날만 남기고(환율 잔변동 무시) 180일 지난 건 버림. 같은 날 다시 돌리면 그날 값을 고침
// 최근 14일(과 그 직전에 유효하던 가격) 중 최고가보다 5% 넘게 싸면 drop = [그 최고가, 그 날짜]
export function track(history, items, day) {
  const keepFrom = daysBefore(day, 180);
  const recentFrom = daysBefore(day, 14);
  const next = {};
  const drops = new Map();
  for (const it of items) {
    const points = (history[it.id] ?? []).filter(([d]) => d >= keepFrom && d < day);
    const price = bestPrice(it);
    const last = points.at(-1);
    if (price !== null && (!last || Math.abs(price - last[1]) / last[1] > 0.01)) points.push([day, price]);
    if (points.length) next[it.id] = points;
    const before = points.filter(([d]) => d < recentFrom).at(-1);
    const peak = [...(before ? [before] : []), ...points.filter(([d]) => d >= recentFrom)].reduce((a, b) => (b[1] > (a?.[1] ?? 0) ? b : a), null);
    if (price !== null && peak && price < peak[1] * 0.95) drops.set(it.id, peak);
  }
  return { next, drops };
}

// 이미지 서버에 1200px로 요청 (사이트 index.html의 sized와 같은 규칙)
function large(head, src) {
  if (!src) return `${SITE}/og.png`;
  const url = src.startsWith('http') ? src : `${head.img}${src}`;
  const add = (key) => `${url}${url.includes('?') ? '&' : '?'}${key}=1200`;
  if (url.includes('cdn.shopify.com') || url.includes('/cdn/shop/')) return add('width');
  if (url.includes('/dw/image/')) return add('sw');
  return url.replace(/\bw_\d+\b/, 'w_1200');
}

// 카카오톡·텔레그램에 상품 링크를 보내면 그 상품 사진·이름·최저가가 미리보기로 나오게, 상품마다 작은 페이지를 만들고 사이트 상세로 넘김
function sharePages(head, items) {
  rmSync(file('i'), { recursive: true, force: true });
  mkdirSync(file('i'));
  for (const it of items) {
    const price = bestPrice(it);
    const stores = (it.offers ?? []).filter((o) => o[4]).length + (!it.ext && it.sizes.some(([, ok]) => ok) ? 1 : 0);
    const desc = [price === null ? '지금은 품절' : `최저 ₩${price.toLocaleString('ko-KR')}${stores > 1 ? ` · 판매처 ${stores}곳` : ''}`, it.category, it.season].filter(Boolean).join(' · ');
    const target = `/?item=${it.id}`;
    writeFileSync(file(`i/${it.id}.html`), `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${esc(it.name)} · OWENS INDEX</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="product"><meta property="og:site_name" content="OWENS INDEX">
<meta property="og:title" content="${esc(it.name)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(large(head, it.images[0]))}"><meta property="og:url" content="${SITE}/i/${it.id}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${SITE}${target}"><meta http-equiv="refresh" content="0; url=${target}">
</head><body><script>location.replace(${JSON.stringify(target)})</script><a href="${target}">${esc(it.name)} 보기</a></body></html>\n`);
  }
}

// 공식몰·판매처가 상품을 내렸다 다시 올리면 등록일이 새로 찍혀 지난 상품이 NEW·신상품순 맨 앞에 뜸 → 전날 data.js의 날짜가 더 이르면 그대로 둠
export function keepAdded(before, items) {
  const was = new Map(before.map((it) => [it.id, it.added]));
  for (const it of items) if (was.get(it.id) && (!it.added || was.get(it.id) < it.added)) it.added = was.get(it.id);
}

export function publish(head, items) {
  if (existsSync(file('data.js'))) keepAdded(readData().items, items);
  const historyFile = file('history.json');
  const { next, drops } = track(existsSync(historyFile) ? JSON.parse(readFileSync(historyFile, 'utf8')) : {}, items, kstDay(head.updated));
  for (const it of items) {
    if (drops.has(it.id)) it.drop = drops.get(it.id);
    else delete it.drop;
  }
  writeFileSync(historyFile, JSON.stringify(next));
  // 상품 하나당 한 줄: 깃허브에서 날마다 바뀐 상품만 diff로 보임
  writeFileSync(file('data.js'), `window.RO_DATA = ${JSON.stringify(head).slice(0, -1)},"items":[\n${items.map((it) => JSON.stringify(it)).join(',\n')}\n]};\n`);
  sharePages(head, items);
  return drops.size;
}

if (process.argv[1]?.endsWith('publish.mjs')) {
  const { items, ...head } = readData();
  console.log(`다시 씀: ${items.length}개, 가격 내림 ${publish(head, items)}개`);
}
