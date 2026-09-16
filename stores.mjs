// 공식몰 말고 릭오웬스를 파는 판매처의 상품을 받아 공식몰 상품과 품번·색상으로 묶음: build.mjs가 씀
// 지원 기준: 봇 확인 화면 없이 열리고, robots.txt가 막지 않고, 품번이 있어 같은 상품인지 확정할 수 있는 곳
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  // localization=KR: Shopify 판매처는 한국 마켓(원화·한국 배송 상품)으로 보여줌
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8', cookie: 'localization=KR' } });
  if (!res.ok) throw new Error(`${new URL(url).host} HTTP ${res.status}`);
  await sleep(500); // 판매처에 부담 주지 않게 요청 간격
  return res;
}

// 품번(RU02F4941) 뒤의 원단·색상. 판매처마다 'RU02F4941 WBD 9-BLACK', 'RU02F4892LCOW2 911', 'RU02F4722NPD109'처럼 달라서
// 품번 뒤 두 번째 조각이 숫자로 시작하면 첫 조각이 원단·두 번째가 색상, 아니면 첫 조각에 원단+색상이 붙어 있음(glued)
export function parseSku(text) {
  const s = String(text ?? '').toUpperCase();
  const m = s.match(/[A-Z]{2}(?:\d{2}[A-Z]|\d{3})\d{4}/);
  if (!m) return null;
  const [first = '', second = ''] = s.slice(m.index + m[0].length).split(/[\s._\-/|,+]+/).filter(Boolean);
  return /^\d{1,5}[A-Z]{0,3}$/.test(second) ? { code: m[0], fabric: first, color: second, glued: '' } : { code: m[0], fabric: '', color: '', glued: first };
}

// 같은 색상 표기 차이 맞추기: 앞자리 0을 빼고 적는 곳이 있음 (09 = 9, 0909 = 909)
export const normColor = (c) => String(c).toUpperCase().replace(/^0+(?=.)/, '');
// 색상 이름 표기 차이 맞추기: 모음을 빼고 비교 (DRKPEARL = Dark Pearl)
const cleanName = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z]/g, '').replace(/[AEIOU]/g, '');

// 사이즈 표기 정리: 'Size EU 52' → 52, 'Size US L' → L, 'wshoeseu_EU 36' → 36, '40-구매가능(당일발송)' → 40, 39.5·6,5 → 39½·6½ (공식몰 표기)
export function cleanSize(s) {
  const t = String(s ?? '').replace(/^[a-z]+_/, '').replace(/^size\s+/i, '').replace(/^(EU|IT|FR|UK)\s+|^US\s+(?=(X{0,2}S|M|X{0,3}L)$)/i, '').replace(/-.*$/, '').trim();
  return /^(default title|os|one ?size|o\/s|uni|tu)?$/i.test(t) ? 'UNI' : t.replace(/[.,]5$/, '½'); // 사이즈 없음 = 원사이즈
}

// 공식몰에 없는 상품의 분류 (판매처 상품 종류 + 이름, 영어·한국어)
const KINDS = [
  ['shoes', '신발', /\b(sneak\w*|boots?|shoes?|sandals?|slides?|slippers?|loafers?|derby|mules?|geobasket|ramones|creepers?|footwear|trainers?)\b|스니커즈|부츠|신발|샌들|슬리퍼|로퍼/i],
  ['acc', '가방', /\b(bags?|pouch|totes?|backpacks?|clutch|wallets?)\b|가방|파우치|지갑|백팩/i],
  ['acc', '액세서리', /\b(belts?|hats?|caps?|beanies?|gloves?|scarf|scarves|socks?|rings?|necklaces?|bracelets?|earrings?|jewel\w*|eyewear|sunglasses|glasses|masks?|keychains?|accessor\w*)\b|벨트|모자|캡|비니|장갑|스카프|머플러|양말|반지|목걸이|팔찌|귀걸이|선글라스|안경|주얼리/i],
  ['outer', '아우터', /\b(jackets?|coats?|bombers?|parkas?|blazers?|vests?|gilets?|outerwear|anorak|peacoat)\b|재킷|자켓|코트|점퍼|패딩|베스트|블레이저|아우터/i],
  ['dress', '드레스', /\b(dress(es)?|gowns?)\b|드레스|원피스/i],
  ['bottoms', '하의', /\b(pants?|trousers?|jeans?|denim|shorts?|skirts?|leggings?|cargos?|joggers?|bottoms?)\b|팬츠|바지|청바지|데님|쇼츠|반바지|스커트|레깅스|조거/i],
  ['tops', '상의', /\b(t-?shirts?|tees?|shirts?|tops?|tanks?|hood(ie|ed)?s?|sweat\w*|knit\w*|sweaters?|cardigans?|polos?|jumpers?|pullovers?|longsleeve|level)\b|티셔츠|셔츠|탑|후드|스웻|맨투맨|니트|스웨터|가디건/i],
];
export const kindOf = (text) => KINDS.find(([, , re]) => re.test(text))?.slice(0, 2) ?? ['etc', '기타'];

// 품번으로 시즌·라인: 02F = FW26 (01 SS·02 FW, 글자는 A=2021), 옛 형식 17S = SS17
export function fromCode(code) {
  const [, prefix, a, b] = code.match(/^([A-Z]{2})(\d{2})([A-Z])/) ?? [];
  if (!prefix) return { season: '', line: 'RICK OWENS', collab: '' };
  const season = a === '01' || a === '02' ? `${a === '01' ? 'SS' : 'FW'}${21 + b.charCodeAt(0) - 65}` : b === 'S' || b === 'F' ? `${b === 'S' ? 'SS' : 'FW'}${a}` : '';
  const collab = { DM: 'Dr. Martens', DW: 'Dr. Martens', MU: 'Moncler' }[prefix] ?? '';
  return { season, line: prefix === 'LI' ? 'LILIES' : /^D[USAL]$/.test(prefix) ? 'DRKSHDW' : 'RICK OWENS', collab };
}

// Shopify 판매처: 컬렉션의 products.json을 전부 받아 상품(색상별) 목록으로
async function shopify(base, handles, read) {
  const seen = new Map();
  for (const handle of handles) {
    for (let page = 1; ; page++) {
      const { products } = await (await get(`${base}/collections/${handle}/products.json?limit=250&page=${page}`)).json();
      if (!products.length) break;
      for (const p of products) seen.set(p.id, { ...p, collection: handle });
    }
  }
  const out = [];
  for (const p of seen.values()) {
    const i = p.options.findIndex((o) => /size|사이즈/i.test(o.name));
    const groups = new Map(); // 한 상품에 색상이 여러 개면 색상별로 나눔
    for (const v of p.variants) {
      const info = read(p, v);
      const parsed = info && parseSku(info.sku);
      if (!parsed) continue;
      const key = parsed.color || parsed.glued;
      if (!groups.has(key)) groups.set(key, { ...parsed, colorName: info.colorName ?? '', variants: [] });
      groups.get(key).variants.push(v);
    }
    for (const { variants, ...g } of groups.values()) {
      const live = variants.filter((v) => v.available);
      out.push({
        ...g,
        name: p.title,
        kind: `${p.product_type} ${p.title}`,
        gender: /\b(wom[ae]n'?s?|femme|donna)\b/i.test(`${p.title} ${p.product_type} ${p.tags.join(' ')} ${p.collection}`) ? 'w'
          : /\b(m[ae]n'?s?|uomo|homme)\b/i.test(`${p.title} ${p.product_type} ${p.tags.join(' ')} ${p.collection}`) ? 'm' : '',
        price: Math.min(...(live.length ? live : variants).map((v) => Number(v.price))),
        url: `${base}/products/${p.handle}`,
        sizes: live.map((v) => cleanSize(i >= 0 ? v[`option${i + 1}`] : v.title)),
        image: p.images[0]?.src ?? '',
      });
    }
  }
  return out;
}

// LN-CC (Salesforce): 목록 HTML 안에 상품 JSON이 들어 있음. 한 쪽에 24개
async function lncc() {
  const out = [];
  for (const gender of ['men', 'women']) {
    for (let page = 1, total = Infinity; (page - 1) * 24 < total; page++) {
      let result;
      // 가끔 2쪽 이후를 요청해도 1쪽 내용이 와서, 요청한 쪽이 올 때까지 두 번 더 받음
      for (let tries = 0; !result?.pages?.[page]; tries++) {
        if (tries === 3) throw new Error(`LN-CC ${gender} ${page}쪽을 못 받음`);
        if (tries) await sleep(3000);
        const html = await (await get(`https://www.ln-cc.com/en-kr/brands/${gender}/rick-owens/?page=${page}`)).text();
        const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('"productSearchResult"'));
        result = script && Object.values(JSON.parse(script).__PRELOADED_STATE__.__STATE_MANAGEMENT_LIBRARY.reduxStoreState.productSearchResult)[0];
      }
      total = result.total;
      for (const p of result.pages[page]) {
        const parsed = parseSku(p.representedProduct?.c_extendedMfvc);
        if (!parsed) continue;
        const url = p.c_url.replace('ln-cc.com/en/', 'ln-cc.com/en-kr/');
        let price = p.price;
        // 목록에 가격이 빠진 상품이 절반쯤 있음 → 재고 있는 것만 상품 페이지의 가격 정보(JSON-LD)에서
        if (price === undefined && p.orderable) price = Number((await (await get(url)).text()).match(/"@type":"Offer"[^}]*?"price":"([\d.]+)"/)?.[1]);
        out.push({
          ...parsed,
          colorName: p.representedProduct.c_colorDescription ?? '',
          name: p.productName,
          kind: `${p.representedProduct.c_categoryId} ${p.productName}`,
          gender: gender === 'men' ? 'm' : 'w',
          currency: p.currency,
          price,
          url,
          sizes: p.variants.filter((v) => v.orderable).map((v) => cleanSize(v.variationValues?.size)),
          image: p.image?.disBaseLink ?? '',
        });
      }
    }
  }
  return out;
}

// END.: 목록 페이지 안의 검색 결과 JSON(120개씩). 사이즈별 재고는 목록에 없어 재고 수량만 씀
async function end() {
  const out = [];
  for (let page = 1; ; page++) {
    const html = await (await get(`https://www.endclothing.com/kr/brands/rick-owens?page=${page}`)).text();
    const next = JSON.parse(html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    const { results } = findKey(next, 'initialAlgoliaState') ?? {};
    for (const h of results?.hits ?? []) {
      const parsed = parseSku(h.sku);
      if (!parsed || !h.final_price_12) continue;
      out.push({
        ...parsed,
        colorName: h.actual_colour ?? '',
        name: h.name,
        kind: `${(h.department_hierarchy ?? []).join(' ')} ${h.name}`,
        gender: h.menswear && !h.womenswear ? 'm' : h.womenswear && !h.menswear ? 'w' : '',
        price: h.final_price_12, // 12번 = 한국 사이트 원화 가격
        url: `https://www.endclothing.com/kr/${h.url_key}.html`,
        sizes: [],
        stock: h.stock > 0,
        image: h.small_image ? `https://media.endclothing.com/media/f_auto,q_auto:eco,w_600/prodmedia/media/catalog/product${h.small_image}` : '',
      });
    }
    if (!results || page >= results.nbPages) break;
  }
  return out;
}
const findKey = (o, key) => (o && typeof o === 'object' ? (key in o ? o[key] : Object.values(o).reduce((r, v) => r ?? findKey(v, key), undefined)) : undefined);

// 위버럭스 (카페24): 목록에서 품번·가격, 상품 상세의 option_stock_data에서 사이즈별 재고
async function wiberlux() {
  const list = [];
  for (let page = 1; ; page++) {
    const html = await (await get(`https://wiberlux.com/category/rick-owens/4934/?page=${page}`)).text();
    const boxes = html.split(/<li id="anchorBoxId_/).slice(1);
    for (const li of boxes) {
      const parsed = parseSku(li.match(/class="model_name">([^<]*)</)?.[1]);
      if (parsed) list.push({ ...parsed, no: li.match(/^\d+/)[0], name: li.match(/<span class="" style="[^"]*">([^<]*)</)?.[1] ?? '', image: li.match(/<img src="([^"]+)"[^>]*class="thumb"/)?.[1] ?? '' });
    }
    if (boxes.length < 60) break;
  }
  const out = [];
  for (const { no, image, ...p } of list) {
    const html = await (await get(`https://wiberlux.com/product/detail.html?product_no=${no}`)).text();
    const keywords = html.match(/name="keywords" content="([^"]*)"/)?.[1] ?? ''; // 'RICK OWENS, 남성 스니커즈, RU02F4891 LCO 911'
    const raw = html.match(/option_stock_data\s*=\s*'([^']*)'/)?.[1];
    const options = raw ? Object.values(JSON.parse(JSON.parse(`"${raw}"`))) : [];
    const live = options.filter((o) => o.is_selling === 'T' && o.is_auto_soldout !== 'T');
    const price = Math.min(...(live.length ? live : options).map((o) => o.option_price));
    if (!Number.isFinite(price)) continue;
    out.push({
      ...p,
      colorName: '',
      kind: `${keywords} ${p.name}`,
      gender: /남성/.test(keywords + p.name) ? 'm' : /여성/.test(keywords + p.name) ? 'w' : '',
      price,
      url: `https://wiberlux.com/product/detail.html?product_no=${no}`,
      sizes: live.map((o) => cleanSize(o.option_value)),
      image: image.startsWith('//') ? `https:${image}` : image,
    });
  }
  return out;
}

// 지원 판매처. currency가 원화가 아니면 환율로 바꿔 보여줌
export const STORES = [
  { id: 'dsm-ny', name: 'Dover Street Market 뉴욕', where: '미국', currency: 'KRW', home: 'https://shop-us.doverstreetmarket.com/collections/rick-owens',
    collect: () => shopify('https://shop-us.doverstreetmarket.com', ['rick-owens'], (p) => {
      const tag = p.tags.find((t) => t.startsWith('Supplier SKU:')); // 'Supplier SKU:RU02F4941 WBD 9-BLACK'
      return tag && { sku: tag, colorName: tag.split('-').pop() };
    }) },
  { id: 'dsm-london', name: 'Dover Street Market 런던', where: '영국', currency: 'KRW', home: 'https://shop.doverstreetmarket.com/collections/rick-owens',
    // 품번만 있고 색상 코드가 없어서 제목의 '(Black)'으로 색상을 맞춤
    collect: () => shopify('https://shop.doverstreetmarket.com', ['rick-owens'], (p) => ({
      sku: p.tags.find((t) => t.startsWith('desc2:')) ?? p.body_html?.match(/Style Code:\s*(\S+)/)?.[1],
      colorName: p.title.match(/\(([^)]+)\)\s*$/)?.[1],
    })) },
  { id: 'svrn', name: 'SVRN', where: '미국', currency: 'KRW', home: 'https://www.svrn.com/collections/rick-owens',
    collect: () => shopify('https://www.svrn.com', ['rick-owens', 'rick-owens-drkshdw'], (p, v) => ({ sku: v.sku })) },
  { id: 'hirshleifers', name: "Hirshleifer's", where: '미국', currency: 'KRW', home: 'https://www.hirshleifers.com/collections/rick-owens',
    collect: () => shopify('https://www.hirshleifers.com', ['rick-owens', 'drkshdw'], (p, v) => ({ sku: v.sku, colorName: v.sku.match(/\d+ ([A-Z/ ]+)-/)?.[1] })) },
  { id: 'atelier', name: 'Atelier New York', where: '미국', currency: 'USD', home: 'https://www.ateliernewyork.com/collections/rick-owens',
    collect: () => shopify('https://www.ateliernewyork.com', ['rick-owens', 'rick-owens-drkshdw'], (p, v) => ({ sku: v.sku, colorName: v.option1?.replace(/^\S+\s*/, '') })) },
  { id: 'end', name: 'END.', where: '영국', currency: 'KRW', home: 'https://www.endclothing.com/kr/brands/rick-owens', collect: end },
  { id: 'lncc', name: 'LN-CC', where: '영국', currency: 'EUR', home: 'https://www.ln-cc.com/en-kr/brands/men/rick-owens/', collect: lncc },
  { id: 'antonioli', name: 'Antonioli', where: '이탈리아', currency: 'EUR', home: 'https://www.antonioli.eu/collections/designer-rick-owens-man',
    collect: () => shopify('https://www.antonioli.eu', ['designer-rick-owens-man', 'designer-rick-owens-woman'], (p) => ({ sku: p.tags.find((t) => t.startsWith('details_'))?.split('|').pop() })) },
  { id: 'nugnes', name: 'Nugnes 1920', where: '이탈리아', currency: 'EUR', home: 'https://www.nugnes1920.com/collections/rick-owens-man',
    collect: () => shopify('https://www.nugnes1920.com', ['rick-owens-man'], (p) => ({ sku: p.body_html?.match(/SKU:\s*([A-Z0-9]+)/)?.[1] })) },
  { id: 'thahab', name: 'THAHAB', where: '쿠웨이트', currency: 'KWD', home: 'https://www.thahab.com/collections/rick-owens',
    collect: () => shopify('https://www.thahab.com', ['rick-owens', 'rick-owens-drkshdw'], (p, v) => ({ sku: v.sku, colorName: v.sku.match(/[-_]\d+[ _]([A-Za-z ]+)/)?.[1] })) },
  { id: 'amamaniere', name: 'A Ma Maniére', where: '미국', currency: 'USD', home: 'https://www.a-ma-maniere.com/collections/rick-owens',
    collect: () => shopify('https://www.a-ma-maniere.com', ['rick-owens', 'drkshdw'], (p, v) => ({ sku: v.sku })) }, // 'RU02F4360-TB-34'
  { id: 'gate194', name: 'GATE 194', where: '독일', currency: 'EUR', home: 'https://gate194.berlin/collections/rick-owens',
    collect: () => shopify('https://gate194.berlin', ['rick-owens'], (p) => ({ sku: p.tags.find((t) => /[A-Z]{2}\d{2}[A-Z]\d{4}/.test(t)) })) }, // 태그 'DS01F4812 SDBK 999'
  { id: 'baseblu', name: 'Base Blu', where: '이탈리아', currency: 'EUR', home: 'https://www.baseblu.com/collections/rick-owens-man',
    collect: () => shopify('https://www.baseblu.com', ['rick-owens-man', 'rick-owens-woman', 'moncler-rick-owens-man', 'moncler-rick-owens-woman'],
      (p) => ({ sku: p.tags.find((t) => t.startsWith('parent_sku:')) })) }, // 태그 'parent_sku:RU02E1749LBY_09'
  { id: 'grifo210', name: 'Grifo210', where: '이탈리아', currency: 'EUR', home: 'https://www.grifo210.com/collections/men-rick-owens',
    collect: () => shopify('https://www.grifo210.com', ['men-rick-owens', 'women-rick-owens', 'men-rick-owens-drkshdw', 'women-rick-owens-drkshdw', 'men-moncler-rick-owens', 'women-moncler-rick-owens'],
      (p, v) => ({ sku: v.sku?.replace(/-[^-]*$/, '') })) }, // 'RU02F4788NPD309-36' → 끝의 사이즈를 떼고 읽음
  { id: 'wiberlux', name: '위버럭스', where: '한국', currency: 'KRW', home: 'https://wiberlux.com/category/rick-owens/4934/', collect: wiberlux },
];

// 자동으로 가격을 못 가져오는 곳과 이유 (사이트 '판매처' 목록에 그대로 나감)
export const UNSUPPORTED = [
  ['봇 확인 화면으로 자동 접속 차단', [
    ['SSENSE', 'https://www.ssense.com/en-kr/men/designers/rick-owens'], ['MR PORTER', 'https://www.mrporter.com/en-kr/mens/designer/rick-owens'],
    ['NET-A-PORTER', 'https://www.net-a-porter.com/en-kr/shop/designer/rick-owens'], ['Mytheresa', 'https://www.mytheresa.com/kr/en/men/designers/rick-owens'],
    ['YOOX', 'https://www.yoox.com/kr/men/shoponline/rick%20owens_d'], ['LUISAVIAROMA', 'https://www.luisaviaroma.com/en-kr/shop/men/rick-owens'],
    ['24S', 'https://www.24s.com/en-kr/men/rick-owens'], ['Harrods', 'https://www.harrods.com/en-kr/designers/rick-owens'],
    ['Cettire', 'https://www.cettire.com/collections/rick-owens'], ['Vitkac', 'https://www.vitkac.com/kr/men/designers/rick-owens'],
    ['Julian Fashion', 'https://www.julian-fashion.com/en-US/designers/rick-owens'], ['Leam', 'https://www.leam.com/en_us/designers/rick-owens'],
    ['Giglio', 'https://www.giglio.com/en-us/rick-owens-man.html'], ['Saks', 'https://www.saksfifthavenue.com/brand/rick-owens'],
    ['Neiman Marcus', 'https://www.neimanmarcus.com/c/designers-rick-owens-cat000730'],
  ]],
  ['robots.txt로 상품 데이터 수집 금지', [
    ['젠테스토어', 'https://www.jentestore.com/goods/list?brand%5B%5D=0145'], ['신세계V', 'https://m.shinsegaev.com/store/rickowens'],
    ['Selfridges', 'https://www.selfridges.com/KR/en/cat/rick-owens/'], ['바바더', 'https://pc.babathe.com/brand/rickowens'],
  ]],
  ['품번이 없어 같은 상품인지 확정 불가', [
    ['Browns', 'https://www.brownsfashion.com/collections/rick-owens-man'],
    ['페칭 · SSENSE·Mytheresa·YOOX 매물을 원화로 모아 봄', 'https://fetching.co.kr/brand/62'],
  ]],
];
export const EXCLUDED = [
  ['리셀·중고 거래', ['KREAM', 'Grailed', 'StockX', 'GOAT', 'Vestiaire Collective', 'The RealReal']],
  ['상장폐지·파산·폐업', ['Farfetch (2024년 1월 뉴욕증시 상장폐지)', '발란 (2026년 2월 파산 선고)', '캐치패션 (폐업)']],
];

// 판매처별로 받기. 한 곳이 실패해도 나머지는 씀
export async function collect(log = console.log) {
  const offers = [];
  const failed = [];
  for (const store of STORES) {
    try {
      const got = (await store.collect()).filter((o) => o.price > 0); // 가격 0 = 판매처 쪽 가격 미정
      offers.push(...got.map((o) => ({ ...o, store: store.id, currency: o.currency ?? store.currency, stock: o.stock ?? o.sizes.length > 0 })));
      log(`  ${store.name}: ${got.length}개`);
    } catch (e) {
      failed.push(store.id);
      log(`  ${store.name}: 실패 (${e.message})`);
    }
  }
  return { offers, failed };
}

// 판매처 상품을 공식몰 상품에 붙임. 공식몰에 없는 상품은 품번+색상끼리 묶어 새 상품(extra)으로,
// 공식몰에 있는 것 같지만 하나로 못 정한 상품(unsure)은 잘못 붙이지 않게 뺌
// items: 공식몰 상품 (id = 품번+원단+색상 소문자, 예: ru02f4891lco911)
export function match(items, offers) {
  const byCode = Map.groupBy(items, (it) => it.code);
  const fabricOf = (it) => it.id.toUpperCase().slice(it.code.length, it.id.length - it.color.length);
  const sameFabric = (a, b) => Boolean(a && b) && (a.startsWith(b) || b.startsWith(a)); // 원단 약자 차이 (ML = MLCP)
  // 원단+색상이 붙은 글자(NPD109)는 같은 품번에서 알려진 색상 중 끝이 맞는 가장 긴 것으로 나눔 (NPD1 + 09)
  const known = new Map();
  for (const x of [...items, ...offers]) if (x.color) known.set(x.code, (known.get(x.code) ?? new Set()).add(x.color));
  // 색상 이름만 있는 곳(DSM 런던)은 코드와 이름을 같이 주는 판매처에서 배운 이름 → 코드로
  const byName = new Map();
  for (const o of offers) if (o.color && o.colorName) byName.set(cleanName(o.colorName), (byName.get(cleanName(o.colorName)) ?? new Set()).add(normColor(o.color)));
  const list = offers.map((o) => {
    if (o.glued) {
      const c = [...(known.get(o.code) ?? [])].filter((x) => o.glued.endsWith(x)).sort((a, b) => b.length - a.length)[0];
      return c ? { ...o, fabric: o.glued.slice(0, -c.length), color: c, glued: '' } : o;
    }
    const named = !o.color && byName.get(cleanName(o.colorName));
    return named?.size === 1 ? { ...o, color: [...named][0] } : o;
  });

  const matched = new Map();
  const rest = [];
  const unsure = [];
  for (const o of list) {
    const cands = byCode.get(o.code) ?? [];
    let hit = o.color ? cands.filter((it) => normColor(it.color) === normColor(o.color)) : !o.glued && cands.length === 1 ? cands : [];
    // 같은 품번·색상이라도 원단이 다르면 다른 상품 (가죽·나일론 버전 등, 가격도 다름). 원단을 모르는 곳만 원단 없이 판단
    if (o.fabric) hit = hit.filter((it) => sameFabric(fabricOf(it), o.fabric));
    if (hit.length === 1) matched.set(hit[0].id, [...(matched.get(hit[0].id) ?? []), o]);
    else if (hit.length > 1 || (!o.color && !o.fabric && cands.length)) unsure.push(o);
    else rest.push(o);
  }
  // 공식몰에 없는 상품: 품번+색상이 같고 원단이 겹치면 한 상품 (원단을 모르는 곳은 원단이 가장 긴 쪽에 붙임)
  const extra = [];
  for (const group of Map.groupBy(rest, (o) => `${o.code}|${o.color ? normColor(o.color) : o.glued || cleanName(o.colorName)}`).values()) {
    const clusters = [];
    for (const o of group.toSorted((a, b) => b.fabric.length - a.fabric.length)) {
      const cluster = clusters.find((c) => !o.fabric || c.some((x) => sameFabric(x.fabric, o.fabric)));
      if (cluster) cluster.push(o);
      else clusters.push([o]);
    }
    extra.push(...clusters);
  }
  return { matched, extra, unsure };
}
