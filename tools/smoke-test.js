'use strict';
/*
 * فحص دخان شامل: يشغّل الخادم المحلي على منفذ عشوائي، ثم يتحقق من:
 *   - الصفحة الرئيسية وملفات الواجهة الأساسية
 *   - تسجيل الدخول التجريبي والجلسة
 *   - واجهات API التي تعتمد عليها الصفحات الأساسية
 *   - صفحات SPA العميقة (تُرجع index.html)
 *   - مسار الفاتورة التجريبي
 *
 * التشغيل: npm test
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 4400 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(__dirname, '..');

let failures = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !extra ? '' : ` — ${extra}`}`);
  if (!ok) failures++;
}

async function waitForServer(child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('انتهت عملية الخادم مبكرًا');
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch { /* لم يجهز بعد */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('انتهت مهلة انتظار الخادم');
}

async function json(pathname, options) {
  const res = await fetch(BASE + pathname, options);
  const body = await res.json().catch(() => null);
  return { res, body };
}

async function main() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', d => { stderr += d.toString(); });

  try {
    await waitForServer(child);

    const health = await json('/api/health');
    check('health ok', health.res.status === 200 && health.body.ok === true);

    const home = await fetch(`${BASE}/`);
    const html = await home.text();
    check('home 200', home.status === 200);
    check('RTL + title', html.includes('dir="rtl"') && html.includes('Physics Society'));
    const bundleMatch = /\/static\/js\/(main\.[0-9a-f]{8}\.js)/.exec(html);
    check('bundle referenced with content hash', !!bundleMatch, bundleMatch ? bundleMatch[1] : 'missing');
    check('trackers removed', !/facebook|hotjar|cloudflareinsights|googletagmanager/i.test(html));

    const css = await fetch(`${BASE}/static/css/main.355ff2f2.css`);
    check('main css 200', css.status === 200 && (css.headers.get('content-type') || '').includes('text/css'));

    const overrides = await fetch(`${BASE}/static/css/overrides.css`);
    check('overrides css 200', overrides.status === 200 && (await overrides.text()).includes('overflow-x'));

    const js = await fetch(BASE + (bundleMatch ? `/static/js/${bundleMatch[1]}` : '/static/js/main.3306f142.js'));
    const jsText = await js.text();
    check('main js 200', js.status === 200 && jsText.length > 1_000_000);
    check('api base patched to same-origin', jsText.includes('Zt=""') || !jsText.includes('https://api.mahmoud-magdy.com'));
    check('no invalid svg width="auto"', !jsText.includes('width:"auto",height:18,viewBox'));
    check('divider svg patched to 100%', jsText.includes('width:"100%",height:18,viewBox:"0 0 518 18"'));

    for (const route of ['/home', '/login', '/register', '/years/3', '/store_locator', '/terms_and_conditions', '/parent_dashboard', '/course/1', '/subject/1', '/teacher/1', '/community', '/community/category/1', '/prepaid_store', '/available_to_assign_courses_store', '/search?s=%D9%81%D9%8A%D8%B2%D9%8A%D8%A7%D8%A1', '/me/user/']) {
      const r = await fetch(BASE + route);
      const body = await r.text();
      check(`SPA route ${route}`, r.status === 200 && body.includes('<div id="root">'));
    }

    const login = await json('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '01000000000', password: '246810' })
    });
    check('demo login 200', login.res.status === 200);
    check('login returns token + user', !!(login.body && login.body.token && login.body.user));
    check('login is_logged_in', login.body && login.body.is_logged_in === true);
    const auth = { Authorization: `Bearer ${login.body.token}` };

    const badLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '01000000000', password: 'wrong' })
    });
    check('wrong password 422', badLogin.status === 422);

    const reviews = await json('/api/sellables/year/3', { headers: auth });
    check('year 3 courses', reviews.res.status === 200 && Array.isArray(reviews.body) && reviews.body.length >= 5, `count=${reviews.body && reviews.body.length}`);
    check('course cards have sellable + cover', reviews.body.every(c => c.sellable && c.picture && c.isStaticPicture === false));

    const course = await json('/api/sellables/1', { headers: auth });
    check('course detail', course.res.status === 200 && course.body.id === 1);
    check('course counters present', course.body.total_questions_quantity > 0 && course.body.total_videos_duration > 0 && course.body.is_couponable === true);

    const content = await json('/api/sellables/course/1/content', { headers: auth });
    check('course content sections', Array.isArray(content.body) && content.body.length === 3);
    check('content uses sectionables', content.body.every(s => Array.isArray(s.sectionables) && s.sectionables.length > 0));

    const sectionable = await json('/api/sellables/course/1/sections/1/sectionables/1', { headers: auth });
    check('sectionable detail', sectionable.res.status === 200 && sectionable.body.sectionable && sectionable.body.sectionable.platform === 'bunny');

    const subjectTeachers = await json('/api/subjects/1/teachers', { headers: auth });
    check('subject teachers', subjectTeachers.res.status === 200 && Array.isArray(subjectTeachers.body) && subjectTeachers.body.length === 1 && subjectTeachers.body[0].id === 1);

    const subjectCourses = await json('/api/subjects/1/courses', { headers: auth });
    check('subject courses', subjectCourses.res.status === 200 && Array.isArray(subjectCourses.body) && subjectCourses.body.length >= 5);

    const teacherCourses = await json('/api/teachers/1/renamed_only/years/3/courses', { headers: auth });
    check('teacher monthly courses', teacherCourses.res.status === 200 && Array.isArray(teacherCourses.body) && teacherCourses.body.length > 0);

    const search = await json('/api/search_courses?search=' + encodeURIComponent('فيزياء'), { headers: auth });
    check('search courses', search.res.status === 200 && Array.isArray(search.body) && search.body.length > 0);

    const pre = await json('/api/sellables/course/1/subscribe_pre_request', { method: 'POST', headers: auth });
    check('subscribe pre request', pre.res.status === 200 && Array.isArray(pre.body.previous_invoices));

    const coupon = await json('/api/sellables/course/1/validate_coupon', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ coupon: 'PHYSICS10' })
    });
    check('coupon PHYSICS10', coupon.res.status === 200 && coupon.body.discount === 10);

    const invoice = await json('/api/sellables/course/1/subscribe_request', { method: 'POST', headers: auth, body: '{}' });
    check('demo invoice created', invoice.res.status === 200 && /^DEMO-/.test(invoice.body.referenceNumber || ''));

    const stats = await json('/api/user/statistics', { headers: auth });
    check('user statistics', stats.res.status === 200 && 'total_videos_count' in stats.body);

    const community = await json('/api/visible/community_categories');
    check('community categories', community.res.status === 200 && Array.isArray(community.body) && community.body.length > 0);

    const gov = await json('/api/governments');
    check('governments', gov.res.status === 200 && Array.isArray(gov.body) && gov.body.length > 0);

    const terms = await fetch(`${BASE}/terms_and_conditions`);
    check('terms page 200', terms.status === 200);

    const missing = await fetch(`${BASE}/api/sellables/course/1/sections/1/sectionables/999999`);
    check('unknown sectionable 404', missing.status === 404);

    const media = await fetch(`${BASE}/media/demo-video.html`);
    const mediaText = await media.text();
    check('demo video placeholder', media.status === 200 && mediaText.includes('مشغل المحاضرات'));

    const robots = await fetch(`${BASE}/robots.txt`);
    check('robots.txt noindex', robots.status === 200 && (await robots.text()).includes('Disallow: /'));

    const vercel = require(path.join(ROOT, 'vercel.json'));
    const spaRewrite = vercel.rewrites.find(r => r.destination === '/index.html');
    const spaRe = new RegExp(`^${spaRewrite.source}$`);
    check('vercel spa rewrite keeps deep links', spaRe.test('/course/1') && spaRe.test('/me/user/'));
    check('vercel spa rewrite excludes assets', !spaRe.test('/static/js/main.3306f142.js') && !spaRe.test('/media/demo-video.html') && !spaRe.test('/api/health'));

    check('server stderr empty', stderr.trim() === '', stderr.slice(0, 300));
  } finally {
    child.kill('SIGTERM');
    await new Promise(r => child.once('exit', r));
  }

  console.log(`\n${failures === 0 ? '✅ جميع الفحوصات ناجحة' : `❌ فشل ${failures} فحص`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('ERR', err);
  process.exit(1);
});
