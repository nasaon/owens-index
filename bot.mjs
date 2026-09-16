// 관심 상품·사이즈 텔레그램 알림: 로그온할 때 ro-bot.vbs가 시작 (기록은 bot.log). 크롬하츠 알림 봇을 같이 씀
// - 사이트 상세의 사이즈 알림 링크(t.me/봇?start=w_상품_사이즈)를 누르면 등록, /list 목록, /stop 번호로 삭제
// - 매일 갱신으로 public/data.js가 바뀌면 등록한 상품을 확인해, 재고가 생기거나 최저가가 3% 넘게 내려가면 알림
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const here = (name) => new URL(name, import.meta.url);
const vars = Object.fromEntries(readFileSync(here('.dev.vars'), 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const OWNER = String(vars.TELEGRAM_CHAT_ID);
const SITE = 'https://owens-index.pages.dev';
const won = (n) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${vars.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!json.ok) throw new Error(`텔레그램 ${method}: ${json.description}`);
  return json.result;
}
const send = (text, buttons = []) => tg('sendMessage', { chat_id: OWNER, text, link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: buttons.map(([t, u]) => [{ text: t, url: u }]) } });

// 사이즈 글자를 시작 링크에 쓸 수 있는 글자로 (39½ → 39h, MENS 9 → MENS-9). 사이트 index.html과 같은 규칙
export const sizeKey = (s) => String(s).replace(/½/g, 'h').replace(/[^A-Za-z0-9]+/g, '-');

const load = () => {
  const src = readFileSync(here('public/data.js'), 'utf8');
  return JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
};

// 그 사이즈 재고가 있는 판매처, 싼 순 (사이트 상세와 같은 계산). size 'all' = 사이즈 상관없이
// 사이즈 없이 재고만 알려주는 곳(END.)은 maybe로 따로: 알림 기준에는 안 넣고 목록에서만 보여줌
export function offersFor(data, it, size) {
  const rows = (it.offers ?? []).map(([store, krw, url, sizes, live]) => ({ store, krw, url, sizes, live: Boolean(live) }));
  if (!it.ext) rows.push({ store: 'official', krw: it.price, url: `${data.base}/products/${it.id}`, sizes: it.sizes.filter(([, ok]) => ok).map(([s]) => s), live: it.sizes.some(([, ok]) => ok) });
  const live = rows.filter((r) => r.live).sort((a, b) => a.krw - b.krw);
  if (size === 'all') return { hit: live, maybe: [] };
  return { hit: live.filter((r) => r.sizes.some((s) => sizeKey(s) === size)), maybe: live.filter((r) => !r.sizes.length) };
}

const storeName = (data, id) => (id === 'official' ? '공식몰' : data.stores.find((s) => s.id === id)?.name ?? id);
const label = (w) => `${w.name} · ${w.size === 'all' ? '전체 사이즈' : w.sizeLabel}`;
const status = (data, { hit, maybe }) => [
  hit.length ? `지금 재고: ${hit.slice(0, 3).map((r) => `${storeName(data, r.store)} ${won(r.krw)}`).join(' · ')}${hit.length > 3 ? ` 외 ${hit.length - 3}곳` : ''}` : '지금은 재고 없음',
  maybe.length ? `사이즈 확인 필요: ${maybe.map((r) => `${storeName(data, r.store)} ${won(r.krw)}`).join(' · ')}` : '',
].filter(Boolean).join('\n');

const WATCH = here('watch.json');
const state = existsSync(WATCH) ? JSON.parse(readFileSync(WATCH, 'utf8')) : { checked: '', items: [] };
const save = () => writeFileSync(WATCH, JSON.stringify(state, null, 1));

async function handle(text) {
  const data = load();
  const add = text.match(/^\/start w_([a-z0-9-]+)_([A-Za-z0-9-]+)$/);
  if (add) {
    const [, id, size] = add;
    const it = data.items.find((x) => x.id === id);
    if (!it) return send('사이트에서 그 상품을 찾지 못했어요. 사이트를 새로고침한 뒤 다시 눌러주세요.');
    const found = offersFor(data, it, size);
    const allSizes = [...it.sizes.map(([s]) => s), ...(it.offers ?? []).flatMap((o) => o[3])];
    const w = { id, size, sizeLabel: allSizes.find((s) => sizeKey(s) === size) ?? size, name: it.name, best: found.hit[0]?.krw ?? null };
    state.items = state.items.filter((x) => !(x.id === id && x.size === size)).concat(w);
    save();
    return send(`🔔 알림 등록 · ${label(w)}\n${status(data, found)}\n재고가 생기거나 최저가가 내려가면 알려드릴게요.`, [['사이트에서 보기', `${SITE}/?item=${id}`]]);
  }
  if (text === '/list') {
    if (!state.items.length) return send('등록한 알림이 없어요. 사이트 상품 상세에서 사이즈 알림을 눌러 등록해요.');
    const byId = new Map(data.items.map((x) => [x.id, x]));
    return send(state.items.map((w, i) => {
      const it = byId.get(w.id);
      return `${i + 1}. ${label(w)}\n${it ? status(data, offersFor(data, it, w.size)) : '사이트에서 내려감'}`;
    }).join('\n\n') + '\n\n삭제: /stop 번호');
  }
  const stop = text.match(/^\/stop\s+(\d+)$/);
  if (stop) {
    const [w] = state.items.splice(Number(stop[1]) - 1, 1);
    save();
    return send(w ? `🗑 알림 삭제 · ${label(w)}` : '그 번호의 알림이 없어요. /list로 번호를 확인해 주세요.');
  }
  if (text.startsWith('/')) return send(`OWENS INDEX 알림\n• 사이트 상품 상세의 사이즈 알림 → 등록\n• /list 등록한 알림과 지금 재고\n• /stop 번호 → 삭제\n${SITE}`);
}

// 새 데이터가 나오면 한 번: 없던 재고가 생기거나 최저가가 3% 넘게 내려간 것만 알림
async function check() {
  const data = load();
  if (data.updated === state.checked) return;
  const byId = new Map(data.items.map((x) => [x.id, x]));
  for (const w of state.items) {
    const it = byId.get(w.id);
    const [best] = it ? offersFor(data, it, w.size).hit : [];
    if (best && (w.best === null || best.krw < w.best * 0.97)) {
      const head = w.best === null ? `🔔 재고 생김 · ${label(w)}` : `📉 가격 내림 · ${label(w)}\n${won(w.best)} → ${won(best.krw)}`;
      await send(`${head}\n최저 ${won(best.krw)} · ${storeName(data, best.store)}`, [[`${storeName(data, best.store)}에서 보기`, best.url], ['사이트에서 보기', `${SITE}/?item=${w.id}`]]);
    }
    w.best = best?.krw ?? null;
  }
  state.checked = data.updated;
  save();
}

async function main() {
  console.log(new Date().toISOString(), '알림 봇 시작');
  let offset = 0;
  let lastCheck = 0;
  for (;;) {
    try {
      // 5분마다 새 데이터인지 확인 (매일 갱신 뒤 알림)
      if (Date.now() - lastCheck > 5 * 60000) {
        lastCheck = Date.now();
        await check();
      }
      // 새 메시지를 최대 50초 기다림 (롱 폴링: 메시지가 오면 바로 반응)
      const updates = await tg('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        const m = u.message;
        if (m?.text && String(m.chat.id) === OWNER) await handle(m.text.trim()); // 다른 사람 메시지는 무시 (개인용)
      }
    } catch (e) {
      console.error(new Date().toISOString(), e.message);
      await new Promise((r) => setTimeout(r, 15000)); // 노트북이 막 깼을 때 등 연결 실패 → 잠깐 쉬고 다시
    }
  }
}

if (process.argv[1]?.endsWith('bot.mjs')) main();
export { handle }; // 직접 시험용
