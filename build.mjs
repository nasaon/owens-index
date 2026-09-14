// 릭오웬스 공식몰(rickowens.eu) 상품을 받아 사이트용 public/data.js로 저장: node build.mjs
import { writeFileSync } from 'node:fs';

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

// 상품 하나당 한 줄: 깃허브에서 날마다 바뀐 상품만 diff로 보임
const head = { updated: new Date().toISOString(), base: BASE, img: IMG };
writeFileSync(new URL('public/data.js', import.meta.url),
  `window.RO_DATA = ${JSON.stringify(head).slice(0, -1)},"items":[\n${items.map((it) => JSON.stringify(it)).join(',\n')}\n]};\n`);
const count = (key) => Object.entries(items.reduce((m, it) => ((m[it[key]] = (m[it[key]] ?? 0) + 1), m), {}));
console.log(`저장: public/data.js · ${items.length}개`, JSON.stringify({ gender: count('gender'), group: count('group'), line: count('line'), season: count('season') }));
