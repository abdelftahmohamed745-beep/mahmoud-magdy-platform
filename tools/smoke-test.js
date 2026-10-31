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
const os = require('node:os');
const fs = require('node:fs');

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
  const storeFile = path.join(os.tmpdir(), `ps-smoke-store-${PORT}.json`);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', STORE_FILE: storeFile },
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
    check('vercel spa rewrite keeps original panel routes', spaRe.test('/magdy-mm-admin/login') && spaRe.test('/gohary-teacher-admin/panel/home'));
    const panelRedirects = vercel.redirects || [];
    check(
      'vercel redirects legacy panel routes',
      panelRedirects.some(r => r.source === '/admin' && r.destination === '/magdy-mm-admin/login') &&
        panelRedirects.some(r => r.source === '/teacher-panel' && r.destination === '/gohary-teacher-admin/login') &&
        panelRedirects.some(r => r.source === '/teacher_admin_panel' && r.destination === '/gohary-teacher-admin/login')
    );

    // --- لوحات التحكم الأصلية (أدمن / مدرس) --------------------------------
    for (const [route, target] of [
      ['/admin', '/magdy-mm-admin/login'],
      ['/teacher-panel', '/gohary-teacher-admin/login'],
      ['/teacher_admin_panel', '/gohary-teacher-admin/login']
    ]) {
      const page = await fetch(BASE + route, { redirect: 'manual' });
      check(`legacy panel redirect ${route}`, page.status === 302 && page.headers.get('location') === target);
    }

    for (const route of ['/magdy-mm-admin/login', '/gohary-teacher-admin/login']) {
      const page = await fetch(BASE + route);
      const text = await page.text();
      check(`original panel shell ${route}`, page.status === 200 && text.includes('<div id="root">') && text.includes('/static/js/main.'));
    }

    const adminLogin = await json('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@physics.society', password: 'Admin@2026' })
    });
    check('admin panel login', adminLogin.res.status === 200 && !!adminLogin.body.token);
    const adminAuth = { Authorization: `Bearer ${adminLogin.body.token}` };

    const adminOverview = await json('/api/admin/overview', { headers: adminAuth });
    check('admin panel overview', adminOverview.res.status === 200 && adminOverview.body.stats && adminOverview.body.stats.students >= 6);

    const adminUnauthorized = await fetch(`${BASE}/api/admin/overview`);
    check('admin panel rejects anonymous', adminUnauthorized.status === 401);

    const teacherLogin = await json('/api/teacher-panel/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '01100000001', password: 'teacher123' })
    });
    check('teacher panel login', teacherLogin.res.status === 200 && !!teacherLogin.body.token);
    const teacherAuth = { Authorization: `Bearer ${teacherLogin.body.token}` };

    const teacherOverview = await json('/api/teacher-panel/overview', { headers: teacherAuth });
    check('teacher panel overview', teacherOverview.res.status === 200 && teacherOverview.body.stats.courses > 0 && teacherOverview.body.stats.lessons > 0);

    const teacherOnAdmin = await fetch(`${BASE}/api/admin/overview`, { headers: teacherAuth });
    check('teacher cannot use admin api', teacherOnAdmin.status === 401 || teacherOnAdmin.status === 403);

    // --- طبقة توافق اللوحات الأصلية ---------------------------------------
    const pagesAllow = await json('/api/admin_pages_allow', { headers: adminAuth });
    check('legacy admin pages allow', pagesAllow.res.status === 200 && Array.isArray(pagesAllow.body) && pagesAllow.body.includes('home'));

    const secondaryEmail = await json('/api/admin/secondary_email/status', { headers: adminAuth });
    check('legacy secondary email not required', secondaryEmail.res.status === 200 && secondaryEmail.body.secondary_email_required === false);

    const legacyUsers = await json('/api/users/paginate?page=1&per_page=10', { headers: adminAuth });
    check('legacy users table', legacyUsers.res.status === 200 && Array.isArray(legacyUsers.body.data) && legacyUsers.body.total >= 6);

    const legacyCourses = await json('/api/courses/paginate?page=1&per_page=10', { headers: adminAuth });
    check('legacy courses table', legacyCourses.res.status === 200 && Array.isArray(legacyCourses.body.data) && legacyCourses.body.data.length > 0);

    const legacyStats = await json('/api/statistic/users-count', { headers: adminAuth });
    check('legacy statistics series', legacyStats.res.status === 200 && Array.isArray(legacyStats.body.data) && legacyStats.body.data.length > 1);

    const parallelPreview = await json('/api/account_creation_requests/parallel_preview', { headers: adminAuth });
    check(
      'legacy parallel preview shape',
      parallelPreview.res.status === 200 &&
        parallelPreview.body.overview &&
        parallelPreview.body.overview.currently_reviewing_requests === 0 &&
        Array.isArray(parallelPreview.body.data)
    );

    const teacherSubs = await json('/api/teacher_admin_panel/subscriptions/paginate?page=1&per_page=10', { headers: teacherAuth });
    check('legacy teacher subscriptions table', teacherSubs.res.status === 200 && Array.isArray(teacherSubs.body.data) && teacherSubs.body.data.length > 0);

    const teacherInvoices = await json('/api/teacher_admin_panel/invoices/paginate?page=1&per_page=10', { headers: teacherAuth });
    check('legacy teacher invoices table', teacherInvoices.res.status === 200 && Array.isArray(teacherInvoices.body.data) && teacherInvoices.body.data.length > 0);

    const teacherResults = await json('/api/teacher_admin_panel/exam_results/exam/paginate?page=1&per_page=10', { headers: teacherAuth });
    check('legacy teacher exam results table', teacherResults.res.status === 200 && Array.isArray(teacherResults.body.data) && teacherResults.body.data.length > 0);

    const teacherStats = await json('/api/teacher_admin_panel/teacher/statistics/subscriptions-count', { headers: teacherAuth });
    check('legacy teacher statistics series', teacherStats.res.status === 200 && Array.isArray(teacherStats.body.data) && teacherStats.body.data.length > 1);

    const studentCreate = await json('/api/admin/students', {
      method: 'POST',
      headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'طالب فحص الدخان', phone: '01099990001', year: 3, active: true })
    });
    check('admin creates student', (studentCreate.res.status === 200 || studentCreate.res.status === 201) && !!studentCreate.body.student.id);

    const studentId = studentCreate.body.student.id;
    const studentPatch = await json(`/api/admin/students/${studentId}`, {
      method: 'PATCH',
      headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'طالب فحص الدخان المعدّل' })
    });
    check('admin updates student', studentPatch.res.status === 200 && studentPatch.body.student.name === 'طالب فحص الدخان المعدّل');

    const settingsPatch = await json('/api/admin/settings', {
      method: 'PATCH',
      headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notice: 'تنبيه فحص الدخان' })
    });
    check('admin updates settings', settingsPatch.res.status === 200 && settingsPatch.body.settings.notice === 'تنبيه فحص الدخان');

    check('server stderr empty', stderr.trim() === '', stderr.slice(0, 300));
  } finally {
    child.kill('SIGTERM');
    await new Promise(r => child.once('exit', r));
    try { fs.unlinkSync(storeFile); } catch { /* ignore */ }
  }

  console.log(`\n${failures === 0 ? '✅ جميع الفحوصات ناجحة' : `❌ فشل ${failures} فحص`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('ERR', err);
  process.exit(1);
});
