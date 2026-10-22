// 판매처 품번 읽기·매칭 자체 점검: node test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { offersFor, sizeKey } from './bot.mjs';
import { onRequestPost } from './functions/api/places.js';
import { onRequestPost as feedback } from './functions/api/feedback.js';
import { bestPrice, keepAdded, track } from './publish.mjs';
import { cleanSize, fetchRetry, fromCode, kindOf, match, normColor, parseSku, shipsOnlyTo } from './stores.mjs';

// 판매처마다 다른 품번 표기
const sku = (s) => { const p = parseSku(s); return p && [p.code, p.fabric, p.color, p.glued].join('|'); };
assert.equal(sku('Supplier SKU:RU02F4941 WBD 9-BLACK'), 'RU02F4941|WBD|9|'); // DSM 뉴욕
assert.equal(sku('details_Italy|100% Cow Leather|RU02F4892LCOW2 911'), 'RU02F4892|LCOW2|911|'); // Antonioli
assert.equal(sku('RO1USH-RU02F4890-LBB-911 BLACK/MILK-8'), 'RU02F4890|LBB|911|'); // Hirshleifer's
assert.equal(sku('RG0000008-GTSVLT-3636D-OS'), 'RG0000008|GTSVLT|3636D|'); // SVRN 아이웨어
assert.equal(sku('SKU: RU02F4722NPD109'), 'RU02F4722|||NPD109'); // Nugnes: 원단+색상이 붙음
assert.equal(sku('RP02F5702MU09_BLACK_70376501'), 'RP02F5702|||MU09'); // THAHAB
assert.equal(sku('desc2:RO02F5782'), 'RO02F5782|||'); // DSM 런던: 품번만
assert.equal(parseSku('2000012286506'), null);
assert.deepEqual(['09', '0909', '0911', '911'].map(normColor), ['9', '909', '911', '911']);
assert.deepEqual(['Size EU 52', 'wshoeseu_EU 36', 'wrtwstd_S', '40-구매가능(당일발송)', '39.5', 'Default Title'].map(cleanSize), ['52', '36', 'S', '40', '39½', 'UNI']);
assert.deepEqual(['Size OS', 'Size US L', 'Size 31', '6,5', undefined, 'O/S'].map(cleanSize), ['UNI', 'L', '31', '6½', 'UNI', 'UNI']);
assert.deepEqual(['2X', 'LGE', 'IT 50 / US 32', '41 | 8', '50-52', 'MENS 9', 'WOMENS 8½', 'MENS 9,5'].map(cleanSize), ['XXL', 'L', '50', '41', '50-52', '42', '38½', '42½']);
assert.deepEqual(['UK 6(約25cm相当)', '41(約26cm相当)'].map(cleanSize), ['6', '41']); // amanojak.
assert.deepEqual(['UK8(270)', 'UK9.5(285)', 'UK7', '6.5 UK M', '420', '365', '-', 'FREE'].map(cleanSize), ['8', '9½', '7', '6½', '42', '36½', 'UNI', 'UNI']); // mou·082+·MIDWEST

// 공식몰에 없는 상품의 분류·시즌
assert.deepEqual(kindOf("Men's Jeans Bolan Bootcut Jeans"), ['bottoms', '하의']);
assert.deepEqual(kindOf('RICK OWENS, 남성 스니커즈, RU02F4891 LCO 911'), ['shoes', '신발']);
assert.deepEqual(kindOf('Jackets Hooded Outershirt'), ['outer', '아우터']);
assert.deepEqual(['CARGO JKT', 'SECCHIA FLIGHT', 'MASTODON TRENCH', 'ACCESORIES PYRAMID CHARM', 'KEY HOLDER BIG PENTAGRAM'].map((t) => kindOf(t)[0]), ['outer', 'outer', 'outer', 'acc', 'acc']);
assert.deepEqual(fromCode('DU01E6274'), { season: 'SS25', line: 'DRKSHDW', collab: '' });
assert.deepEqual(fromCode('RU17S1234'), { season: 'SS17', line: 'RICK OWENS', collab: '' });
assert.deepEqual(fromCode('DM02F1814'), { season: 'FW26', line: 'RICK OWENS', collab: 'Dr. Martens' });

// 매칭: 색상 표기 차이, 같은 품번·색상의 원단 차이, 붙은 표기, 이름만 있는 곳
const item = (id, code, color) => ({ id, code, color });
const items = [item('ru02f4372te09', 'RU02F4372', '09'), item('ru02f4372wwh09', 'RU02F4372', '09'), item('rr02f4219hflbe10909', 'RR02F4219', '0909'), item('ru02f4722npd109', 'RU02F4722', '09')];
const offer = (store, text, colorName = '') => ({ store, ...parseSku(text), colorName });
const { matched, extra, unsure } = match(items, [
  offer('svrn', 'RU02F4372-WWH-09-30'),
  offer('dsm-ny', 'RR02F4219 HFLBE1 909-BLACK', 'BLACK'),
  offer('dsm-ny', 'RU02F4372 TE 9-BLACK', 'BLACK'),
  offer('nugnes', 'RU02F4722NPD109'),
  offer('dsm-london', 'desc2:RU02F4372', 'Black'), // 검정이 9·909 둘 다라 색상을 못 정하고, 공식몰엔 원단 두 개 → 뺌
  offer('dsm-ny', 'RU02F4372 TE 34-DUST', 'DUST'), // 공식몰에 없는 색상 → 새 상품
  offer('dsm-london', 'desc2:RU02F4372', 'Dust'), // 이름으로 34를 찾아 위와 같은 상품으로 묶임
  offer('antonioli', 'RU02F4722MOR 09'), // 품번·색상은 같아도 원단(MOR ≠ NPD1)이 다르면 다른 상품
]);
assert.deepEqual([...matched].map(([id, os]) => [id, os.map((o) => o.store)]), [
  ['ru02f4372wwh09', ['svrn']], ['rr02f4219hflbe10909', ['dsm-ny']], ['ru02f4372te09', ['dsm-ny']], ['ru02f4722npd109', ['nugnes']],
]);
assert.deepEqual(unsure.map((o) => o.store), ['dsm-london']);
assert.deepEqual(extra.map((g) => g.map((o) => o.store)), [['dsm-ny', 'dsm-london'], ['antonioli']]);
// 품번 뒤가 원단뿐이고 색상 이름도 못 맞춘 곳(MACHINE-A·amanojak.): 원단까지 같은 공식몰 상품이 여럿이면 어느 색인지 몰라 빼고, 원단이 다르면 새 상품, 후보가 하나면 붙임
const fabricOnly = (store, code, fabric) => ({ store, code, fabric, color: '', glued: '', colorName: '' });
const loose = match(items, [fabricOnly('machine-a', 'RU02F4372', 'TE'), fabricOnly('amanojak', 'RU02F4372', 'XYZ'), fabricOnly('amanojak', 'RR02F4219', 'HFLBE1')]);
assert.deepEqual([loose.unsure.map((o) => o.fabric), loose.extra.map((g) => g[0].fabric), [...loose.matched.keys()]], [['TE'], ['XYZ'], ['rr02f4219hflbe10909']]);

// 관심 상품 알림: 사이즈 글자 → 텔레그램 링크용, 그 사이즈 재고가 있는 곳만 싼 순 (사이즈를 안 알려주는 곳은 따로)
assert.deepEqual(['39½', 'MENS 9', '50 / US 32', 'UNI'].map(sizeKey), ['39h', 'MENS-9', '50-US-32', 'UNI']);
const watched = { id: 'a', price: 100, sizes: [['48', true], ['50', false]], offers: [['svrn', 90, 'u1', ['50'], 1, 0], ['end', 80, 'u2', [], 1, 0], ['lncc', 70, 'u3', ['50'], 0, 45]] };
const at50 = offersFor({ base: 'https://x' }, watched, '50');
assert.deepEqual([at50.hit.map((r) => r.store), at50.maybe.map((r) => r.store)], [['svrn'], ['end']]);
assert.deepEqual(offersFor({ base: 'https://x' }, watched, 'all').hit.map((r) => r.store), ['end', 'svrn', 'official']);

// 최저가 기록: 1% 안쪽 변동은 무시, 5% 넘게 내리면 가격 내림, 같은 날 다시 돌리면 그날 값을 고침, 14일 창 직전 가격도 기준
assert.equal(bestPrice(watched), 80);
const priced = (id, price) => ({ id, price, sizes: [['M', true]] });
let tracked = track({}, [priced('a', 1000), priced('b', 1000)], '2026-09-10');
tracked = track(tracked.next, [priced('a', 995), priced('b', 930)], '2026-09-11');
assert.deepEqual([tracked.next.a.length, tracked.next.b.length, [...tracked.drops]], [1, 2, [['b', ['2026-09-10', 1000]]]]);
assert.deepEqual([...track(tracked.next, [priced('a', 995), priced('b', 1000)], '2026-09-11').drops], []);
assert.deepEqual([...track({ c: [['2026-09-01', 1000]] }, [priced('c', 900)], '2026-09-21').drops], [['c', ['2026-09-01', 1000]]]);
// 등록일: 전날 날짜가 더 이르면 유지 (다시 올린 상품이 NEW로 뜨지 않게), 전날 없던 상품·날짜를 몰랐던 상품은 오늘 값
const today = [{ id: 'a', added: '2026-10-20' }, { id: 'b', added: '2026-10-20' }, { id: 'c', added: '2026-09-01' }];
keepAdded([{ id: 'a', added: '2026-06-12' }, { id: 'c', added: '' }], today);
assert.deepEqual(today.map((it) => it.added), ['2026-06-12', '2026-10-20', '2026-09-01']);

// 다시 받기: 429·연결 실패 뒤 성공하면 그 응답, 404는 바로, 끝까지 5xx면 마지막 응답 그대로 (쉬는 시간 0초로 시험)
const replies = (...list) => { globalThis.fetch = async () => { const r = list.shift(); if (r instanceof Error) throw r; return new Response('', { status: r }); }; };
replies(429, new Error('fetch failed'), 200);
assert.equal((await fetchRetry('https://x', {}, [0, 0, 0])).status, 200);
replies(404, 200);
assert.equal((await fetchRetry('https://x', {}, [0, 0, 0])).status, 404);
replies(503, 502, 500);
assert.equal((await fetchRetry('https://x', {}, [0, 0])).status, 500);

// 배대지 필요: meta.json 배송 국가에 KR이 없을 때만 그 나라 목록, Shopify가 아니면(HTML) 배송하는 것으로
const meta = (body) => { globalThis.fetch = async () => new Response(body); };
meta('{"ships_to_countries":["JP"]}');
assert.deepEqual(await shipsOnlyTo('https://x/collections/a'), ['JP']);
meta('{"ships_to_countries":["JP","KR"]}');
assert.equal(await shipsOnlyTo('https://x'), null);
meta('<html>');
assert.equal(await shipsOnlyTo('https://x'), null);

// 사이즈 변환(public/size.js): 한국 사이즈 → 상품 표기(허리가 공식표 사이 값이면 양옆 둘 다), 상품 표기 → 한국
const size = new Function(`${readFileSync(new URL('./public/size.js', import.meta.url), 'utf8')}; return { labelsFor, korean };`)();
assert.deepEqual([...size.labelsFor('m', 'top', ['95'])], ['48', 'S']);
assert.deepEqual([...size.labelsFor('w', 'top', ['95'])], ['42', 'M']);
assert.deepEqual([...size.labelsFor('m', 'bottom', ['31'])], ['48', 'S', '30', '50', 'M', '32', '31']);
assert.deepEqual([...size.labelsFor('w', 'bottom', ['38'])], []); // 여성 공식표 밖, 릭오웬스 38(XS)로 착각하면 안 됨
assert.deepEqual(['48', 'M', '31', 'UNI'].map((z) => size.korean('m', 'bottom', z)), ['30', '32', '31', '']);
assert.deepEqual(['40', 'XS', '48', '42/44'].map((z) => size.korean('w', 'top', z)), ['55', '44', '110', '']);

// 매장 제보 API: 이상한 입력은 거르고, 봇 칸은 저장 없이 성공인 척, 종류·링크는 허용된 값만
const saved = [];
const env = { REVIEW_SECRET: 's', DB: { prepare: () => ({ bind: (...row) => ({ first: async () => ({ mine: 0 }), run: async () => (saved.push(row), { meta: { last_row_id: 1 } }) }), first: async () => ({ waiting: 0 }) }) } };
globalThis.fetch = async () => new Response('{}'); // 텔레그램 알림은 보내지 않음
const post = async (body) => (await onRequestPost({ request: new Request('https://x/api/places', { method: 'POST', body: JSON.stringify(body) }), env })).status;
const shop = { name: '매장', city: '서울', lat: 37.5, lng: 127 };
assert.deepEqual(await Promise.all([null, { ...shop, lat: 'x' }, { ...shop, name: ' ' }].map(post)), [400, 400, 400]);
assert.equal(await post({ ...shop, website: 'spam' }), 201);
assert.equal(saved.length, 0);
assert.equal(await post({ ...shop, kind: 'toString', url: 'javascript:alert(1)' }), 201);
assert.deepEqual([saved[0][1], saved[0][7]], ['other', '']);

// 요청사항 API: 빈 내용은 거르고, 봇 칸은 저장 없이 성공인 척, 줄바꿈은 살리고 1000자에서 자름
const ask = async (body) => (await feedback({ request: new Request('https://x/api/feedback', { method: 'POST', body: JSON.stringify(body) }), env })).status;
saved.length = 0;
assert.deepEqual(await Promise.all([null, { text: ' ' }, { text: 1 }].map(ask)), [400, 400, 400]);
assert.equal(await ask({ text: '판매처 추가해 주세요', website: 'spam' }), 201);
assert.equal(saved.length, 0);
assert.equal(await ask({ text: ` 첫 줄\n둘째 줄${'가'.repeat(2000)}`, contact: ' @me  ' }), 201);
assert.deepEqual([saved[0][0].slice(0, 8), saved[0][0].length, saved[0][1]], ['첫 줄\n둘째 줄', 1000, '@me']);
console.log('자체 점검 통과');
