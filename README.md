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
| نشر على Vercel + دالة Serverless لكل `/api/*` | ✅ |

كل بيانات المنصة (الكورسات، الأسابيع، المدرسون، المجتمعات، الفروع) محلية داخل
`data/` و`lib/data.js`، ولا يوجد أي اتصال بخوادم المنصة الأصلية.

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

## 3) الاختبارات

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
- أن `vercel.json` يستثني `/static` و`/media` من إعادة الكتابة إلى `index.html`.

نتيجة متوقعة: `✅ جميع الفحوصات ناجحة`.

---

## 4) البنية

```text
.
├── api/
│   ├── [...path].js          # نقطة دخول Vercel لكل /api/*
│   └── sanctum/csrf-cookie.js
├── data/                     # بيانات ثابتة (فروع، محافظات، تصنيفات)
├── lib/
│   ├── app.js                # خادم HTTP + الموجّه + كل معالجات API
│   └── data.js               # الكورسات، الأسابيع، الإحصائيات، مجتمع المنصة
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

## 5) النشر على Vercel

المشروع جاهز للنشر بدون خطوة بناء:

1. اربط المستودع بمشروع Vercel (Framework Preset: **Other**).
2. لا تضبط Build Command ولا Output Directory.
3. أضف `AUTH_SECRET` في Environment Variables (اختياري لكنه مستحسن).
4. Deploy.

`vercel.json` يضبط:

- دالة `api/[...path].js` بذاكرة 1024MB ومدة 15 ثانية ومنطقة `fra1`.
- إعادة كتابة كل المسارات غير `/api/` و`/sanctum/` و`/static/` و`/media/` إلى `index.html`،
  حتى تُرجع الأصول المفقودة `404` بدل صفحة HTML (مهم بعد تغيير اسم حزمة JS).
- رؤوس أمان (`nosniff`, `SAMEORIGIN`, `Permissions-Policy`) و`noindex`.
- كاش طويل لـ `/static/*` ويومي لـ `/media/*`.

---

## 6) الفروق المعروفة عن الموقع الأصلي

| العنصر | الفرق | السبب |
|---|---|---|
| الفيديوهات | مشغل محلي ثابت بدل الفيديو الأصلي | المحتوى محمي بحقوق ولا يمكن إعادة نشره |
| الدفع | فاتورة تجريبية برقم مرجعي وهمي | لا توجد بوابة دفع حقيقية ولا تحصيل |
| الحسابات | حساب تجريبي واحد + طلب حساب | لا توجد قاعدة بيانات إنتاجية |
| المحتوى | بيانات تعليمية تجريبية | لا يمكن نسخ محتوى مدفوع |
| التتبع | Sentry وGA معطّلان | حماية الخصوصية وعدم إرسال بيانات |
| شارة «الأسئلة» | تعتمد على بيانات تجريبية | لا توجد إحصاءات أصلية |

أي اختلافات بصرية دقيقة في الخطوط أو الأيقونات ترجع إلى تحميل أصول خارجية
(Google Fonts / Iconify)؛ التصميم يعمل حتى لو فشل تحميلها.

---

## 7) الخصوصية

- لا يُرسل أي طلب إلى `api.mahmoud-magdy.com`.
- لا يوجد Facebook Pixel أو Hotjar أو Cloudflare Insights أو Google Analytics فعّال.
- Sentry معطّل (`dsn: ""`).
- الصفحات تحمل `X-Robots-Tag: noindex, nofollow` و`robots.txt` يمنع الفهرسة.

---

## 8) الترخيص

كود إعادة البناء مرخّص تحت [MIT](LICENSE). الأسماء والعلامات والمواد التعليمية
ليست جزءًا من الترخيص وتبقى ملكًا لأصحابها.
