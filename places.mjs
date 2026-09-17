// 지구본 기본 매장 목록 → public/places.json: node places.mjs
// 좌표는 OpenStreetMap Nominatim에서 (사용 규칙: 1초에 한 번, 사이트 주소를 밝힌 User-Agent). 유저가 제보한 매장은 D1(functions/api/places.js)에 따로 쌓임
import { writeFileSync } from 'node:fs';

// kind: official 공식 매장 · dept 백화점 매장 · retailer 판매처 매장. source는 확인한 곳
const OFFICIAL = 'https://www.rickowens.eu/en-kr/pages/stores';
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
  ['신세계백화점 본점', 'dept', '서울', '한국', '서울 중구 소공로 63 · 3층', '', '', 'https://www.shinsegae.com/store/floor.do?storeCd=SC00001', '서울 중구 소공로 63'],
  ['신세계백화점 강남점', 'dept', '서울', '한국', '서울 서초구 신반포로 176 · 3층', '', '', 'https://www.shinsegae.com/store/floor.do?storeCd=SC00002', '서울 서초구 신반포로 176'],
  ['현대백화점 무역센터점', 'dept', '서울', '한국', '서울 강남구 테헤란로 517', '', '', 'https://www.ehyundai.com/newPortal/DP/FG/FG000000_V.do?branchCd=B00122000', '서울 강남구 테헤란로 517'],
  ['현대백화점 판교점', 'dept', '성남', '한국', '경기 성남시 분당구 판교역로146번길 20', '', '', 'https://www.ehyundai.com/newPortal/DP/FG/FG000000_V.do?branchCd=B00148000', '경기도 성남시 분당구 판교역로146번길 20'],
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
for (const [name, kind, city, country, address, tel, hours, source, query] of PLACES) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const [hit] = await (await fetch(url, { headers: { 'user-agent': 'OWENS-INDEX/1.0 (+https://owens-index.pages.dev)' } })).json();
  if (!hit) console.log('좌표 못 찾음:', name, query);
  else out.push({ id: name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-'), name, kind, city, country, address, tel, hours, source, lat: +(+hit.lat).toFixed(5), lng: +(+hit.lon).toFixed(5) });
  await sleep(1100);
}
writeFileSync(new URL('public/places.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`public/places.json: ${out.length}곳`);
