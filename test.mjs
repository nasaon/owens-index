// 판매처 품번 읽기·매칭 자체 점검: node test.mjs
import assert from 'node:assert/strict';
import { offersFor, sizeKey } from './bot.mjs';
import { bestPrice, track } from './publish.mjs';
import { cleanSize, fromCode, kindOf, match, normColor, parseSku } from './stores.mjs';

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

// 공식몰에 없는 상품의 분류·시즌
assert.deepEqual(kindOf("Men's Jeans Bolan Bootcut Jeans"), ['bottoms', '하의']);
assert.deepEqual(kindOf('RICK OWENS, 남성 스니커즈, RU02F4891 LCO 911'), ['shoes', '신발']);
assert.deepEqual(kindOf('Jackets Hooded Outershirt'), ['outer', '아우터']);
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
console.log('자체 점검 통과');
