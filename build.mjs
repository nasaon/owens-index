// 릭오웬스 공식몰(rickowens.eu)과 다른 판매처 상품을 받아 사이트용 public/data.js로 저장: node build.mjs
import { writeFileSync } from 'node:fs';
import { EXCLUDED, STORES, UNSUPPORTED, collect, fromCode, kindOf, match } from './stores.mjs';

// 한국 마켓: 원화 가격, 한국에서 살 수 있는 상품 기준
const BASE = 'https://www.rickowens.eu/en-kr';
// 상품 이미지 주소 앞부분은 전부 같아서 한 번만 저장 (data.js 크기 절약)
const IMG = 'https://cdn.shopify.com/s/files/1/0655/9278/7001/files/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function products(path) {
  const out = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${BASE}${path}?limit=250&page=${page}`, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
    const { products: batch } = await res.json();
    if (!batch.length) return out;
    out.push(...batch);
    await sleep(400); // 공식몰에 부담 주지 않게 요청 간격
  }
}
const ids = async (handle) => new Set((await products(`/collections/${handle}/products.json`)).map((p) => p.id));

// 공식몰 상품 분류 → [사이트 그룹, 한국어 분류]
const TYPES = {
  'T-SHIRTS / SHIRTS': ['tops', '티셔츠·셔츠'],
  TOPS: ['tops', '탑'],
  'SWEATSHIRTS / HOODIES': ['tops', '스웻·후디'],
  KNITWEAR: ['tops', '니트'],
  OUTERWEAR: ['outer', '아우터'],
  BOTTOMS: ['bottoms', '하의'],
  DRESS: ['dress', '드레스'],
  SHOES: ['shoes', '신발'],
  BAGS: ['acc', '가방'],
  JEWELERY: ['acc', '주얼리'],
  ACCESSORIES: ['acc', '액세서리'],
  'SWIMWEAR / UNDERWEAR': ['etc', '수영복·언더웨어'],
  HOME: ['etc', '홈'],
};

// 상품 설명에서 핏·기장 단어를 뽑아 한국어 표시로 (설명 원문은 옮기지 않음)
const FIT = [
  [/\bslim\b/, '슬림'], [/\bskinny\b/, '스키니'], [/\bstraight\b/, '스트레이트'], [/\bwide\b/, '와이드'],
  [/\bcropped\b/, '크롭'], [/\boversized?\b/, '오버사이즈'], [/\bloose\b/, '루즈'], [/\bboxy\b/, '박시'],
  [/\bregular fit\b/, '레귤러'], [/\brelaxed\b/, '릴랙스드'], [/\btapered\b/, '테이퍼드'], [/\bfitted\b/, '핏티드'],
  [/\b(low|drop|dropped) crotch\b/, '로우크로치'], [/\bhigh[- ]waist(ed)?\b/, '하이웨이스트'], [/\blow[- ]rise\b/, '로우라이즈'], [/\bhigh[- ]rise\b/, '하이라이즈'],
];
// 같은 묶음 안에서는 먼저 맞는 하나만 (예: '힙 아래 기장'이 맞으면 '힙 기장'은 건너뜀)
const DETAILS = [
  [[/\bbelow (the )?hip length\b/, '힙 아래 기장'], [/\bhip length\b/, '힙 기장'], [/\bwaist length\b/, '허리 기장'], [/\bbelow (the )?knee\b/, '무릎 아래 기장'],
    [/\bknee length\b/, '무릎 기장'], [/\bmid[- ]calf\b/, '종아리 기장'], [/\bankle length\b/, '발목 기장'], [/\bfull length\b/, '풀 기장'], [/\bfloor length\b/, '바닥 기장']],
  [[/\babove (the )?ankle height\b/, '발목 위 높이'], [/\bankle height\b/, '발목 높이'], [/\bknee height\b/, '무릎 높이']],
  [[/\bsleeveless\b/, '민소매'], [/\blong sleeves?\b/, '긴소매'], [/\bshort sleeves?\b/, '반소매']],
];

console.log('공식몰 전체 상품과 남성·여성·키즈·하의 컬렉션 받는 중…');
// /products.json은 전체의 절반 정도만 나와서 '전체 상품' 컬렉션을 기준으로 씀
const all = await products('/collections/all-products/products.json');
const [men, women, kids, menBottoms, womenBottoms] = [await ids('mens-all'), await ids('womens-all'), await ids('kids-all'), await ids('mens-bottoms'), await ids('womens-bottoms')];
// 협업은 공식몰 협업 컬렉션 기준 (Champion·Converse는 지금 비어 있지만 다시 들어오면 잡힘)
const COLLABS = { Moncler: 'collab-moncler', Champion: 'champion', Converse: 'converse-x-drkshdw', 'Dr. Martens': 'dr-martens', Selahatin: 'selahatin-x-rick-owens', Livy: 'livy-x-rick-owens' };
const collabs = {};
for (const [name, handle] of Object.entries(COLLABS)) collabs[name] = await ids(handle);
// 라인은 공식몰 DRKSHDW·LILIES 컬렉션 기준 (설명 첫 단어로 판단하면 30개쯤 빠짐)
const [runway, lilies, drkshdw] = [await ids('homepage-runway-pieces'), await ids('line-lilies'), await ids('drkshdw-1')];

const items = [];
for (const p of all) {
  const inMen = men.has(p.id);
  const inWomen = women.has(p.id);
  if (kids.has(p.id) && !inMen && !inWomen) continue; // 키즈 전용은 제외
  const [codePart, namePart] = p.title.includes(' | ') ? p.title.split(' | ') : ['', p.title];
  const segs = codePart.split('_');
  const text = p.body_html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  let [group, category] = TYPES[p.product_type] ?? ['etc', p.product_type || '기타'];
  if (menBottoms.has(p.id) || womenBottoms.has(p.id)) [group, category] = ['bottoms', category === '니트' ? '니트 하의' : '하의'];
  items.push({
    id: p.handle,
    code: segs[0] || '',
    color: segs.length > 1 ? segs.at(-1) : '',
    name: namePart.trim().replace(/Â(?=[®©™])/g, ''), // 공식몰 제목에 섞인 깨진 글자 (MEGALACEÂ®)
    line: drkshdw.has(p.id) ? 'DRKSHDW' : lilies.has(p.id) ? 'LILIES' : 'RICK OWENS',
    collab: Object.keys(collabs).find((name) => collabs[name].has(p.id)) ?? '',
    runway: runway.has(p.id) || p.tags.includes('RUNWAY PIECES'),
    season: text.match(/\b(SS|FW|PF|RS)\d{2}\b/)?.[0] ?? '',
    group,
    category,
    gender: inMen === inWomen ? 'u' : inMen ? 'm' : 'w', // 둘 다거나 둘 다 아니면(가방·주얼리 등) 공용
    fit: FIT.filter(([re]) => re.test(lower)).map(([, label]) => label),
    details: DETAILS.map((family) => family.find(([re]) => re.test(lower))?.[1]).filter(Boolean),
    sizes: p.variants.map((v) => [v.option1, v.available]),
    price: Math.min(...p.variants.map((v) => Number(v.price))), // 원화
    images: p.images.slice(0, 6).map((i) => i.src.replace(IMG, '')),
    added: (p.published_at ?? p.created_at ?? '').slice(0, 10),
  });
}
// 공식몰이 잠깐 이상하게 응답해도 빈 목록으로 덮어쓰지 않게
if (items.length < 1000) throw new Error(`상품이 ${items.length}개뿐이라 저장하지 않음`);

console.log('다른 판매처 상품 받는 중…');
const { offers: got, failed } = await collect();
// 외화 → 원화. 환율을 못 받으면 그날은 원화 판매처만 비교
let fx = null;
try {
  const { result, rates, time_last_update_utc: at } = await (await fetch('https://open.er-api.com/v6/latest/KRW')).json();
  if (result !== 'success') throw new Error(result);
  fx = { date: new Date(at).toISOString().slice(0, 10) };
  for (const c of ['EUR', 'USD', 'KWD']) fx[c] = Math.round(100 / rates[c]) / 100;
} catch (e) {
  console.log(`환율 못 받음 (${e.message}): 외화 판매처는 빼고 저장`);
}
const offers = got.filter((o) => o.currency === 'KRW' || fx?.[o.currency]);
const krw = (o) => (o.currency === 'KRW' ? o.price : Math.round((o.price * fx[o.currency]) / 100) * 100); // 환산 가격은 100원 단위
// 판매처 한 곳당 한 줄 (같은 상품이 두 번 올라와 있으면 재고 있는 것·싼 것): [판매처, 원화, 주소, 재고 사이즈, 재고 여부, 원래 통화 가격]
const rows = (list) => [...Map.groupBy(list, (o) => o.store).values()]
  .map((g) => g.sort((a, b) => b.stock - a.stock || krw(a) - krw(b))[0])
  .map((o) => [o.store, krw(o), o.url, o.sizes, o.stock ? 1 : 0, o.currency === 'KRW' ? 0 : o.price]);

const { matched, extra, unsure } = match(items, offers);
for (const it of items) if (matched.has(it.id)) it.offers = rows(matched.get(it.id));

// 공식몰에 없는 상품(지난 시즌 등): 이름·사진·분류는 판매처 정보로. 이름은 이 순서로 정돈된 곳 것을 씀
const PREFER = ['lncc', 'end', 'antonioli', 'amamaniere', 'baseblu', 'svrn', 'dsm-ny', 'dsm-london', 'gate194', 'atelier', 'hirshleifers', 'thahab', 'nugnes', 'grifo210', 'wiberlux'];
const taken = new Set(items.map((it) => it.id));
for (const group of extra) {
  group.sort((a, b) => PREFER.indexOf(a.store) - PREFER.indexOf(b.store));
  const [o] = group;
  const fabric = group.map((x) => x.fabric).sort((a, b) => b.length - a.length)[0];
  const color = group.find((x) => x.color)?.color ?? '';
  let id = `${o.code}${fabric}${color || o.glued}`.toLowerCase(); // 공식몰과 같은 형식 (품번+원단+색상)
  while (taken.has(id)) id += '-';
  taken.add(id);
  const [kind, category] = kindOf(group.map((x) => x.kind).join(' '));
  items.push({
    id,
    code: o.code,
    fabric,
    color,
    // 'Rick Owens - Men's Concordian Coat - (Black)', 'HIGH CUT SNEAKER (MENS)' → 'CONCORDIAN COAT', 'HIGH CUT SNEAKER'
    name: o.name.replace(/^rick owens( drkshdw| lilies)?\s*-?\s*/i, '').replace(/^(wo)?men'?s?\s+/i, '').replace(/\s*-\s*\([^)]*\)\s*$|\s*\((wo)?mens?\)\s*$/i, '').replace(/^릭오웬스\s*/, '').trim().toUpperCase(),
    ...fromCode(o.code),
    runway: false,
    group: kind,
    category,
    gender: { RU: 'm', RR: 'm', DU: 'm', RP: 'w', RO: 'w', DS: 'w' }[o.code.slice(0, 2)] ?? group.find((x) => x.gender)?.gender ?? 'u',
    fit: [],
    details: [],
    sizes: [...new Set(group.filter((x) => x.stock).flatMap((x) => x.sizes))].map((s) => [s, true]),
    price: Math.min(...group.map(krw)),
    images: [...new Set(group.map((x) => x.image).filter(Boolean))].slice(0, 4),
    added: '',
    ext: 1,
    offers: rows(group),
  });
}
const linked = Map.groupBy([...matched.values()].flat(), (o) => o.store);

// 상품 하나당 한 줄: 깃허브에서 날마다 바뀐 상품만 diff로 보임
const head = {
  updated: new Date().toISOString(), base: BASE, img: IMG, fx, failed,
  stores: STORES.map(({ id, name, where, currency, home }) => ({ id, name, where, currency, home,
    count: offers.filter((o) => o.store === id).length, matched: linked.get(id)?.length ?? 0 })),
  unsupported: UNSUPPORTED,
  excluded: EXCLUDED,
};
writeFileSync(new URL('public/data.js', import.meta.url),
  `window.RO_DATA = ${JSON.stringify(head).slice(0, -1)},"items":[\n${items.map((it) => JSON.stringify(it)).join(',\n')}\n]};\n`);
const count = (key) => Object.entries(items.reduce((m, it) => ((m[it[key]] = (m[it[key]] ?? 0) + 1), m), {}));
console.log(`저장: public/data.js · ${items.length}개 (판매처 전용 ${extra.length}개)`, JSON.stringify({ gender: count('gender'), group: count('group'), line: count('line'), season: count('season') }));
console.log('판매처별 공식몰 상품 연결:', head.stores.map((s) => `${s.name} ${s.matched}/${s.count}`).join(' · '), `· 못 정해서 뺌 ${unsure.length}`, failed.length ? `· 실패 ${failed.join(', ')}` : '');
