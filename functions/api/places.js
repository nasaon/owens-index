// 유저가 제보한 매장 (Cloudflare Pages Functions): GET은 승인된 것만, POST는 대기열에 넣고 운영자 텔레그램으로 승인·거절 링크를 보냄
// 바인딩 DB = D1 owens-index. 비밀 값(wrangler pages secret put): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, REVIEW_SECRET
export const KINDS = { official: '공식 매장', dept: '백화점', select: '편집샵', outlet: '아울렛', vintage: '빈티지·중고', other: '기타' };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, kind, city, country, address, lat, lng, url, note, nick, created FROM places WHERE status = 'approved' ORDER BY created DESC LIMIT 500",
  ).all();
  return json(results, 200, { 'cache-control': 'public, max-age=60' });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = Object(await request.json()); // null이 와도 속성 읽기에서 터지지 않게
  } catch {
    return json({ error: '잘못된 요청이에요.' }, 400);
  }
  if (body.website) return json({ ok: true }, 201); // 사람에게는 안 보이는 칸: 봇만 채움 → 저장하지 않고 성공인 척
  const place = {
    name: text(body.name, 60), kind: Object.hasOwn(KINDS, body.kind) ? body.kind : 'other', city: text(body.city, 40), country: text(body.country, 40),
    address: text(body.address, 140), url: text(body.url, 200), note: text(body.note, 200), nick: text(body.nick, 20), lat: Number(body.lat), lng: Number(body.lng),
  };
  if (!place.name || !place.city) return json({ error: '매장 이름과 도시를 적어 주세요.' }, 400);
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng) || Math.abs(place.lat) > 90 || Math.abs(place.lng) > 180) return json({ error: '위치 찾기로 지도 위치를 골라 주세요.' }, 400);
  if (place.url && !/^https?:\/\/[^\s]+$/i.test(place.url)) place.url = '';

  // 같은 사람은 하루 5번, 확인 대기는 전체 200개까지. IP는 비밀 값을 섞은 해시로만 저장
  const ipHash = (await hmac(env.REVIEW_SECRET, request.headers.get('cf-connecting-ip') ?? '')).slice(0, 32);
  const { mine } = await env.DB.prepare("SELECT COUNT(*) AS mine FROM places WHERE ip_hash = ? AND created > datetime('now', '-1 day')").bind(ipHash).first();
  if (mine >= 5) return json({ error: '오늘은 제보를 더 받을 수 없어요. 내일 다시 해 주세요.' }, 429);
  const { waiting } = await env.DB.prepare("SELECT COUNT(*) AS waiting FROM places WHERE status = 'pending'").first();
  if (waiting >= 200) return json({ error: '확인을 기다리는 제보가 많아요. 조금 뒤에 다시 해 주세요.' }, 503);

  const { meta } = await env.DB.prepare('INSERT INTO places (name, kind, city, country, address, lat, lng, url, note, nick, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(place.name, place.kind, place.city, place.country, place.address, place.lat, place.lng, place.url, place.note, place.nick, ipHash).run();
  const id = meta.last_row_id;
  const origin = new URL(request.url).origin;
  const link = async (action) => `${origin}/api/review?id=${id}&a=${action}&t=${await hmac(env.REVIEW_SECRET, `${id}:${action}`)}`;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: [`📍 [OWENS INDEX] 매장 제보 #${id}`, `${place.name} · ${KINDS[place.kind]}`, [place.city, place.country].filter(Boolean).join(', '), place.address, place.url, place.note,
        `제보: ${place.nick || '익명'}`, `지도: https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=17/${place.lat}/${place.lng}`].filter(Boolean).join('\n'),
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: [[{ text: '승인', url: await link('ok') }, { text: '거절', url: await link('no') }]] },
    }),
  }).catch(() => {}); // 알림이 실패해도 제보는 저장됨 (D1에서 status='pending'으로 확인 가능)
  return json({ ok: true, id }, 201);
}
