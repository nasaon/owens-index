// 사진으로 찾기용 상품 사진 값 (2026-10-22): 상품마다 첫 사진을 MobileCLIP-S0(fp16)으로 512개 숫자로 바꿔 public/vec.bin·vec.json에 씀
// 브라우저(index.html)도 같은 모델로 올린 사진을 바꾸고, 내적이 클수록 비슷함. 매일 갱신(daily.mjs)에서 build 다음에 실행
// 어제 파일에 같은 사진이 있으면 다시 계산하지 않음 → 처음 한 번만 3,000여 장(15~25분), 그 뒤엔 새 상품만
// vec.bin: 줄마다 배율(Float32) N개 + 줄(Int8, 가장 큰 값이 127이 되게 줄마다 배율 조정) N×512
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage } from '@huggingface/transformers';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const MODEL = 'Xenova/mobileclip_s0';
const DIM = 512;
const pub = (f) => new URL(`public/${f}`, import.meta.url);
const src = readFileSync(pub('data.js'), 'utf8');
const data = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
// 모델 입력이 256px라 512px로 받음 (원본은 장당 수 MB라 3,000여 장에 1시간 넘게 걸렸음). index.html의 sized와 같은 규칙
const url = (p) => {
  const u = p.startsWith('http') ? p : data.img + p;
  const add = (key) => `${u}${u.includes('?') ? '&' : '?'}${key}=512`;
  if (u.includes('cdn.shopify.com') || u.includes('/cdn/shop/')) return add('width');
  if (u.includes('/dw/image/')) return add('sw');
  return u.replace(/\bw_\d+\b/, 'w_512');
};

const old = existsSync(pub('vec.json')) ? JSON.parse(readFileSync(pub('vec.json'), 'utf8')) : { imgs: [] };
const oldBuf = old.imgs.length ? readFileSync(pub('vec.bin')) : null;
const oldScale = oldBuf && new Float32Array(oldBuf.buffer, oldBuf.byteOffset, old.imgs.length);
const oldRows = oldBuf && new Int8Array(oldBuf.buffer, oldBuf.byteOffset + old.imgs.length * 4);
const prev = new Map(old.model === MODEL ? old.imgs.map((img, r) => [img, r]).filter(([img]) => img) : []);

const items = data.items.filter((it) => it.images[0]);
const scale = new Float32Array(items.length);
const rows = new Int8Array(items.length * DIM);
const imgs = [];
let processor, model;
let made = 0;
let failed = 0;
const todo = [];
for (const [r, it] of items.entries()) {
  const img = it.images[0];
  imgs[r] = img;
  if (!prev.has(img)) {
    todo.push(r);
    continue;
  }
  const p = prev.get(img);
  scale[r] = oldScale[p];
  rows.set(oldRows.subarray(p * DIM, (p + 1) * DIM), r * DIM);
}
// 사진은 8장씩 동시에 받고, 모델은 한 장씩
for (let i = 0; i < todo.length; i += 8) {
  const batch = todo.slice(i, i + 8);
  const pics = await Promise.all(batch.map((r) => RawImage.read(url(items[r].images[0])).catch(() => null)));
  processor ??= await AutoProcessor.from_pretrained(MODEL);
  model ??= await CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: 'fp16' });
  for (const [j, r] of batch.entries()) {
    try {
      const { image_embeds } = await model(await processor(pics[j]));
      const v = image_embeds.normalize(2, -1).data;
      const max = v.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
      scale[r] = max / 127;
      for (let k = 0; k < DIM; k++) rows[r * DIM + k] = Math.round(v[k] / scale[r]);
      if (++made % 200 === 0) console.log(`사진 값 ${made}/${todo.length}개 계산`);
    } catch {
      imgs[r] = null; // 사진을 못 받음 → 값 0(검색에서 맨 뒤), 내일 다시 계산
      failed++;
    }
  }
}
writeFileSync(pub('vec.bin'), Buffer.concat([Buffer.from(scale.buffer), Buffer.from(rows.buffer)]));
writeFileSync(pub('vec.json'), JSON.stringify({ model: MODEL, dim: DIM, ids: items.map((it) => it.id), imgs }));
console.log(`사진 값: 상품 ${items.length}개, 새로 계산 ${made}개, 실패 ${failed}개`);
