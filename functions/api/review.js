// 운영자 텔레그램의 승인·거절 링크: 서명(t)이 맞을 때만 제보 상태를 바꿈
import { hmac } from './places.js';

const page = (message) => new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>OWENS INDEX · 제보 확인</title><body style="margin:0;padding:48px 24px;background:#000;color:#f5f5f7;font:17px/1.7 system-ui,sans-serif">
<p>${message}</p><p><a style="color:#f5f5f7" href="/#stores">지구본 보러 가기</a></p></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

// 서명 비교는 글자 수만큼 다 비교 (앞에서부터 맞춰 보는 공격 방지)
const same = (a, b) => a.length === b.length && [...a].reduce((diff, c, i) => diff | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const id = Number(q.get('id'));
  const action = q.get('a');
  if (!Number.isInteger(id) || !['ok', 'no'].includes(action)) return page('잘못된 링크예요.');
  if (!same(await hmac(env.REVIEW_SECRET, `${id}:${action}`), q.get('t') ?? '')) return page('확인할 수 없는 링크예요.');
  const { meta } = await env.DB.prepare('UPDATE places SET status = ? WHERE id = ?').bind(action === 'ok' ? 'approved' : 'rejected', id).run();
  if (!meta.changes) return page('그 제보를 찾지 못했어요.');
  return page(action === 'ok' ? `#${id} 제보를 승인했어요. 1분 안에 지구본에 올라가요.` : `#${id} 제보를 거절했어요.`);
}
