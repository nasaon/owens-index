// 매일 데이터 갱신 → data.js 커밋·푸시 → Cloudflare Pages 배포: 작업 스케줄러가 daily.vbs로 실행 (기록은 daily.log)
// 실패하면 텔레그램으로 알림 (.dev.vars의 TELEGRAM_BOT_TOKEN·TELEGRAM_CHAT_ID)
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const env = { ...process.env, CI: '1', GCM_INTERACTIVE: 'never' }; // 창이 없으니 로그인 창을 띄우지 않게
const run = (cmd) => execSync(cmd, { cwd: here, stdio: 'inherit', env });
const vars = Object.fromEntries(readFileSync(new URL('.dev.vars', here), 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

console.log(`\n=== ${new Date().toISOString()} 매일 갱신`);
try {
  run('node build.mjs');
  run('git add public/data.js');
  if (spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: here }).status === 1) {
    run(`git commit -q -m "data ${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })}" -- public/data.js`); // 한국 날짜, 다른 수정 중인 파일은 빼고
    run('git push -q');
  }
  run('npx wrangler pages deploy --branch main --commit-dirty=true');
  console.log('완료');
} catch (e) {
  console.error(e.message);
  await fetch(`https://api.telegram.org/bot${vars.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: vars.TELEGRAM_CHAT_ID, text: `⚠️ [OWENS INDEX] 매일 갱신 실패\n${e.message.slice(0, 500)}\n자세한 기록: D:\\JJH\\RO\\daily.log` }),
  }).catch(() => {});
  process.exitCode = 1;
}
