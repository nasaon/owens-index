// 매일 데이터 갱신 → data.js 커밋·푸시 → Cloudflare Pages 배포: 작업 스케줄러가 daily.vbs로 실행 (기록은 daily.log)
// 실패하거나 판매처 수집이 이상하면 텔레그램으로 알림 (.dev.vars의 TELEGRAM_BOT_TOKEN·TELEGRAM_CHAT_ID)
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const env = { ...process.env, CI: '1', GCM_INTERACTIVE: 'never' }; // 창이 없으니 로그인 창을 띄우지 않게
const run = (cmd) => execSync(cmd, { cwd: here, stdio: 'inherit', env });
const vars = Object.fromEntries(readFileSync(new URL('.dev.vars', here), 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const notify = (text) => fetch(`https://api.telegram.org/bot${vars.TELEGRAM_BOT_TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ chat_id: vars.TELEGRAM_CHAT_ID, text: `${text}\n자세한 기록: D:\\JJH\\RO\\daily.log` }),
}).catch(() => {});
const stores = () => {
  const src = readFileSync(new URL('public/data.js', here), 'utf8');
  return JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1)).stores ?? [];
};

console.log(`\n=== ${new Date().toISOString()} 매일 갱신`);
try {
  const before = new Map(stores().map((s) => [s.id, s.count]));
  run('node build.mjs');
  // 판매처가 사이트 구조를 바꾸면 오류 없이 상품 수만 확 줄 수 있음 → 실패했거나 전날의 절반 아래로 줄면 알림
  const odd = stores().filter((s) => s.count === 0 || (before.get(s.id) >= 10 && s.count < before.get(s.id) / 2))
    .map((s) => `${s.name}: ${before.get(s.id) ?? '?'}개 → ${s.count}개`);
  if (odd.length) await notify(`⚠️ [OWENS INDEX] 판매처 수집 확인 필요\n${odd.join('\n')}`);
  run('git add public/data.js public/history.json');
  if (spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: here }).status === 1) {
    run(`git commit -q -m "data ${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })}" -- public/data.js public/history.json`); // 한국 날짜, 다른 수정 중인 파일은 빼고
    run('git push -q');
  }
  run('npx wrangler pages deploy --branch main --commit-dirty=true');
  console.log('완료');
} catch (e) {
  console.error(e.message);
  await notify(`⚠️ [OWENS INDEX] 매일 갱신 실패\n${e.message.slice(0, 500)}`);
  process.exitCode = 1;
}
