// 요청사항 (2026-10-22): 방문자 의견을 D1 feedback에 저장하고 운영자 텔레그램으로 보냄. 공개하지 않음 (GET 없음)
// 테이블: CREATE TABLE feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, contact TEXT, ip_hash TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP)
import { hmac } from './places.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = Object(await request.json());
  } catch {
    return json({ error: '잘못된 요청이에요.' }, 400);
  }
  if (body.website) return json({ ok: true }, 201); // 사람에게는 안 보이는 칸: 봇만 채움 → 저장하지 않고 성공인 척
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 1000) : ''; // 줄바꿈은 살림
  const contact = typeof body.contact === 'string' ? body.contact.replace(/\s+/g, ' ').trim().slice(0, 100) : '';
  if (text.length < 2) return json({ error: '내용을 적어 주세요.' }, 400);

  // 같은 사람은 하루 10번, 전체는 하루 300번까지 (텔레그램이 도배되지 않게). IP는 비밀 값을 섞은 해시로만 저장
  const ipHash = (await hmac(env.REVIEW_SECRET, request.headers.get('cf-connecting-ip') ?? '')).slice(0, 32);
  const { mine } = await env.DB.prepare("SELECT COUNT(*) AS mine FROM feedback WHERE ip_hash = ? AND created > datetime('now', '-1 day')").bind(ipHash).first();
  if (mine >= 10) return json({ error: '오늘은 더 받을 수 없어요. 내일 다시 보내 주세요.' }, 429);
  const { today } = await env.DB.prepare("SELECT COUNT(*) AS today FROM feedback WHERE created > datetime('now', '-1 day')").first();
  if (today >= 300) return json({ error: '요청이 많아 잠시 쉬고 있어요. 조금 뒤에 다시 보내 주세요.' }, 503);

  const { meta } = await env.DB.prepare('INSERT INTO feedback (text, contact, ip_hash) VALUES (?, ?, ?)').bind(text, contact, ipHash).run();
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: [`💬 [OWENS INDEX] 요청사항 #${meta.last_row_id}`, text, contact && `답장받을 곳: ${contact}`].filter(Boolean).join('\n\n'), link_preview_options: { is_disabled: true } }),
  }).catch(() => {}); // 알림이 실패해도 요청은 저장됨 (D1 feedback에서 확인 가능)
  return json({ ok: true }, 201);
}
