// 지구본 기본 매장 목록 → public/places.json: node places.mjs
// 좌표는 OpenStreetMap Nominatim에서 (사용 규칙: 1초에 한 번, 사이트 주소를 밝힌 User-Agent). 좌표를 [위도, 경도]로 적은 곳은 검색하지 않음
// 유저가 제보한 매장은 D1(functions/api/places.js)에 따로 쌓임
import { writeFileSync } from 'node:fs';

// kind: official 공식 매장 · dept 백화점 · select 편집샵 · outlet 아울렛 · retailer 판매처 매장. source는 확인한 곳
// 국내 백화점·아울렛은 각 공식 층별 안내(2026-09-17), 일본은 각 매장 공식몰·블로그 또는 패션프레스 취급점 목록에서 릭오웬스 취급을 확인
const OFFICIAL = 'https://www.rickowens.eu/en-kr/pages/stores';
const FP = 'https://www.fashion-press.net/maps';
const MIDWEST = 'https://store-midwest.com/en/collections/rick-owens';
const ESTNATION = 'https://www.estnation.co.jp/item?brand_id=2342';
const NUBIAN = 'https://nubiantokyo.com/en/collections/rick-owens';
const BOLS = 'https://bols.co.jp/collections/rick-owens';
const MOU = 'https://mou.co.jp/collections/rick-owens';
const DEEP = 'https://www.deepinsideinc.com/brand/192/';
const PARK = 'https://www.theparkstore.jp/?mode=cate&cbid=384615&csid=29';
const PLACES = [
  ['Rick Owens Paris', 'official', '파리', '프랑스', '130-133 Galerie de Valois, Jardins du Palais Royal, 75001 Paris', '+33 1 40 20 42 52', '월–토 11:00–19:00, 일 휴무', `${OFFICIAL}/paris`, 'Galerie de Valois, Paris'],
  ['Rick Owens Milan', 'official', '밀라노', '이탈리아', 'Via Monte di Pietà 13, 20121 Milano', '+39 02 4538 6030', '월–토 11:00–19:00', `${OFFICIAL}/milan`, 'Via Monte di Pietà 13, Milano'],
  ['Rick Owens Tokyo', 'official', '도쿄', '일본', '6-5-55 Minami-Aoyama, Minato-ku, Tokyo 107-0062', '+81 3 6805 0036', '매일 12:00–20:00', `${OFFICIAL}/tokyo`, '6-5-55 Minamiaoyama, Minato, Tokyo'],
  ['Rick Owens New York', 'official', '뉴욕', '미국', '30 Howard Street, New York, NY 10013', '+1 212 627 7222', '월–토 11:00–19:00, 일 12:00–18:00', `${OFFICIAL}/new-york`, '30 Howard Street, New York'],
  ['Rick Owens Los Angeles', 'official', '로스앤젤레스', '미국', '819 North La Brea Avenue, Los Angeles, CA 90038', '+1 323 931 4960', '월–토 11:00–18:00, 일 12:00–18:00', `${OFFICIAL}/los-angeles`, '819 North La Brea Avenue, Los Angeles'],
  ['Rick Owens Miami', 'official', '마이애미', '미국', '131 NE 41st Street, Miami, FL 33137', '+1 786 703 2950', '월–토 11:00–19:00, 일 12:00–18:00', `${OFFICIAL}/miami`, '131 Northeast 41st Street, Miami'],
  ['Rick Owens Las Vegas', 'official', '라스베이거스', '미국', 'Fontainebleau, 2777 S. Las Vegas Blvd, Las Vegas, NV 89109', '+1 725-213-6773', '일–목 10:00–21:00, 금·토 10:00–22:00', `${OFFICIAL}/las-vegas`, 'Fontainebleau Las Vegas'],
  ['Rick Owens Hong Kong', 'official', '홍콩', '홍콩', 'Shop 7, 10 Ice House Street, Central, Hong Kong', '+852 2869 7707', '매일 11:00–20:00', `${OFFICIAL}/hong-kong`, '10 Ice House Street, Central, Hong Kong'],
  ['Rick Owens Shenzhen', 'official', '선전', '중국', 'Store L105, Shenzhen Luohu MixC Phase 1, 1881 Baoan Road South', '', '일–목 10:00–22:00, 금·토 10:00–22:30', `${OFFICIAL}/shenzen`, 'MixC, Luohu, Shenzhen'],
  ['Rick Owens Dubai', 'official', '두바이', '아랍에미리트', 'FF-053, First Floor, The Fashion Avenue, The Dubai Mall', '+971 52 419 8485', '월–목 10:00–23:00, 금–일 10:00–24:00', `${OFFICIAL}/dubai`, 'The Dubai Mall'],
  ['Rick Owens Berlin', 'official', '베를린', '독일', 'Schlüterstraße 45, 10707 Berlin', '+49 30 20679745', '월–토 11:00–19:00, 일 휴무', `${OFFICIAL}/berlin`, 'Schlüterstraße 45, Berlin'],
  ['Rick Owens Ibiza Gallery', 'official', '이비사', '스페인', "Playa d'en Bossa 10 (Slot L09), 07817 Sant Jordi de ses Salines", '+34 629 63 56 10', '', `${OFFICIAL}/ibiza`, "Platja d'en Bossa, Ibiza"],

  // 한국: 신세계·현대는 전 점포 층별 안내를 훑어서 이곳뿐, 갤러리아는 브랜드 안내, 롯데는 부산본점 에비뉴엘 층별 안내, 신세계사이먼은 파주·부산·시흥·제주엔 없음
  ['신세계백화점 본점', 'dept', '서울', '한국', '서울 중구 소공로 63 · 디 에스테이트 3층', '02-310-5275', '', 'https://www.shinsegae.com/store/floor.do?storeCd=SC00001', '서울 중구 소공로 63'],
  ['신세계백화점 강남점', 'dept', '서울', '한국', '서울 서초구 신반포로 176 · 3층', '02-3479-1353', '', 'https://www.shinsegae.com/store/floor.do?storeCd=SC00002', '서울 서초구 신반포로 176'],
  ['현대백화점 무역센터점', 'dept', '서울', '한국', '서울 강남구 테헤란로 517 · 3층 수입·디자이너', '02-3467-8735', '', 'https://www.ehyundai.com/newPortal/DP/FG/FG000000_V.do?branchCd=B00122000', '서울 강남구 테헤란로 517'],
  ['현대백화점 판교점', 'dept', '성남', '한국', '경기 성남시 분당구 판교역로146번길 20 · 2층 럭셔리 패션', '031-5170-1260', '', 'https://www.ehyundai.com/newPortal/DP/FG/FG000000_V.do?branchCd=B00148000', '경기도 성남시 분당구 판교역로146번길 20'],
  ['갤러리아 명품관 EAST', 'dept', '서울', '한국', '서울 강남구 압구정로 407 · 3층', '02-6905-3578', '', 'https://dept.galleria.co.kr/utility/brand/detail/322', [37.52805, 127.04156]], // OSM엔 건물 번호가 없어 같은 건물 매장 안내 좌표 사용
  ['롯데백화점 부산본점 에비뉴엘', 'dept', '부산', '한국', '부산 부산진구 가야대로 772 · 에비뉴엘 2층', '051-810-3254', '', 'https://www.lotteshopping.com/store/floor?cstrCd=0005', '부산광역시 부산진구 가야대로 772'],
  ['신세계사이먼 여주 프리미엄 아울렛', 'outlet', '여주', '한국', '경기 여주시 명품로 360 · EAST LOW 214B호', '031-880-1412', '', 'https://app.premiumoutlets.co.kr/rpage/store/store-brand/01?tab=brand', '여주 프리미엄 아울렛'],

  // 일본 백화점·쇼핑몰 (나고야 사카에 미쓰코시는 공식 층별 안내에 없어서 뺌)
  ['이세탄 신주쿠 멘즈관', 'dept', '도쿄', '일본', '東京都新宿区新宿3-14-1 伊勢丹新宿店メンズ館 · 3F', '03-3352-1111', '매일 10:00–20:00', 'https://www.imn.jp/brand/rick-owens', [35.69237, 139.70471]],
  ['이세탄 신주쿠 본관', 'dept', '도쿄', '일본', '東京都新宿区新宿3-14-1 伊勢丹新宿店 本館 · 3F', '03-3352-1111', '', `${FP}/34519`, [35.69164, 139.70462]],
  ['니혼바시 다카시마야', 'dept', '도쿄', '일본', '東京都中央区日本橋2-4-1 日本橋高島屋S.C. 本館 · 2F', '03-3211-4111', '', `${FP}/30927`, [35.68067, 139.7737]],
  ['Rick Owens GINZA SIX', 'dept', '도쿄', '일본', '東京都中央区銀座6-10-1 GINZA SIX · 3F', '070-3338-4558', '매일 10:30–20:30', 'https://ginza6.tokyo/shops/95973', [35.66987, 139.76401]],
  ['마쓰자카야 나고야점', 'dept', '나고야', '일본', '愛知県名古屋市中区栄3-16-1 松坂屋名古屋店 本館 · 3F', '052-251-1111', '', 'https://www.matsuzakaya.co.jp/nagoya/topics/3/lux/main/RenewalOpen/241129_lux/', [35.16528, 136.90791]],

  // 일본 편집샵·아울렛 (좌표는 패션프레스 매장 정보)
  ['DOVER STREET MARKET GINZA', 'select', '도쿄', '일본', '東京都中央区銀座6-9-5 ギンザコマツ西館', '03-6228-5080', '', 'https://ginza.doverstreetmarket.com/pages/floorguide', [35.6704, 139.76312]],
  ['BOLS・1987 니혼바시 다카시마야', 'select', '도쿄', '일본', '東京都中央区日本橋2-4-1 日本橋高島屋S.C. 本館 · 2F', '03-5542-1770', '', BOLS, [35.68067, 139.7737]],
  ['RESTIR BOUTIQUE', 'select', '도쿄', '일본', '東京都港区赤坂9-6-17', '03-5413-3708', '', 'https://en.restir.com/en-us/collections/rick-owens', [35.66668, 139.72921]],
  ['R&Co. 롯폰기 힐스', 'select', '도쿄', '일본', '東京都港区六本木6-10-2 六本木ヒルズ ウェストウォーク · 4F', '03-6434-7729', '', `${FP}/62712`, [35.6604, 139.72904]],
  ['Starman by R&Co. 롯폰기 힐스', 'select', '도쿄', '일본', '東京都港区六本木6-10-2 六本木ヒルズ ウェストウォーク · 4F', '03-6434-9557', '', `${FP}/18953`, [35.6604, 139.72904]],
  ['ESTNATION 롯폰기 힐스', 'select', '도쿄', '일본', '東京都港区六本木6-10-1 六本木ヒルズ ヒルサイド · 2F', '0120-503-971', '', ESTNATION, [35.6604, 139.72904]],
  ['NUBIAN 하라주쿠', 'select', '도쿄', '일본', '東京都渋谷区神宮前1-20-2', '03-6447-0207', '', NUBIAN, [35.67169, 139.70488]],
  ['NUBIAN 시부야 파르코', 'select', '도쿄', '일본', '東京都渋谷区宇田川町15-1 渋谷PARCO · 3F', '03-6455-1076', '', NUBIAN, [35.66204, 139.69896]],
  ['R&Co. 오모테산도 힐스', 'select', '도쿄', '일본', '東京都渋谷区神宮前4-12-10 表参道ヒルズ 本館 · 2F', '03-6804-3393', '', `${FP}/3841`, [35.66726, 139.70893]],
  ['GR8 라포레 하라주쿠', 'select', '도쿄', '일본', '東京都渋谷区神宮前1-11-6 ラフォーレ原宿', '03-3408-6908', '', 'https://www.gr8.jp/collections/rick-owens-drkshdw', [35.6691, 139.70552]],
  ['MIDWEST TOKYO', 'select', '도쿄', '일본', '東京都渋谷区神南1-6-1', '03-5428-3171', '', MIDWEST, [35.66446, 139.69975]],
  ['LIFT 다이칸야마', 'select', '도쿄', '일본', '東京都渋谷区代官山町16-5 アドレスガーデン代官山', '03-3780-0163', '', 'https://lift-net.co.jp/blogs/news/rick-owens-lilies', [35.64957, 139.70298]],
  ['ESTNATION 후타코타마가와', 'select', '도쿄', '일본', '東京都世田谷区玉川3-17-1 玉川高島屋S.C. 南館 · 1F', '03-5491-6118', '', ESTNATION, [35.61414, 139.62688]],
  ['Amanojak. 기타센주', 'select', '도쿄', '일본', '東京都足立区千住中居町18-10 1F', '03-4400-2094', '', 'https://www.amanojak.jp/collections/rick-owens', '千住中居町, 足立区'],
  ['ESTNATION 미쓰이 아웃렛 파크 기사라즈', 'outlet', '기사라즈', '일본', '千葉県木更津市金田東3-1-1 三井アウトレットパーク木更津 · 1F', '0438-40-1656', '', `${FP}/32032`, [35.43467, 139.93529]],
  ['ReVoLuTioN', 'select', '센다이', '일본', '宮城県仙台市青葉区中央2-10-10 リヴォルーションビル · 2F', '022-262-6864', '', `${FP}/55999`, [38.26236, 140.87581]],
  ['ZOETROPE', 'select', '니가타', '일본', '新潟県新潟市中央区古町通5-584', '025-229-1245', '', DEEP, [37.93035, 139.04462]],
  ['Intention Line.', 'select', '니가타', '일본', '新潟県新潟市中央区古町通5-630-3', '025-229-0222', '', DEEP, [37.91894, 139.04332]],
  ['RIPE ARK', 'select', '우쓰노미야', '일본', '栃木県宇都宮市西1-3-6', '028-633-0533', '', `${FP}/333`, [36.56053, 139.87774]],
  ['mou 도야마 본점', 'select', '도야마', '일본', '富山県富山市総曲輪3-5-4', '076-422-2222', '', MOU, [36.68948, 137.21506]],
  ['mou uomo', 'select', '도야마', '일본', '富山県富山市総曲輪2-6-6 CASA da Vinci', '076-425-4322', '', MOU, [36.69034, 137.21489]],
  ['mou annex', 'select', '도야마', '일본', '富山県富山市総曲輪3-3-17', '076-491-8351', '', MOU, [36.68978, 137.21424]],
  ['mou 가나자와', 'select', '가나자와', '일본', '石川県金沢市片町2-1-10', '076-262-2886', '', MOU, [36.56112, 136.65311]],
  ['APPLICATION', 'select', '가나자와', '일본', '石川県金沢市竪町86-1', '076-216-7707', '', 'https://detail-online-store.com/en/collections/rick-owens-detail-application-online-store', [36.55934, 136.65432]],
  ['BOLS・1987 본점', 'select', '나고야', '일본', '愛知県名古屋市名東区にじが丘1-1', '052-782-4847', '', BOLS, [35.16079, 136.98921]],
  ['MIDWEST NAGOYA', 'select', '나고야', '일본', '愛知県名古屋市中区錦3-17-11 · 1–2F', '052-953-1870', '', MIDWEST, [35.17052, 136.90642]],
  ['MIDWEST OSAKA', 'select', '오사카', '일본', '大阪府大阪市北区梅田2-2-22 ハービスENT · B1F', '06-6343-7133', '', MIDWEST, [34.69953, 135.49417]],
  ['Why are you here.....? MIDOSUJI', 'select', '오사카', '일본', '大阪府大阪市中央区南船場4-4-3 · 1F', '06-6244-7799', '', `${FP}/56689`, [34.67558, 135.49993]],
  ['Why are you here?', 'select', '오사카', '일본', '大阪府大阪市中央区南船場4-13-3', '06-6252-3999', '', `${FP}/489`, [34.67734, 135.49799]],
  ['AYIN', 'select', '오사카', '일본', '大阪府大阪市浪速区幸町1-2-5 La Douceur湊町 · 1–2F', '06-6624-9011', '', `${FP}/1736`, [34.66841, 135.49448]],
  ['082+', 'select', '오사카', '일본', '大阪府大阪市西区南堀江1-14-28 山五ビル · 中2F', '050-3557-0882', '', 'https://082plus.com/en/collections/rick-owens-drkshdw', '南堀江1丁目, 西区, 大阪市'],
  ['R&Co. 본점·Bside', 'select', '와카야마', '일본', '和歌山県和歌山市雑賀町72', '073-422-6789', '', `${FP}/483`, [34.23305, 135.17729]],
  ['R&Co. femme', 'select', '와카야마', '일본', '和歌山県和歌山市南桶屋町15 ヴィラパーク本町 · 1F', '073-422-3887', '', `${FP}/29197`, [34.23547, 135.17496]],
  ['R&Co. priority 6', 'select', '와카야마', '일본', '和歌山県和歌山市屋形町1-2-1', '073-422-7666', '', `${FP}/52146`, [34.23196, 135.17673]],
  ['léd', 'select', '와카야마', '일본', '和歌山県和歌山市十一番丁28', '073-426-2332', '', `${FP}/4196`, [34.23198, 135.17649]],
  ['THE PARK 요나고', 'select', '요나고', '일본', '鳥取県米子市東倉吉町56', '0859-21-3399', '', PARK, [35.43011, 133.33116]],
  ['THE PARK 이즈모', 'select', '이즈모', '일본', '島根県出雲市塩冶有原町2-10-1', '0853-25-8637', '', PARK, [35.3623, 132.74472]],
  ['R&Co. 오카야마', 'select', '오카야마', '일본', '岡山県岡山市北区田町1-8-30', '050-8887-2742', '', `${FP}/65237`, [34.66164, 133.92307]],
  ['STORY', 'select', '오카야마', '일본', '岡山県岡山市北区幸町2-10 山部ビル', '086-234-1378', '', 'https://www.story.style/brands/19', [34.66249, 133.92124]],
  ['R&Co. 히로시마', 'select', '히로시마', '일본', '広島県広島市中区三川町5-5', '082-545-6288', '', `${FP}/65238`, [34.38983, 132.46139]],
  ['six', 'select', '마쓰야마', '일본', '愛媛県松山市千舟町4-1-3 · 1F', '089-913-5525', '', 'https://six06.jp/men/men_brand/rick-owens/', [33.83653, 132.76748]],
  ['ESTNATION 후쿠오카 솔라리아 플라자', 'select', '후쿠오카', '일본', '福岡県福岡市中央区天神2-2-43 ソラリアプラザ · 2F', '092-717-5028', '', ESTNATION, [33.58908, 130.39882]],
  ['cherry fukuoka', 'select', '후쿠오카', '일본', '福岡県福岡市中央区大名1-1-9 · 1F', '092-717-5502', '', 'https://cherry-fukuoka.com/en/collections/rick-owens', [33.5863, 130.39642]],
  ['bianca brillante', 'select', '구마모토', '일본', '熊本県熊本市中央区上通町5-20 セントラルハイツ102', '096-323-1809', '', 'http://bianca-brillante.com/sp/brand/', [32.80402, 130.7122]],
  ['WONDERCUBE WALL', 'select', '나하', '일본', '沖縄県那覇市松尾2-12-36', '098-861-3366', '', 'https://www.wondercube.jp/product-list/292', '松尾2丁目, 那覇市'],

  ['SVRN Chicago', 'retailer', '시카고', '미국', '171 N Aberdeen St, Suite 103, Chicago, IL', '', '', 'https://www.svrn.com/pages/contact', '171 North Aberdeen Street, Chicago'],
  ['SVRN San Francisco', 'retailer', '샌프란시스코', '미국', '1928 Fillmore St, San Francisco, CA', '', '', 'https://www.svrn.com/pages/contact', '1928 Fillmore Street, San Francisco'],
  ['END. London', 'retailer', '런던', '영국', '59 Broadwick St, London', '', '', 'https://www.endclothing.com/kr/stores', '59 Broadwick Street, London'],
  ['END. Glasgow', 'retailer', '글래스고', '영국', '196 Ingram Street, Glasgow', '', '', 'https://www.endclothing.com/kr/stores', '196 Ingram Street, Glasgow'],
  ['END. Newcastle', 'retailer', '뉴캐슬', '영국', '104–108 Grey Street, Newcastle upon Tyne', '', '', 'https://www.endclothing.com/kr/stores', 'Grey Street, Newcastle upon Tyne, NE1 6AE'],
  ['END. Milan', 'retailer', '밀라노', '이탈리아', 'Via dei Mercanti 21, 20121 Milano', '', '', 'https://www.endclothing.com/kr/stores', 'Via dei Mercanti 21, Milano'],
  ['Nugnes 1920 Trani', 'retailer', '트라니', '이탈리아', 'Corso Vittorio Emanuele 189, 76125 Trani', '', '', 'https://www.nugnes1920.com/pages/contatti', 'Corso Vittorio Emanuele 189, Trani'],
  ['Nugnes 1920 Bari', 'retailer', '바리', '이탈리아', 'Via Nicolò Putignani 32, 70121 Bari', '', '', 'https://www.nugnes1920.com/pages/contatti', 'Via Nicolò Putignani 32, Bari'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
for (const [name, kind, city, country, address, tel, hours, source, where] of PLACES) {
  const id = name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-');
  if (out.some((p) => p.id === id)) throw new Error(`id 중복: ${id}`);
  let at = where;
  if (typeof where === 'string') {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(where)}`;
    const [hit] = await (await fetch(url, { headers: { 'user-agent': 'OWENS-INDEX/1.0 (+https://owens-index.pages.dev)' } })).json();
    await sleep(1100);
    if (!hit) { console.log('좌표 못 찾음:', name, where); continue; }
    at = [+hit.lat, +hit.lon];
    console.log(`${name} ← ${hit.display_name.slice(0, 60)}`);
  }
  out.push({ id, name, kind, city, country, address, tel, hours, source, lat: +at[0].toFixed(5), lng: +at[1].toFixed(5) });
}
writeFileSync(new URL('public/places.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`public/places.json: ${out.length}곳`);
