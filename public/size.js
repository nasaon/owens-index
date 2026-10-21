// 사이즈 변환 (index.html·test.mjs가 같이 씀): 릭오웬스 공식 사이즈표(rickowens.eu 상품 페이지 'Size guide', 2026-10 확인)에 한국 사이즈를 붙임
// 한 줄 = [한국 상의, 릭오웬스, 국제, 청바지 = 허리 인치]
// 한국 남성 상의(가슴둘레 cm)는 공식표의 미국·영국 사이즈(가슴둘레 인치)로 맞춤: 48 = 38인치 ≈ 97cm → 95
// 한국 여성 상의 44·55·66·77·88은 XS~XL. 남성 44(XXS·28)는 공식표에 없어 한 칸 이어 붙임
const KSIZE = {
  m: [[85, 44, 'XXS', 28], [90, 46, 'XS', 29], [95, 48, 'S', 30], [100, 50, 'M', 32], [105, 52, 'L', 34], [110, 54, 'XL', 36], [115, 56, 'XXL', 38]],
  w: [[85, 38, 'XS', 25], [90, 40, 'S', 26], [95, 42, 'M', 28], [100, 44, 'L', 30], [105, 46, 'XL', 32], [110, 48, 'XXL', 34]],
};
const W_TOP = { 85: '44', 90: '55', 95: '66', 100: '77', 105: '88' }; // 여성복 한국 표기
const sexOf = (it) => (it.gender === 'w' ? 'w' : 'm'); // 공용은 남성 표

// 한국 사이즈 → 공식표 줄: 상의는 같은 줄, 허리는 같은 줄이 없으면 사이에 낀 두 줄 (31 → 30·32)
function kRows(sex, kind, k) {
  const rows = KSIZE[sex];
  if (kind === 'top') return rows.filter((r) => r[0] === k);
  const i = rows.findIndex((r) => r[3] >= k);
  return i < 0 ? [] : rows[i][3] === k ? [rows[i]] : i > 0 ? [rows[i - 1], rows[i]] : [];
}

// 내 사이즈(한국) → 상품에서 찾을 표기: 릭오웬스 번호·국제, 하의는 청바지 사이즈(허리 인치)도
// (허리 38 같은 값은 여성 릭오웬스 38과 겹쳐서 가장 작은 릭오웬스 번호보다 작을 때만 그대로 찾음)
const labelsFor = (sex, kind, mine) => new Set(mine.flatMap((k) => [
  ...kRows(sex, kind, +k).flatMap((r) => [String(r[1]), r[2], ...(kind === 'bottom' ? [String(r[3])] : [])]),
  ...(kind === 'bottom' && +k < KSIZE[sex][0][1] ? [String(k)] : []),
]));

// 상품 표기 → 한국 사이즈 (모르는 표기는 ''): 청바지 사이즈(20~39)는 허리 인치라 그대로
function korean(sex, kind, label) {
  const r = KSIZE[sex].find((x) => String(x[1]) === label || x[2] === label || (kind === 'bottom' && String(x[3]) === label));
  if (kind === 'bottom') return r ? String(r[3]) : /^[23]\d$/.test(label) ? label : '';
  return r ? (sex === 'w' && W_TOP[r[0]]) || String(r[0]) : '';
}
