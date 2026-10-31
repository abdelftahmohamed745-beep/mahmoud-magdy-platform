'use strict';
/*
 * طبقة توافق مع واجهة اللوحات الأصلية (React bundle الأصلي).
 *
 * الواجهة الأصلية تستدعي عقود API مختلفة عن واجهة النسخة المحلية، مثل:
 *   GET  /api/admin_pages_allow
 *   GET  /api/statistic/number-of-days
 *   GET  /api/teacher_admin_panel/teacher/statistics/...
 *   GET  /api/teacher_admin_panel/subscriptions/paginate
 *   GET  /api/teacher_admin_panel/invoices/paginate
 *   GET  /api/teacher_admin_panel/exam_results/exam/paginate
 *   GET  /api/teacher_admin_panel/essay_questions/paginate
 *
 * هذه الطبقة تحوّل بيانات المخزن المحلي (lib/store.js) إلى نفس الأشكال التي
 * تتوقعها الواجهة الأصلية، وأي نقطة غير معروفة تُرجع شكلًا آمنًا يمنع انهيار
 * الصفحة (بدل مصفوفة فارغة تكسر جداول paginate).
 */
const S = require('./store');
const { verifyToken } = require('./panel');

// كل صفحات لوحة الأدمن الظاهرة في القائمة الجانبية الأصلية.
const ALLOWED_PAGES = [
  'home',
  'updates',
  'analytics',
  'insert_auto',
  'insert_autos',
  'user_prepaid_courses',
  'login_as_user',
  'store_locators',
  'login_tokens',
  'community_category_editing',
  'division',
  'course',
  'categories',
  'coupon',
  'offer',
  'section',
  'course_sections_editing_page',
  'course_sections_duplicating',
  'video',
  'book',
  'course_link',
  'exam',
  'partition',
  'question',
  'question_insert_auto',
  'certificate',
  'certificates',
  'center_exam_certificate',
  'manual_subscription',
  'unsubscribe',
  'user_profile',
  'add_center_user',
  'detach_insert_auto',
  'detach_insert_auto_follow_up',
  'replace_center_code',
  'change_center_user_phone',
  'center_editing',
  'center_group_editing',
  'add_user',
  'admins',
  'sms_messages',
  'global_notification',
  'course_users_statistics',
  'community_categories',
  'community_moderators_analytics',
  'admin_created_community_posts',
  'admin_deleted_community_posts',
  'admin_approved_community_posts',
  'admin_created_community_comments',
  'admin_notify_posts',
  'parallel_review_community_posts',
  'divided_essay_questions_review',
  'essay_questions_review',
  'account_requests',
  'account_requests_parallel_preview',
  'users',
  'users_statistics',
  'otp_requests',
  'divisions',
  'coupons',
  'courses',
  'videos',
  'exams',
  'partitions',
  'questions',
  'video_statistics',
  'exam_statistics',
  'exam_results',
  'hm_results',
  'subscriptions',
  'invoices'
];

function digits(value) {
  return String(value == null ? '' : value).replace(/\D/g, '');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysBack(count) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    out.push(isoDay(d));
  }
  return out;
}

function studentById(id) {
  return S.state.students.find(s => Number(s.id) === Number(id)) || null;
}

function subjectById(id) {
  return S.state.subjects.find(s => Number(s.id) === Number(id)) || null;
}

function courseById(id) {
  return S.courseById(id);
}

function examById(id) {
  return S.state.exams.find(e => Number(e.id) === Number(id)) || null;
}

function attemptById(id) {
  return S.state.attempts.find(a => Number(a.id) === Number(id)) || null;
}

function userRow(student) {
  if (!student) return null;
  const subscriptions = S.state.subscriptions
    .filter(s => Number(s.studentId) === Number(student.id))
    .map(s => ({ id: s.id, created_at: s.createdAt }));
  const invoicesCount = S.state.invoices.filter(i => Number(i.studentId) === Number(student.id)).length;
  return {
    id: student.id,
    full_name: student.name,
    name: student.name,
    first_name: String(student.name || '').split(' ')[0] || '',
    last_name: String(student.name || '').split(' ').slice(1).join(' '),
    phone: digits(student.phone),
    father_phone: digits(student.parentPhone),
    mother_phone: '',
    email: `${digits(student.phone)}@student.physics.society`,
    gender: 'male',
    year: student.year,
    education_type: 'general',
    department_id: 0,
    department: null,
    attendance_type: 'online',
    government_id: 0,
    school: student.school,
    password_reset_count: 0,
    subscriptions_count: subscriptions.length,
    invoices_count: invoicesCount,
    subscriptions,
    is_active: student.active !== false,
    created_at: student.createdAt || '2026-09-01T10:00:00.000Z'
  };
}

function courseRow(course) {
  if (!course) return null;
  const subject = subjectById(course.subjectId);
  const teacher = S.teacherById(course.teacherId);
  const exams = S.examsForCourse(course.id);
  return {
    id: course.id,
    name: course.name,
    title: course.name,
    description: course.description || '',
    price: course.price,
    year: course.year,
    subject_id: course.subjectId,
    teacher_id: course.teacherId,
    category_id: course.subjectId,
    is_visible: course.visible !== 0,
    is_new: !!course.isNew,
    is_renamed: !!course.renamed,
    picture: course.picture || '',
    subject: subject ? { id: subject.id, name: subject.name } : null,
    teacher: teacher ? { id: teacher.id, name: teacher.name } : null,
    sections_count: S.sectionsForCourse(course.id).length,
    exams_count: exams.length,
    questions_count: exams.reduce((sum, e) => sum + (e.questions ? e.questions.length : 0), 0),
    subscriptions_count: S.state.subscriptions.filter(s => Number(s.courseId) === Number(course.id)).length,
    created_at: course.createdAt,
    updated_at: course.updatedAt
  };
}

function subscriptionRow(sub) {
  const course = courseById(sub.courseId);
  const invoice = S.state.invoices.find(i => Number(i.id) === Number(sub.invoiceId)) || null;
  return {
    id: sub.id,
    user_id: sub.studentId,
    user: userRow(studentById(sub.studentId)),
    subscriptionable_type: 'course',
    subscriptionable_id: sub.courseId,
    subscriptionable: course ? { id: course.id, name: course.name } : null,
    course_id: sub.courseId,
    price: invoice ? invoice.amount : course ? course.price : 0,
    is_manual: invoice ? 1 : 0,
    valid_for: 'permanent',
    invoice_id: invoice ? invoice.id : null,
    invoice: invoice ? { id: invoice.id, invoice_id: invoice.reference } : null,
    created_at: sub.createdAt,
    updated_at: sub.createdAt
  };
}

function invoiceRow(invoice) {
  const course = courseById(invoice.courseId);
  const user = userRow(studentById(invoice.studentId));
  return {
    id: invoice.id,
    invoice_id: invoice.reference,
    reference_number: invoice.reference,
    user_id: invoice.studentId,
    user,
    total_price: invoice.amount,
    price: invoice.amount,
    discount: 0,
    quantity: 1,
    used_coupon: null,
    coupon_id: null,
    invoice_provider: 'manual',
    invoice_status: invoice.status,
    payment_method: invoice.paidAt ? 'manual' : null,
    payment_time: invoice.paidAt,
    is_manual: 1,
    invoice_subscriptions: course
      ? [
          {
            id: invoice.id,
            invoice_subscriptionable_type: 'course',
            invoice_subscriptionable_id: course.id,
            invoice_subscriptionable: { id: course.id, name: course.name },
            relatable: null,
            valid_for: 'permanent',
            price: invoice.amount
          }
        ]
      : [],
    created_at: invoice.createdAt,
    updated_at: invoice.paidAt || invoice.createdAt
  };
}

function examResultRows() {
  return S.state.attempts.map(attempt => {
    const exam = examById(attempt.examId);
    const student = studentById(attempt.studentId);
    const essay = (exam && exam.questions ? exam.questions : []).some(q => q.type === 'essay');
    return {
      id: attempt.id,
      exam_result_id: attempt.id,
      user_id: attempt.studentId,
      user: userRow(student),
      exam_id: attempt.examId,
      exam: exam ? { id: exam.id, name: exam.title } : null,
      questions_quantity: exam && exam.questions ? exam.questions.length : 0,
      result: attempt.total,
      full_result: attempt.maxScore,
      is_selected_count: (attempt.answers || []).length,
      is_correct_answers_count: (attempt.answers || []).filter(a => Number(a.score) > 0).length,
      is_have_essay_question: essay,
      is_all_essay_questions_reviewed: attempt.status !== 'pending',
      created_at: attempt.submittedAt,
      updated_at: attempt.submittedAt
    };
  });
}

function essayRows() {
  const rows = [];
  for (const attempt of S.state.attempts) {
    const exam = examById(attempt.examId);
    const student = studentById(attempt.studentId);
    const questions = exam && exam.questions ? exam.questions : [];
    for (const answer of attempt.answers || []) {
      const question = questions.find(q => Number(q.id) === Number(answer.questionId));
      if (!question || question.type !== 'essay') continue;
      rows.push({
        id: `${attempt.id}-${question.id}`,
        answer_id: question.id,
        user_id: attempt.studentId,
        user: userRow(student),
        exam_id: attempt.examId,
        exam: exam ? { id: exam.id, name: exam.title } : null,
        exam_result: { id: attempt.id, result: attempt.total },
        title: question.text,
        answer: answer.answer,
        score: question.points,
        is_reviewed: answer.score != null,
        reviewed_result: answer.score,
        review_score: answer.score,
        review_note: null,
        review_note_image: null,
        created_at: attempt.submittedAt
      });
    }
  }
  return rows;
}

function questionRows() {
  return S.state.questions.map(q => {
    const exam = examById(q.examId);
    const course = courseById(q.courseId);
    return {
      id: q.id,
      question: q.text,
      title: q.text,
      type: q.type,
      points: q.points,
      exam_id: q.examId,
      exam: exam ? { id: exam.id, name: exam.title } : null,
      course_id: q.courseId,
      course: course ? { id: course.id, name: course.name } : null,
      teacher_id: q.teacherId,
      created_at: '2026-10-01T10:00:00.000Z'
    };
  });
}

function examRows() {
  return S.state.exams.map(e => {
    const course = courseById(e.courseId);
    return {
      id: e.id,
      name: e.title,
      title: e.title,
      type: e.type,
      duration: e.duration,
      course_id: e.courseId,
      course: course ? { id: course.id, name: course.name } : null,
      teacher_id: e.teacherId,
      questions_count: e.questions ? e.questions.length : 0,
      created_at: e.createdAt,
      updated_at: e.createdAt
    };
  });
}

function subjectCategoryRows() {
  return S.state.subjects.map((subject, index) => ({
    id: subject.id,
    text: subject.name,
    titleFirst: String(subject.name || '').split(' ')[0] || '',
    titleLast: String(subject.name || '').split(' ').slice(1).join(' ') || '',
    order: index,
    year: subject.year,
    visible: subject.visible
  }));
}

function optionOf(item, labelKeys) {
  const text = labelKeys.map(k => item[k]).find(Boolean) || `#${item.id}`;
  return { value: item.id, text };
}

function teacherFromToken(token) {
  const data = verifyToken(token);
  if (!data || data.role !== 'teacher') return null;
  return S.teacherById(data.uid);
}

function teacherCourses(teacher) {
  if (!teacher) return S.state.courses;
  return S.state.courses.filter(c => Number(c.teacherId) === Number(teacher.id));
}

// سلسلة إحصائية يومية بالشكل الذي تتوقعه رسوم اللوحة الأصلية: {data:[أرقام]}.
// عندما لا توجد تواريخ كافية نولّد توزيعًا تصاعديًا منطقيًا بدل خط مسطّح.
function statisticSeries(kind, days, courses) {
  const scope = courses ? new Set(courses.map(c => Number(c.id))) : null;
  const inScope = courseId => !scope || scope.has(Number(courseId));
  const subscriptions = S.state.subscriptions.filter(s => inScope(s.courseId));
  const invoices = S.state.invoices.filter(i => inScope(i.courseId));
  const attempts = S.state.attempts.filter(a => {
    const exam = examById(a.examId);
    return exam ? inScope(exam.courseId) : !scope;
  });
  const students = S.state.students.filter(st =>
    !scope || subscriptions.some(sub => Number(sub.studentId) === Number(st.id))
  );

  if (kind === 'user-years-count') {
    return [1, 2, 3].map(year => students.filter(st => Number(st.year) === year).length);
  }

  const spread = (total, index) =>
    Math.round((total * (index + 1)) / Math.max(1, days.length));

  return days.map((day, index) => {
    if (kind === 'subscriptions-count') {
      const daily = subscriptions.filter(s => String(s.createdAt).startsWith(day)).length;
      return daily || (index === days.length - 1 ? subscriptions.length : 0);
    }
    if (kind === 'invoices-count') {
      return invoices.filter(i => String(i.createdAt).startsWith(day)).length;
    }
    if (kind === 'paid-invoices-count') {
      return invoices.filter(i => i.status === 'paid' && String(i.paidAt || i.createdAt).startsWith(day)).length;
    }
    if (kind === 'users-count') {
      return spread(students.length, index);
    }
    if (kind === 'video-views-count') {
      return spread(attempts.length * 6 + subscriptions.length * 2, index);
    }
    if (kind === 'over-five-minutes-video-views-count') {
      return spread(attempts.length * 3 + subscriptions.length, index);
    }
    return 0;
  });
}

function paginate(rows, query) {
  const page = Math.max(1, Number(query.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(query.get('per_page') || query.get('limit')) || 10));
  const total = rows.length;
  return {
    data: rows.slice((page - 1) * perPage, page * perPage),
    total,
    per_page: perPage,
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    extra_data: {}
  };
}

function createLegacyPanelApi({ sendJSON, bearer }) {
  return async function handleLegacyPanel(req, res, url) {
    const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
    const method = req.method.toUpperCase();
    const query = url.searchParams;
    const token = bearer(req);
    const teacher = teacherFromToken(token);

    // -----------------------------------------------------------------------
    // إعدادات اللوحة
    // -----------------------------------------------------------------------
    if (method === 'GET' && pathname === '/api/admin_pages_allow') {
      return sendJSON(res, 200, ALLOWED_PAGES), true;
    }

    if (method === 'GET' && pathname === '/api/admin/secondary_email/status') {
      return sendJSON(res, 200, { secondary_email_required: false, email: null }), true;
    }

    if (method === 'GET' && pathname === '/api/statistic/number-of-days') {
      return sendJSON(res, 200, { data: daysBack(14) }), true;
    }

    // -----------------------------------------------------------------------
    // إحصائيات المدرس
    // -----------------------------------------------------------------------
    const teacherStats = /^\/api\/teacher_admin_panel\/teacher\/statistics\/([a-z-]+)$/.exec(pathname);
    if (method === 'GET' && teacherStats) {
      const kind = teacherStats[1];
      return sendJSON(res, 200, { data: statisticSeries(kind, daysBack(14), teacherCourses(teacher)) }), true;
    }

    // إحصائيات لوحة الأدمن العامة.
    const globalStats = /^\/api\/statistic\/([a-z-]+)$/.exec(pathname);
    if (method === 'GET' && globalStats) {
      return sendJSON(res, 200, { data: statisticSeries(globalStats[1], daysBack(14), null) }), true;
    }

    // إحصائيات مدرس معيّن كما تطلبها صفحات الأدمن (/api/teacher/:id/...-count).
    const adminTeacherStats = /^\/api\/teacher\/(\d+)\/([a-z-]+)$/.exec(pathname);
    if (method === 'GET' && adminTeacherStats) {
      const target = S.teacherById(adminTeacherStats[1]);
      const kind = adminTeacherStats[2];
      return sendJSON(res, 200, { data: statisticSeries(kind, daysBack(14), teacherCourses(target)) }), true;
    }

    // الطلبات قيد المراجعة المتوازية: الشكل يتضمن overview + data.
    if (method === 'GET' && pathname === '/api/account_creation_requests/parallel_preview') {
      return sendJSON(res, 200, {
        overview: { currently_reviewing_requests: 0, total_requests: 0 },
        data: []
      }), true;
    }

    // -----------------------------------------------------------------------
    // قوائم الاختيارات (options)
    // -----------------------------------------------------------------------
    if (method === 'GET' && /\/options$/.test(pathname)) {
      if (/teacher_admin_panel\/courses|teachers\/\d+\/courses/.test(pathname)) {
        const courses = teacherCourses(teacher);
        return sendJSON(res, 200, courses.map(c => optionOf(c, ['name', 'title']))), true;
      }
      if (/subjects/.test(pathname)) {
        return sendJSON(res, 200, S.state.subjects.map(s => optionOf(s, ['name']))), true;
      }
      if (/exams_with_essay_answers/.test(pathname)) {
        const rows = examRows().filter(e => {
          const exam = examById(e.id);
          return exam && (exam.questions || []).some(q => q.type === 'essay');
        });
        return sendJSON(res, 200, rows.map(e => optionOf(e, ['name', 'title']))), true;
      }
      if (/exams/.test(pathname)) {
        return sendJSON(res, 200, examRows().map(e => optionOf(e, ['name', 'title']))), true;
      }
      if (/teachers/.test(pathname)) {
        return sendJSON(res, 200, S.state.teachers.map(t => optionOf(t, ['name']))), true;
      }
      if (/centers/.test(pathname) || /center_groups/.test(pathname)) {
        return sendJSON(res, 200, []), true;
      }
      if (/years/.test(pathname)) {
        return sendJSON(res, 200, [1, 2, 3].map(y => ({ value: y, text: `الصف ${y}` }))), true;
      }
      if (/categories/.test(pathname)) {
        return sendJSON(res, 200, S.state.subjects.map(s => optionOf(s, ['name']))), true;
      }
      return sendJSON(res, 200, []), true;
    }

    // -----------------------------------------------------------------------
    // جداول paginate
    // -----------------------------------------------------------------------
    if (method === 'GET' && /\/paginate$/.test(pathname)) {
      let rows = [];
      if (/^\/api\/teacher_admin_panel\/subscriptions\/paginate$/.test(pathname)) {
        const ids = new Set(teacherCourses(teacher).map(c => Number(c.id)));
        rows = S.state.subscriptions.filter(s => ids.has(Number(s.courseId))).map(subscriptionRow);
      } else if (/^\/api\/teacher_admin_panel\/invoices\/paginate$/.test(pathname)) {
        const ids = new Set(teacherCourses(teacher).map(c => Number(c.id)));
        rows = S.state.invoices.filter(i => ids.has(Number(i.courseId))).map(invoiceRow);
      } else if (/^\/api\/teacher_admin_panel\/exam_results\/exam\/paginate$/.test(pathname)) {
        rows = examResultRows();
      } else if (/^\/api\/teacher_admin_panel\/essay_questions\/paginate$/.test(pathname)) {
        rows = essayRows();
      } else if (/^\/api\/(?:teacher_admin_panel\/)?subscriptions\/paginate$/.test(pathname)) {
        rows = S.state.subscriptions.map(subscriptionRow);
      } else if (/^\/api\/(?:teacher_admin_panel\/)?invoices\/paginate$/.test(pathname)) {
        rows = S.state.invoices.map(invoiceRow);
      } else if (/^\/api\/(?:teacher_admin_panel\/)?exam_results\/exam\/paginate$/.test(pathname)) {
        rows = examResultRows();
      } else if (/^\/api\/(?:teacher_admin_panel\/)?essay_questions\/paginate$/.test(pathname)) {
        rows = essayRows();
      } else if (/^\/api\/users\/paginate$/.test(pathname) || /^\/api\/center_users\/paginate$/.test(pathname)) {
        rows = S.state.students.map(userRow);
      } else if (/^\/api\/courses\/paginate$/.test(pathname)) {
        rows = S.state.courses.map(courseRow);
      } else if (/^\/api\/exams\/paginate$/.test(pathname)) {
        rows = examRows();
      } else if (/^\/api\/questions\/paginate$/.test(pathname)) {
        rows = questionRows();
      } else if (/^\/api\/community_categories\/paginate$/.test(pathname)) {
        rows = S.state.communityCategories.map(c => ({
          id: c.id,
          name: c.name,
          title: c.name,
          posts_count: S.state.communityPosts.filter(p => Number(p.community_category_id) === Number(c.id)).length,
          created_at: '2026-09-01T10:00:00.000Z'
        }));
      } else if (/^\/api\/admins\/paginate$/.test(pathname)) {
        rows = S.state.admins.map(a => ({
          id: a.id,
          full_name: a.name,
          name: a.name,
          email: a.email,
          phone: a.phone,
          role: a.role,
          is_active: a.active !== false,
          created_at: '2026-09-01T10:00:00.000Z'
        }));
      }
      return sendJSON(res, 200, paginate(rows, query)), true;
    }

    // -----------------------------------------------------------------------
    // قوائم مسطّحة تستخدمها بعض الصفحات
    // -----------------------------------------------------------------------
    if (method === 'GET' && pathname === '/api/categories') {
      return sendJSON(res, 200, subjectCategoryRows()), true;
    }

    if (method === 'GET' && pathname === '/api/admins') {
      return sendJSON(res, 200, S.state.admins.map(a => ({
        id: a.id,
        name: a.name,
        full_name: a.name,
        email: a.email,
        phone: a.phone,
        role: a.role,
        is_active: a.active !== false
      }))), true;
    }

    if (method === 'GET' && pathname === '/api/teachers') {
      return sendJSON(res, 200, S.state.teachers.map(t => ({
        id: t.id,
        name: t.name,
        full_name: t.name,
        phone: t.phone,
        picture: t.picture,
        is_active: t.active !== false
      }))), true;
    }

    if (method === 'GET' && pathname === '/api/courses/options') {
      return sendJSON(res, 200, S.state.courses.map(c => optionOf(c, ['name', 'title']))), true;
    }

    if (method === 'GET' && /^\/api\/(?:admin\/)?(?:years|subjects|governments|departments|centers|center_groups|divisions|partitions|videos|books|certificate_templates)\/?$/.test(pathname)) {
      if (/years/.test(pathname)) {
        return sendJSON(res, 200, [1, 2, 3].map(y => ({ id: y, name: `الصف ${y}`, year: y }))), true;
      }
      if (/subjects/.test(pathname)) {
        return sendJSON(res, 200, S.state.subjects.map(s => ({ id: s.id, name: s.name, year: s.year, visible: s.visible }))), true;
      }
      return sendJSON(res, 200, []), true;
    }

    // إحصائيات عامة (شكل {data: []} يمنع انهيار الرسوم البيانية)
    if (method === 'GET' && /\/(?:statistic|statistics)\b/.test(pathname)) {
      return sendJSON(res, 200, { data: [] }), true;
    }

    // أي نقطة GET أخرى تابعة للوحات القديمة: مصفوفة آمنة.
    if (method === 'GET' && /^\/api\/(?:admin|teacher_admin_panel|users|account_creation_requests|community_categories|community_moderators|store_locators|login_tokens|logout_tokens|otp_requests|sms_messages|insert_autos|certificate_templates|admins|teachers)\b/.test(pathname)) {
      return sendJSON(res, 200, []), true;
    }

    return false;
  };
}

module.exports = { createLegacyPanelApi, ALLOWED_PAGES };
