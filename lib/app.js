'use strict';
/*
 * Physics Society — نسخة إعادة بناء محلية.
 *
 * الخادم يقدّم واجهة React المبنية مسبقًا (public/static) مع واجهة API محلية
 * تحاكي العقود التي تستدعيها الواجهة. لا يوجد أي اتصال بخوادم المنصة الأصلية.
 *
 * يعمل محليًا عبر node:http، وعلى Vercel عبر api/[...path].js.
 */
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 4180);
const HOST = process.env.HOST || '0.0.0.0';
const AUTH_SECRET = process.env.AUTH_SECRET || 'mahmoud-magdy-demo-auth-2026';
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;

const D = require('./data');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Robots-Tag': 'noindex, nofollow',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

// ---------------------------------------------------------------------------
// أدوات مساعدة
// ---------------------------------------------------------------------------

function sendJSON(res, status, body, extraHeaders = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...extraHeaders
  });
  res.end(text);
}

function sendEmpty(res, status = 204) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
  res.end();
}

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseJSONBody(buf) {
  if (!buf || !buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch (err) {
    return {};
  }
}

function parseUrlEncoded(buf) {
  const out = {};
  const text = buf.toString('utf8');
  for (const pair of text.split('&')) {
    if (!pair) continue;
    const i = pair.indexOf('=');
    const key = decodeURIComponent((i < 0 ? pair : pair.slice(0, i)).replace(/\+/g, ' '));
    const value = i < 0 ? '' : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    out[key] = value;
  }
  return out;
}

// تحليل multipart بسيط يكفي لحقول النماذج النصية (نتجاهل محتوى الملفات).
function parseMultipart(req, buf) {
  const contentType = req.headers['content-type'] || '';
  const match = /boundary="?([^";]+)"?/i.exec(contentType);
  if (!match) return {};
  const boundary = `--${match[1]}`;
  const parts = buf.toString('latin1').split(boundary);
  const out = {};
  for (const part of parts) {
    const sep = part.indexOf('\r\n\r\n');
    if (sep < 0) continue;
    const rawHeaders = part.slice(0, sep);
    const nameMatch = /name="([^"]*)"/i.exec(rawHeaders);
    if (!nameMatch) continue;
    const filenameMatch = /filename="([^"]*)"/i.exec(rawHeaders);
    if (filenameMatch) continue;
    let value = part.slice(sep + 4);
    if (value.endsWith('\r\n')) value = value.slice(0, -2);
    out[nameMatch[1]] = Buffer.from(value, 'latin1').toString('utf8');
  }
  return out;
}

function parseRequestBody(req, buf) {
  const type = (req.headers['content-type'] || '').toLowerCase();
  if (type.includes('multipart/form-data')) return parseMultipart(req, buf);
  if (type.includes('application/x-www-form-urlencoded')) return parseUrlEncoded(buf);
  return parseJSONBody(buf);
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function issueToken(user) {
  const payload = b64url(JSON.stringify({ uid: user.id, exp: Date.now() + TOKEN_TTL }));
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch (err) {
    return null;
  }
}

function bearer(req) {
  const header = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  return m ? m[1].trim() : '';
}

function publicUser() {
  return { ...D.user };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// منطق الـ API
// ---------------------------------------------------------------------------

const coursesById = new Map(D.courses.map(c => [String(c.id), c]));

function normalizePhone(value) {
  const digits = String(value == null ? '' : value).replace(/\D/g, '');
  return digits.replace(/^0+/, '');
}

function searchCourses(term) {
  const q = String(term || '').trim().toLowerCase();
  if (!q) return [];
  return D.courses
    .filter(c => {
      const haystack = [c.name, c.description, c.teacher && c.teacher.name, c.subject && c.subject.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    })
    .map(c => ({ ...c, is_course_renamed: !!c.renamed }));
}

function categoryById(id) {
  const cat = D.categories.find(c => c.id === Number(id));
  if (!cat) return null;
  return {
    id: cat.id,
    titleFirst: cat.titleFirst,
    titleLast: cat.titleLast,
    courses: cat.courses,
    visible: cat.visible
  };
}

function categoryCourses(id) {
  const cat = categoryById(id);
  if (!cat) return [];
  return D.coursesForYear(3);
}

function communityCategory(id) {
  const cat = D.communityCategories.find(c => c.id === Number(id));
  if (!cat) return null;
  return { ...cat, community_posts: D.communityPosts.filter(p => p.community_category_id === Number(id)) };
}

function loginResponse() {
  const user = publicUser();
  return { is_logged_in: true, token: issueToken(user), user };
}

async function handleApi(req, res, url) {
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();
  const query = url.searchParams;

  // --- Sanctum / CORS -------------------------------------------------------
  if (pathname === '/sanctum/csrf-cookie') return sendEmpty(res, 204);

  if (pathname === '/api/health' && method === 'GET') {
    return sendJSON(res, 200, {
      ok: true,
      name: 'mahmoud-magdy-platform',
      mode: 'demo',
      time: new Date().toISOString()
    });
  }

  // --- Auth -----------------------------------------------------------------
  if (pathname === '/api/auth/login' && method === 'POST') {
    const buf = await readBody(req);
    const body = parseRequestBody(req, buf);
    const phone = normalizePhone(body.phone);
    const password = String(body.password == null ? '' : body.password);
    if (phone === normalizePhone(D.demoCredentials.phone_text) && password === D.demoCredentials.password) {
      await sleep(180); // إحساس طبيعي بعملية الشبكة
      return sendJSON(res, 200, loginResponse());
    }
    return sendJSON(res, 422, {
      message: 'رقم الهاتف أو كلمة المرور غير صحيحة.',
      errors: { phone: ['رقم الهاتف أو كلمة المرور غير صحيحة.'] }
    });
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    await readBody(req).catch(() => null);
    return sendJSON(res, 200, { message: 'تم تسجيل الخروج.' });
  }

  if (pathname === '/api/auth/account_creation_request' && method === 'POST') {
    const buf = await readBody(req);
    const body = parseRequestBody(req, buf);
    const first = String(body.first_name || '').trim() || 'طالب';
    const last = String(body.last_name || '').trim();
    const year = Number(body.year) || 3;
    const request = {
      id: 9000,
      first_name: first,
      last_name: last,
      full_name: [first, body.second_name, body.third_name, last].filter(Boolean).join(' '),
      phone: body.phone ? Number(String(body.phone).replace(/\D/g, '')) || body.phone : null,
      year,
      request_status: 'pending',
      message: 'طلبك قيد المراجعة. تقدر تسجل دخول خلال ٤٨ ساعة بعد الموافقة.',
      created_at: new Date().toISOString()
    };
    await sleep(180);
    return sendJSON(res, 200, { user: request, message: 'تم إنشاء طلب الحساب بنجاح.' });
  }

  // --- User -----------------------------------------------------------------
  if (pathname === '/api/user' && method === 'GET') {
    const token = bearer(req) || 'guest';
    const user = publicUser();
    return sendJSON(res, 200, { user, data: { token, user } });
  }

  if (pathname === '/api/user/get_login_data' && method === 'GET') {
    return sendJSON(res, 200, { user: publicUser(), subscriptions: [], prepaid_courses: 0 });
  }

  if (pathname === '/api/user/unassigned_subscriptions' && method === 'GET') {
    return sendJSON(res, 200, { user_unassigned_subscription: 0 });
  }

  if (pathname === '/api/user/prepaid_courses' && method === 'GET') {
    return sendJSON(res, 200, { prepaid_courses: 0 });
  }

  if (pathname === '/api/user/statistics' && method === 'GET') {
    return sendJSON(res, 200, D.statistics);
  }

  if (pathname === '/api/user/prepaid_courses' && method === 'POST') {
    await readBody(req).catch(() => null);
    return sendJSON(res, 200, { message: 'تم الاشتراك بنجاح.' });
  }

  if (pathname === '/api/user/assign_unassigned_subscription' && method === 'POST') {
    await readBody(req).catch(() => null);
    return sendJSON(res, 200, { message: 'تم تخصيص الاشتراك بنجاح.' });
  }

  if (pathname === '/api/user/departments' && method === 'GET') {
    return sendJSON(res, 200, D.departments);
  }

  const subjectUserMatch = /^\/api\/user\/subjects\/(\d+)$/.exec(pathname);
  if (subjectUserMatch) {
    const subject = D.subjects.find(s => s.id === Number(subjectUserMatch[1]));
    if (!subject) return sendJSON(res, 404, { message: 'المادة غير موجودة.' });
    return sendJSON(res, 200, subject);
  }

  const teacherUserMatch = /^\/api\/user\/teachers\/(\d+)$/.exec(pathname);
  if (teacherUserMatch) {
    const teacher = D.teachers.find(t => t.id === Number(teacherUserMatch[1]));
    if (!teacher) return sendJSON(res, 404, { message: 'المدرس غير موجود.' });
    return sendJSON(res, 200, teacher);
  }

  // --- Governments / centers / stores --------------------------------------
  if (pathname === '/api/governments' && method === 'GET') {
    return sendJSON(res, 200, D.governments);
  }

  if (pathname === '/api/centers/options' && method === 'GET') {
    const year = query.get('year');
    const list = year ? D.centersYear3.filter(c => String(c.year) === String(year)) : D.centersYear3;
    return sendJSON(res, 200, list);
  }

  if (pathname === '/api/store_locators' && method === 'GET') {
    return sendJSON(res, 200, D.storeLocators);
  }

  if (pathname === '/api/store_locators/paginate' && method === 'GET') {
    return sendJSON(res, 200, { data: D.storeLocators, total: D.storeLocators.length });
  }

  // --- Sellables / courses --------------------------------------------------
  if (pathname === '/api/offers/active' && method === 'POST') {
    await readBody(req).catch(() => null);
    return sendJSON(res, 200, []);
  }

  if (pathname === '/api/sellables/subscribed' && method === 'GET') {
    return sendJSON(res, 200, []);
  }

  const sellablesYearMatch = /^\/api\/sellables\/year\/(\d+)$/.exec(pathname);
  if (sellablesYearMatch) {
    return sendJSON(res, 200, D.coursesForYear(sellablesYearMatch[1]));
  }

  const contentMatch = /^\/api\/sellables\/course\/(\d+)\/content$/.exec(pathname);
  if (contentMatch) {
    return sendJSON(res, 200, D.courseContent(contentMatch[1]));
  }

  const sectionableMatch = /^\/api\/sellables\/course\/(\d+)\/sections\/(\d+)\/sectionables\/(\d+)$/.exec(pathname);
  if (sectionableMatch && method === 'GET') {
    const sectionable = D.findSectionable(sectionableMatch[1], sectionableMatch[2], sectionableMatch[3]);
    if (!sectionable) return sendJSON(res, 404, { message: 'المحتوى غير موجود.' });
    return sendJSON(res, 200, sectionable);
  }

  if (/^\/api\/sellables\/course\/\d+\/sections\/\d+\/sectionables\/\d+\/videos\/\d+\/video_views(\/\d+)?$/.test(pathname)) {
    await readBody(req).catch(() => null);
    return sendJSON(res, 200, { id: Date.now() });
  }

  const subscribePreMatch = /^\/api\/sellables\/course\/(\d+)\/subscribe_pre_request$/.exec(pathname);
  if (subscribePreMatch && method === 'POST') {
    await readBody(req).catch(() => null);
    return sendJSON(res, 200, { previous_invoices: [] });
  }

  const couponMatch = /^\/api\/sellables\/course\/(\d+)\/validate_coupon$/.exec(pathname);
  if (couponMatch && method === 'POST') {
    const buf = await readBody(req);
    const body = parseRequestBody(req, buf);
    const code = String(body.coupon || '').trim().toUpperCase();
    await sleep(150);
    if (!code) {
      return sendJSON(res, 422, {
        message: 'الرجاء ملئ الكوبون.',
        errors: { coupon: ['الرجاء ملئ الكوبون.'] }
      });
    }
    if (code === 'PHYSICS10') {
      return sendJSON(res, 200, { discount: 10, message: 'تم تطبيق خصم ١٠٪ على سعر الكورس.' });
    }
    if (code === 'PHYSICS25') {
      return sendJSON(res, 200, { discount: 25, message: 'تم تطبيق خصم ٢٥٪ على سعر الكورس.' });
    }
    return sendJSON(res, 422, {
      message: 'كود الخصم غير صحيح أو منتهي الصلاحية.',
      errors: { coupon: ['كود الخصم غير صحيح أو منتهي الصلاحية.'] }
    });
  }

  const subscribeRequestMatch = /^\/api\/sellables\/course\/(\d+)\/subscribe_request$/.exec(pathname);
  if (subscribeRequestMatch && method === 'POST') {
    await readBody(req).catch(() => null);
    await sleep(220);
    const referenceNumber = `DEMO-${String(subscribeRequestMatch[1]).padStart(3, '0')}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    return sendJSON(res, 200, {
      referenceNumber,
      reference_number: referenceNumber,
      invoice_id: Number(subscribeRequestMatch[1]) * 1000 + 7,
      total_price: 250,
      message: 'تم إنشاء الفاتورة بنجاح. هذه نسخة تجريبية — لا يتم تحصيل أي مبالغ.'
    });
  }

  const sellableMatch = /^\/api\/sellables\/(\d+)$/.exec(pathname);
  if (sellableMatch) {
    const detail = D.courseDetail(sellableMatch[1]);
    if (!detail) return sendJSON(res, 404, { message: 'الكورس غير موجود.' });
    return sendJSON(res, 200, detail);
  }

  if (pathname === '/api/categories_info' && method === 'GET') {
    return sendJSON(res, 200, D.categories);
  }

  const categorySellablesMatch = /^\/api\/categories\/(\d+)\/sellables$/.exec(pathname);
  if (categorySellablesMatch) {
    return sendJSON(res, 200, categoryCourses(categorySellablesMatch[1]));
  }

  if (pathname === '/api/search_courses' && method === 'GET') {
    return sendJSON(res, 200, searchCourses(query.get('search') || query.get('s') || ''));
  }

  if (pathname === '/api/courses/prepaidable' && method === 'GET') {
    const list = D.courses.filter(c => c.renamed).slice(0, 3).map(c => ({ ...c, isPrepaid: true }));
    return sendJSON(res, 200, list);
  }

  if (pathname === '/api/courses/available_to_assign' && method === 'GET') {
    return sendJSON(res, 200, D.courses.slice(2, 4));
  }

  const subjectTeachersMatch = /^\/api\/subjects\/(\d+)\/teachers$/.exec(pathname);
  if (subjectTeachersMatch) {
    const subject = D.subjects.find(s => s.id === Number(subjectTeachersMatch[1]));
    if (!subject) return sendJSON(res, 200, []);
    const list = subject.teachers
      .map(t => D.teachers.find(x => x.id === t.id))
      .filter(Boolean);
    return sendJSON(res, 200, list);
  }

  const subjectCoursesMatch = /^\/api\/subjects\/(\d+)\/courses$/.exec(pathname);
  if (subjectCoursesMatch) {
    return sendJSON(res, 200, D.coursesForSubject(subjectCoursesMatch[1]));
  }

  const teacherCoursesMatch = /^\/api\/teachers\/(\d+)\/(renamed_only|not_renamed_only)(?:\/years\/(\d+))?\/courses$/.exec(pathname);
  if (teacherCoursesMatch) {
    const teacherId = teacherCoursesMatch[1];
    const onlyRenamed = teacherCoursesMatch[2] === 'renamed_only';
    const year = teacherCoursesMatch[3];
    let list = D.coursesForTeacher(teacherId, onlyRenamed);
    if (year) list = list.filter(c => String(c.year) === String(year));
    return sendJSON(res, 200, list);
  }

  // --- Community ------------------------------------------------------------
  if (pathname === '/api/visible/community_categories' && method === 'GET') {
    return sendJSON(res, 200, D.communityCategories);
  }

  const categoryPostsMatch = /^\/api\/visible\/community_categories\/(\d+)\/posts$/.exec(pathname);
  if (categoryPostsMatch) {
    const id = Number(categoryPostsMatch[1]);
    return sendJSON(res, 200, D.communityPosts.filter(p => p.community_category_id === id));
  }

  const getCategoryMatch = /^\/api\/get_categorie\/(\d+)$/.exec(pathname);
  if (getCategoryMatch) {
    const cat = communityCategory(getCategoryMatch[1]);
    if (!cat) return sendJSON(res, 404, { message: 'المجموعة غير موجودة.' });
    return sendJSON(res, 200, { ...cat, user_posts: cat.community_posts });
  }

  const createPostMatch = /^\/api\/community_categories\/(\d+)\/posts$/.exec(pathname);
  if (createPostMatch && method === 'POST') {
    const buf = await readBody(req).catch(() => Buffer.alloc(0));
    const body = parseRequestBody(req, buf);
    const categoryId = Number(createPostMatch[1]);
    const post = {
      id: Date.now(),
      community_category_id: categoryId,
      description: String(body.description || ''),
      image_source: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_approved: true,
      is_admin_post: false,
      is_seen: false,
      user: { id: D.user.id, full_name: D.user.full_name },
      community_comments: [],
      community_tags: [],
      comments_count: 0
    };
    D.communityPosts.unshift(post);
    const cat = D.communityCategories.find(c => c.id === categoryId);
    if (cat) cat.community_posts_count += 1;
    return sendJSON(res, 200, post);
  }

  if (pathname === '/api/community_tags' && method === 'GET') {
    return sendJSON(res, 200, []);
  }

  // --- Notifications --------------------------------------------------------
  if (pathname === '/api/fetch_global_notification' && method === 'GET') {
    return sendJSON(res, 200, []);
  }

  if (/^\/api\/notifications\/latest\/\d+$/.test(pathname) && method === 'GET') {
    return sendJSON(res, 200, []);
  }

  const notificationSeenMatch = /^\/api\/notifications\/(\d+)\/set_seen$/.exec(pathname);
  if (notificationSeenMatch) return sendJSON(res, 200, { message: 'ok' });

  // --- Parent dashboard -----------------------------------------------------
  if (pathname === '/api/parent_dashboard' && method === 'POST') {
    const buf = await readBody(req);
    const body = parseRequestBody(req, buf);
    await sleep(150);
    return sendJSON(res, 200, D.parentDashboard(body.phone, body.father_phone));
  }

  if (pathname === '/api/center_parent_dashboard' && method === 'POST') {
    const buf = await readBody(req);
    const body = parseRequestBody(req, buf);
    await sleep(150);
    return sendJSON(res, 200, D.parentDashboard(body.phone, body.father_phone));
  }

  // --- Fallback: لا نكسر الواجهة -------------------------------------------
  if (method === 'GET' || method === 'HEAD') {
    return sendJSON(res, 200, []);
  }
  await readBody(req).catch(() => null);
  return sendJSON(res, 200, {});
}

// ---------------------------------------------------------------------------
// تقديم الملفات الثابتة
// ---------------------------------------------------------------------------

async function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname);
  let filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  let stat = null;
  try {
    stat = await fsp.stat(filePath);
  } catch (err) {
    stat = null;
  }

  if (!stat || stat.isDirectory()) {
    // SPA history fallback: أي مسار بلا امتداد يعرض index.html.
    if (!path.extname(pathname)) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
      try {
        stat = await fsp.stat(filePath);
      } catch (err) {
        stat = null;
      }
    }
  }

  if (!stat || !stat.isFile()) {
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    return res.end('404 — الصفحة غير موجودة');
  }

  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    ...SECURITY_HEADERS
  };

  if (ext === '.html') headers['Cache-Control'] = 'no-cache';
  else headers['Cache-Control'] = 'public, max-age=3600';

  if (req.method === 'HEAD') {
    headers['Content-Length'] = stat.size;
    res.writeHead(200, headers);
    return res.end();
  }

  headers['Content-Length'] = stat.size;
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

// ---------------------------------------------------------------------------
// نقطة الدخول
// ---------------------------------------------------------------------------

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        Allow: 'GET,HEAD,POST,OPTIONS',
        ...SECURITY_HEADERS
      });
      return res.end();
    }

    if (url.pathname === '/sanctum/csrf-cookie') {
      return sendEmpty(res, 204);
    }

    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET,HEAD', ...SECURITY_HEADERS });
      return res.end('Method Not Allowed');
    }

    return await serveStatic(req, res, url);
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) {
      sendJSON(res, 500, { message: 'حدث خطأ غير متوقع في الخادم.' });
    } else {
      res.end();
    }
  }
}

async function start() {
  const server = http.createServer(handle);
  server.listen(PORT, HOST, () => {
    console.log(`Physics Society (clone) — http://${HOST}:${PORT}`);
    console.log(`الكورسات: ${D.courses.length} · المواد: ${D.subjects.length} · المدرسون: ${D.teachers.length}`);
  });
  return server;
}

if (require.main === module) start();

module.exports = { handle, start };
