# Physics Society — منصة محمود مجدي (نسخة إعادة بناء)

[![CI](https://github.com/abdelftahmohamed745-beep/mahmoud-magdy-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/abdelftahmohamed745-beep/mahmoud-magdy-platform/actions/workflows/ci.yml)
[![Vercel](https://img.shields.io/badge/Vercel-live-000?logo=vercel)](https://mahmoud-magdy-platform.vercel.app)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A520-339933?logo=node.js&logoColor=white)](package.json)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

- **الموقع المباشر:** <https://mahmoud-magdy-platform.vercel.app>
- **المستودع:** <https://github.com/abdelftahmohamed745-beep/mahmoud-magdy-platform>
- **الموقع المرجعي:** <https://www.mahmoud-magdy.com/>

> **تنبيه حقوق:** اسم «محمود مجدي» و«Physics Society» والشعارات والصور والنصوص التعليمية
> ملك لأصحابها. هذا المشروع عمل بحثي/تعليمي لإعادة بناء الواجهة، وليس الموقع الرسمي
> ولا تابعًا له. لا يحتوي المشروع على أي فيديوهات أو مواد مدفوعة أصلية.

---

## 1) ما الذي يعمل

| المجال | الحالة |
|---|---|
| الصفحة الرئيسية وصفحة الهبوط (`/`, `/home`) | ✅ |
| تسجيل الدخول وإنشاء طلب حساب (`/login`, `/register`) | ✅ |
| اختيار الصف ثم قائمة الكورسات (`/years/:year`) | ✅ |
| صفحة الكورس والمحتوى والأسابيع (`/course/:id`) | ✅ |
| مشغل الحصة (iframe محلي بدل الفيديو الأصلي) | ✅ |
| الفاتورة التجريبية وإنشاء رقم مرجعي (`/subscribe/invoice`) | ✅ |
| البروفايل والإحصائيات (`/me/user/`) | ✅ |
| المواد والمدرسون (`/subject/:id`, `/teacher/:id`) | ✅ |
| البحث (`/search`) | ✅ |
| المتجر والكورسات المتاحة للإسناد | ✅ |
| مجتمع المنصة والمنشورات (`/community/...`) | ✅ |
| المتجر/أقرب فرع (`/store_locator`) | ✅ |
| الشروط والأحكام ولوحة ولي الأمر | ✅ |
| الوضع الليلي، RTL، قائمة الجوال، التصميم المتجاوب | ✅ |
| لوحة تحكم الأدمن الأصلية (`/magdy-mm-admin/login`) | ✅ |
| لوحة تحكم المدرس الأصلية (`/gohary-teacher-admin/login`) | ✅ |
| تحويل المسارات المختصرة (`/admin`, `/teacher-panel`) | ✅ |
| نشر على Vercel + دالة Serverless لكل `/api/*` | ✅ |

كل بيانات المنصة (الكورسات، الأسابيع، المدرسون، المجتمعات، الفروع) محلية داخل
`data/` و`lib/data.js`، ولا يوجد أي اتصال بخوادم المنصة الأصلية. تعديلات اللوحات
تُحفظ في مخزن JSON محلي (`lib/store.js`) وتظهر مباشرة في واجهة الطالب.

---

## 2) التشغيل المحلي

```bash
git clone https://github.com/abdelftahmohamed745-beep/mahmoud-magdy-platform.git
cd mahmoud-magdy-platform
npm install        # لا توجد اعتماديات إنتاجية — الخطوة للتحقق فقط
npm start          # http://127.0.0.1:4180
# أو
PORT=8080 HOST=0.0.0.0 npm start
```

- لا يحتاج المشروع قاعدة بيانات أو مفاتيح API.
- `AUTH_SECRET` اختياري لتوقيع الجلسات التجريبية؛ غيّره في أي نشر حقيقي.
- الواجهة هي حزمة React الأصلية بعد ضبطها لتتصل بالـ API المحلي.

### حساب تجريبي جاهز

| الحقل | القيمة |
|---|---|
| رقم الهاتف | `01000000000` |
| كلمة المرور | `246810` |
| الصف | الثالث الثانوي |

### كوبونات تجريبية

| الكود | الخصم |
|---|---|
| `PHYSICS10` | 10% |
| `PHYSICS25` | 25% |

أي كود آخر يُرجع رسالة «كود الخصم غير صحيح أو منتهي الصلاحية».

---

## 3) لوحات التحكم (الأدمن والمدرس)

اللوحات هي **واجهة المنصة الأصلية نفسها** (حزمة React الأصلية) بعد توصيلها بمخزن
البيانات المحلي. تعمل على مساراتها الأصلية، وتستخدم توكن موقّع (HMAC) يُرسَل في
ترويسة `Authorization: Bearer <token>`.

| اللوحة | المسار الأصلي | تحويل مختصر |
|---|---|---|
| الأدمن | `/magdy-mm-admin/login` ثم `/magdy-mm-admin/panel/*` | `/admin` |
| المدرس | `/gohary-teacher-admin/login` ثم `/gohary-teacher-admin/panel/*` | `/teacher-panel` أو `/teacher_admin_panel` |

روابط مباشرة:

- الأدمن محليًا: <http://127.0.0.1:4180/magdy-mm-admin/login>
- الأدمن على Vercel: <https://mahmoud-magdy-platform.vercel.app/magdy-mm-admin/login>
- المدرس محليًا: <http://127.0.0.1:4180/gohary-teacher-admin/login>
- المدرس على Vercel: <https://mahmoud-magdy-platform.vercel.app/gohary-teacher-admin/login>

المسارات المختصرة `/admin` و`/teacher-panel` و`/teacher_admin_panel` تعمل بتحويل
`302` إلى صفحة الدخول المناسبة، على الخادم المحلي وعلى Vercel.

### بيانات الدخول التجريبية

| اللوحة | بيانات الدخول |
|---|---|
| الأدمن | `admin@physics.society` — `Admin@2026` (أو الهاتف `01000000009`) |
| المدرس الأول | `01100000001` — `teacher123` |
| المدرس الثاني | `01100000002` — `teacher123` |

### ما يمكن إدارته

- **الأدمن:** 71 صفحة أصلية، منها الرئيسية وآخر التحديثات والإحصائيات، الطلاب
  (بما فيها الملف الشخصي وإضافة طالب بكارت سنتر)، الكورسات والأقسام والفيديوهات
  والمذكرات والروابط، الفئات والكوبونات والعروض، بنوك الأسئلة والأسئلة والامتحانات،
  الاشتراكات والفواتير والدفع اليدوي وإلغاء الاشتراك، أكواد السنتر، الشهادات،
  منافذ البيع، تسجيلات الدخول، مجموعات المنتدى والمراجعة المتوازية، رسائل SMS
  والإشعارات العامة، وحسابات الإداريين وصلاحياتهم.
- **المدرس:** الرئيسية والإحصائيات، الاشتراكات، الفواتير، نتائج الامتحانات،
  ومراجعة الأسئلة المقالية — لكورساته فقط.
- المدرس لا يستطيع الوصول لبيانات مدرس آخر (يُختبر آليًا).

### مسارات API

| المسار | الوصف |
|---|---|
| `POST /api/auth/admin/login` | دخول الأدمن (ويقبل `/api/admin/auth/login`) |
| `POST /api/auth/teacher/login` | دخول المدرس (ويقبل `/api/teacher-panel/auth/login`) |
| `GET /api/admin_pages_allow` | صفحات اللوحة المسموح بها للأدمن |
| `GET /api/admin/secondary_email/status` | حالة الإيميل الاحتياطي (معطّلة في النسخة التجريبية) |
| `GET /api/statistic/:metric` | سلاسل الإحصائيات اليومية (`users-count`, `subscriptions-count`, …) |
| `GET /api/teacher/:id/:metric` | إحصائيات مدرس معيّن لصفحات الأدمن |
| `GET /api/teacher_admin_panel/teacher/statistics/:metric` | إحصائيات لوحة المدرس |
| `GET /api/users/paginate` | جدول المستخدمين |
| `GET /api/courses/paginate` | جدول الكورسات |
| `GET /api/exams/paginate` + `/questions/paginate` | جداول الامتحانات والأسئلة |
| `GET /api/subscriptions/paginate` + `/invoices/paginate` | جداول الاشتراكات والفواتير |
| `GET /api/teacher_admin_panel/subscriptions/paginate` | اشتراكات كورسات المدرس |
| `GET /api/teacher_admin_panel/invoices/paginate` | فواتير كورسات المدرس |
| `GET /api/teacher_admin_panel/exam_results/exam/paginate` | نتائج امتحانات المدرس |
| `GET /api/teacher_admin_panel/essay_questions/paginate` | الأسئلة المقالية للمراجعة |
| `GET /api/account_creation_requests/parallel_preview` | ملخص الطلبات قيد المراجعة |
| `GET /api/admin/overview` | إحصاءات المنصة (API اللوحة المحلي) |
| `GET/POST/PATCH /api/admin/students` | إدارة الطلاب |
| `GET/POST/PATCH /api/admin/teachers` | إدارة المدرسين |
| `GET/POST/PATCH /api/admin/subjects` | إدارة المواد |
| `GET/POST/PATCH/DELETE /api/admin/courses` | إدارة الكورسات |
| `POST /api/admin/courses/:id/sections` | أقسام الكورس |
| `POST /api/admin/sections/:id/lessons` | حصص القسم |
| `GET/POST /api/admin/qbanks` + `/questions` | بنوك الأسئلة |
| `GET/POST/PATCH/DELETE /api/admin/exams` | الامتحانات |
| `GET /api/admin/invoices` + `/pay` + `/cancel` | الفواتير |
| `GET/POST /api/admin/codes` + `/revoke` | أكواد الشحن |
| `GET/POST /api/admin/community` | اعتماد/رفض المنشورات |
| `GET/PATCH /api/admin/settings` | إعدادات المنصة |
| `GET /api/admin/audit` | سجل العمليات |
| `GET /api/teacher-panel/overview` | إحصاءات المدرس (API اللوحة المحلي) |
| `GET/POST /api/teacher-panel/grading/:id` | تصحيح المحاولات |
| `POST /api/teacher-panel/qa/:id/answer` | الرد على الأسئلة |
| `PATCH /api/teacher-panel/profile` | الملف الشخصي للمدرس |

كل مسارات اللوحة تتطلب `Authorization: Bearer <token>` وتُرجع `401` بدونه.
طبقة التوافق في `lib/legacy-panel.js` تحوّل بيانات المخزن إلى نفس أشكال الاستجابات
التي تتوقعها الواجهة الأصلية (جداول `{data,total}`، إحصائيات `{data:[...]}`،
وقوائم اختيارات `{value,text}`).

### تخزين البيانات

- محليًا: `.data/store.json` (مُستثنى من Git). احذفه لإعادة البيانات الابتدائية.
- على Vercel: `/tmp/physics-society-store.json`، أي أن تعديلات اللوحة تبقى أثناء
  عمر نسخة الدالة وتعود للبيانات الابتدائية عند إعادة التشغيل البارد. هذا قيد نسخة
  العرض التجريبية؛ للإنتاج الحقيقي استبدل `lib/store.js` بقاعدة بيانات دائمة.
- يمكن تحديد مسار آخر عبر `STORE_FILE=/path/to/store.json`.

---

## 4) الاختبارات

```bash
npm test
```

يشغّل `tools/smoke-test.js` خادمًا مؤقتًا على منفذ عشوائي ثم يتحقق من:

- `/api/health` والصفحة الرئيسية وملفات CSS/JS.
- خلو `index.html` من تتبّع Facebook/Hotjar/Cloudflare/GA.
- 12 مسار SPA عميق يرجع `index.html` (بما فيها المادة، المدرس، المتجر، والبحث).
- تسجيل الدخول الصحيح والخطأ، وتوكن الجلسة.
- كورسات الصف الثالث، تفاصيل الكورس، المحتوى، تفاصيل الحصة.
- كوبونات الخصم، إنشاء فاتورة تجريبية، إحصائيات المستخدم.
- تصنيفات المجتمع، المحافظات، الصفحات الثابتة، و404 للمحتوى غير الموجود.
- واجهات المادة والمدرس والبحث، وعدم وجود `width="auto"` في الحزمة.
- أن `vercel.json` يستثني `/static` و`/media` من إعادة الكتابة إلى `index.html`،
  ويحوّل المسارات المختصرة للوحات إلى مساراتها الأصلية.
- تحويلات `/admin` و`/teacher-panel` و`/teacher_admin_panel` (302)، وصفحة الدخول الأصلية.
- دخول الأدمن والمدرس، ورفض الوصول المجهول، ومنع المدرس من مسارات الأدمن.
- جداول اللوحة الأصلية (مستخدمين، كورسات، اشتراكات وفواتير المدرس، النتائج)،
  والإحصائيات، وصفحة المراجعة المتوازية، ودورة إضافة/تعديل طالب وتعديل الإعدادات.

نتيجة متوقعة: `✅ جميع الفحوصات ناجحة`.

---

## 5) البنية

```text
.
├── api/
│   ├── [...path].js          # نقطة دخول Vercel لكل /api/*
│   └── sanctum/csrf-cookie.js
├── data/                     # بيانات ثابتة (فروع، محافظات، تصنيفات)
├── lib/
│   ├── app.js                # خادم HTTP + الموجّه + معالجات واجهة الطالب
│   ├── data.js               # الكورسات، الأسابيع، الإحصائيات، مجتمع المنصة
│   ├── store.js              # مخزن JSON الدائم + بيانات اللوحات الابتدائية
│   ├── panel.js              # مسارات API للأدمن والمدرس + التوكن والصلاحيات
│   └── legacy-panel.js       # توافق واجهة اللوحات الأصلية مع المخزن المحلي
├── public/
│   ├── index.html            # هيكل CRA بعد إزالة أدوات التتبع
│   ├── static/               # حزمة React الأصلية + CSS + الوسائط
│   └── media/                # أغلفة الكورسات، صور المدرسين، مشغل تجريبي
├── tools/
│   ├── generate-assets.js    # توليد أغلفة SVG
│   └── smoke-test.js
├── server.js                 # التشغيل المحلي
└── vercel.json               # الدوال، إعادة الكتابة، الرؤوس الأمنية
```

### كيف تعمل الواجهة بدون خادم أصلي؟

الحزمة الأصلية كانت تنادي `https://api.mahmoud-magdy.com`. تم استبدال القاعدة بـ
سلسلة فارغة، فأصبحت كل الطلبات نسبية إلى نفس النطاق (`/api/...`). الخادم المحلي
يوفّر نفس أشكال الاستجابات المتوقعة، بما فيها:

- `POST /api/auth/login` → `{ is_logged_in, token, user }`
- `GET /api/sellables/year/:year` → بطاقات الكورسات
- `GET /api/sellables/:id` → تفاصيل الكورس
- `GET /api/sellables/course/:id/content` → `[{ id, name, sectionables: [...] }]`
- `GET /api/sellables/course/:id/sections/:s/sectionables/:x` → الحصة
- `POST /api/sellables/course/:id/subscribe_pre_request` → `{ previous_invoices: [] }`
- `POST /api/sellables/course/:id/validate_coupon` → `{ discount, message }`
- `POST /api/sellables/course/:id/subscribe_request` → `{ referenceNumber }`

---

## 6) النشر على Vercel

المشروع جاهز للنشر بدون خطوة بناء:

1. اربط المستودع بمشروع Vercel (Framework Preset: **Other**).
2. لا تضبط Build Command ولا Output Directory.
3. أضف `AUTH_SECRET` في Environment Variables (اختياري لكنه مستحسن).
4. Deploy.

`vercel.json` يضبط:

- دالة `api/[...path].js` بذاكرة 1024MB ومدة 15 ثانية ومنطقة `fra1`.
- إعادة كتابة كل المسارات غير `/api/` و`/sanctum/` و`/static/` و`/media/` إلى
  `index.html`، حتى تُرجع الأصول المفقودة `404` بدل صفحة HTML (مهم بعد تغيير اسم حزمة JS).
- تحويلات `302` من `/admin` و`/teacher-panel` و`/teacher_admin_panel` إلى مسارات
  اللوحات الأصلية `/magdy-mm-admin/login` و`/gohary-teacher-admin/login`.
- رؤوس أمان (`nosniff`, `SAMEORIGIN`, `Permissions-Policy`) و`noindex`.
- كاش طويل لـ `/static/*` ويومي لـ `/media/*`.

---

## 7) الفروق المعروفة عن الموقع الأصلي

| العنصر | الفرق | السبب |
|---|---|---|
| الفيديوهات | مشغل محلي ثابت بدل الفيديو الأصلي | المحتوى محمي بحقوق ولا يمكن إعادة نشره |
| الدفع | فاتورة تجريبية برقم مرجعي وهمي | لا توجد بوابة دفع حقيقية ولا تحصيل |
| الحسابات | حساب تجريبي واحد + طلب حساب | لا توجد قاعدة بيانات إنتاجية |
| المحتوى | بيانات تعليمية تجريبية | لا يمكن نسخ محتوى مدفوع |
| التتبع | Sentry وGA معطّلان | حماية الخصوصية وعدم إرسال بيانات |
| شارة «الأسئلة» | تعتمد على بيانات تجريبية | لا توجد إحصاءات أصلية |
| بيانات اللوحات | بيانات النسخة المحلية التجريبية | لا تتوفر بيانات المنصة الأصلية |
| حفظ تعديلات اللوحات | في ملف JSON محلي أو `/tmp` على Vercel | لا توجد قاعدة بيانات إنتاجية |
| صفحة «آخر التحديثات» | محتواها ثابت من حزمة الواجهة الأصلية | نص أصلي غير مرتبط بالـ API |

أي اختلافات بصرية دقيقة في الخطوط أو الأيقونات ترجع إلى تحميل أصول خارجية
(Google Fonts / Iconify)؛ التصميم يعمل حتى لو فشل تحميلها.

---

## 8) الخصوصية

- لا يُرسل أي طلب إلى `api.mahmoud-magdy.com`.
- لا يوجد Facebook Pixel أو Hotjar أو Cloudflare Insights أو Google Analytics فعّال.
- Sentry معطّل (`dsn: ""`).
- الصفحات تحمل `X-Robots-Tag: noindex, nofollow` و`robots.txt` يمنع الفهرسة.

---

## 9) الترخيص

كود إعادة البناء مرخّص تحت [MIT](LICENSE). الأسماء والعلامات والمواد التعليمية
ليست جزءًا من الترخيص وتبقى ملكًا لأصحابها.
