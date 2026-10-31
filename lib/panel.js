'use strict';
/*
 * واجهة API للوحات الأدمن والمدرس.
 *
 * كل المسارات محمية بتوكن موقّع (HMAC) ويحمل الدور، وتعمل فوق مخزن
 * lib/store.js نفسه الذي تقرأ منه واجهة الطالب، فأي تعديل يظهر فورًا.
 */
const crypto = require('node:crypto');
const S = require('./store');

const AUTH_SECRET = process.env.AUTH_SECRET || 'mahmoud-magdy-demo-auth-2026';
const TOKEN_TTL = 12 * 60 * 60 * 1000;

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function issueToken(role, id, extra = {}) {
  const payload = b64url(JSON.stringify({ uid: id, role, exp: Date.now() + TOKEN_TTL, ...extra }));
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

function normalizePhone(value) {
  return String(value == null ? '' : value).replace(/\D/g, '').replace(/^0+/, '');
}

function digits(value) {
  return String(value == null ? '' : value).replace(/\D/g, '');
}

function paginate(list, query, defaultLimit = 20) {
  const page = Math.max(1, Number(query.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.get('limit')) || defaultLimit));
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const data = list.slice((page - 1) * limit, page * limit);
  return { data, total, page, pages, limit };
}

function matches(text, q) {
  if (!q) return true;
  return String(text || '').toLowerCase().includes(String(q).toLowerCase());
}

function courseTitle(id) {
  const c = S.courseById(id);
  return c ? c.name : '—';
}

function studentName(id) {
  const s = S.state.students.find(x => Number(x.id) === Number(id));
  return s ? s.name : '—';
}

function teacherName(id) {
  const t = S.teacherById(id);
  return t ? t.name : '—';
}

function courseAdminRow(course) {
  const lessons = S.sectionsForCourse(course.id).reduce((sum, s) => sum + s.lessons.length, 0);
  const exams = S.examsForCourse(course.id).length;
  const students = S.state.subscriptions.filter(s => Number(s.courseId) === Number(course.id)).length;
  return {
    ...course,
    teacherName: teacherName(course.teacherId),
    subjectName: (S.subjectById(course.subjectId) || {}).name || '—',
    lessons,
    exams,
    students
  };
}

function createPanelApi({ sendJSON, readBody, parseRequestBody, bearer }) {
  const routes = [];
  const route = (method, pattern, handler, role) => {
    routes.push({ method, pattern, handler, role: role || null });
  };

  // -------------------------------------------------------------------------
  // مساعدات
  // -------------------------------------------------------------------------

  function fail(res, status, message, errors) {
    return sendJSON(res, status, { message, ...(errors ? { errors } : {}) });
  }

  function requireFields(body, fields) {
    const errors = {};
    for (const field of fields) {
      if (body[field] == null || String(body[field]).trim() === '') errors[field] = ['هذا الحقل مطلوب.'];
    }
    return Object.keys(errors).length ? errors : null;
  }

  async function bodyOf(req) {
    const buf = await readBody(req).catch(() => Buffer.alloc(0));
    return parseRequestBody(req, buf);
  }

  function actorFor(req) {
    const token = verifyToken(bearer(req));
    if (!token) return null;
    if (token.role === 'admin') {
      const admin = S.state.admins.find(a => Number(a.id) === Number(token.uid) && a.active !== false);
      return admin ? { role: 'admin', id: admin.id, name: admin.name, entity: admin } : null;
    }
    if (token.role === 'teacher') {
      const teacher = S.teacherById(token.uid);
      return teacher && teacher.active !== false
        ? { role: 'teacher', id: teacher.id, name: teacher.name, entity: teacher }
        : null;
    }
    return null;
  }

  function guard(actor, res, role) {
    if (!actor) {
      fail(res, 401, 'الجلسة منتهية أو غير صالحة. سجّل الدخول من جديد.');
      return false;
    }
    if (role && actor.role !== role) {
      fail(res, 403, 'لا تملك صلاحية لهذا الإجراء.');
      return false;
    }
    return true;
  }

  function ownCourse(actor, id) {
    const course = S.courseById(id);
    if (!course) return null;
    if (actor.role === 'teacher' && Number(course.teacherId) !== Number(actor.id)) return null;
    return course;
  }

  // -------------------------------------------------------------------------
  // المصادقة
  // -------------------------------------------------------------------------

  route('POST', /^\/api\/(?:admin\/auth|auth\/admin)\/login$/, async ({ req, res }) => {
    const body = await bodyOf(req);
    const identifier = String(body.email || body.phone || '').trim();
    const password = String(body.password || '');
    const admin = S.state.admins.find(
      a =>
        a.active !== false &&
        (a.email.toLowerCase() === identifier.toLowerCase() ||
          (identifier && normalizePhone(a.phone) === normalizePhone(identifier))) &&
        a.password === password
    );
    if (!admin) return fail(res, 422, 'بيانات الدخول غير صحيحة.', { email: ['بيانات الدخول غير صحيحة.'] });
    S.audit(`admin:${admin.name}`, 'login', 'تسجيل دخول للوحة الأدمن');
    S.save();
    const user = {
      id: admin.id,
      name: admin.name,
      full_name: admin.name,
      first_name: String(admin.name).split(' ')[0] || '',
      last_name: String(admin.name).split(' ').slice(1).join(' '),
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      is_super_admin: true
    };
    return sendJSON(res, 200, {
      is_logged_in: true,
      token: issueToken('admin', admin.id),
      user,
      admin: user
    });
  });

  route('POST', /^\/api\/(?:admin\/auth|auth\/admin)\/logout$/, async ({ res }) => {
    return sendJSON(res, 200, { message: 'تم تسجيل الخروج.' });
  });

  route('GET', /^\/api\/(?:admin\/auth|auth\/admin)\/me$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    return sendJSON(res, 200, {
      admin: { id: actor.entity.id, name: actor.entity.name, email: actor.entity.email, role: actor.entity.role }
    });
  }, 'admin');

  route('POST', /^\/api\/(?:teacher-panel\/auth|auth\/teacher)\/login$/, async ({ req, res }) => {
    const body = await bodyOf(req);
    const phone = normalizePhone(body.phone || body.email);
    const password = String(body.password || '');
    const teacher = S.state.teachers.find(
      t => t.active !== false && normalizePhone(t.phone) === phone && t.password === password
    );
    if (!teacher) return fail(res, 422, 'رقم الهاتف أو كلمة المرور غير صحيحة.', { phone: ['بيانات الدخول غير صحيحة.'] });
    S.audit(`teacher:${teacher.name}`, 'login', 'تسجيل دخول للوحة المدرس');
    S.save();
    const user = {
      id: teacher.id,
      name: teacher.name,
      full_name: teacher.name,
      first_name: String(teacher.name).split(' ')[0] || '',
      last_name: String(teacher.name).split(' ').slice(1).join(' '),
      phone: teacher.phone,
      email: teacher.email || `${normalizePhone(teacher.phone)}@teacher.physics.society`,
      picture: teacher.picture
    };
    return sendJSON(res, 200, {
      is_logged_in: true,
      token: issueToken('teacher', teacher.id),
      user,
      teacher: user
    });
  });

  route('POST', /^\/api\/(?:teacher-panel\/auth|auth\/teacher)\/logout$/, async ({ res }) => {
    return sendJSON(res, 200, { message: 'تم تسجيل الخروج.' });
  });

  route('GET', /^\/api\/(?:teacher-panel\/auth|auth\/teacher)\/me$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const t = actor.entity;
    return sendJSON(res, 200, {
      teacher: { id: t.id, name: t.name, phone: t.phone, description: t.description, picture: t.picture }
    });
  }, 'teacher');

  // -------------------------------------------------------------------------
  // نظرة عامة — أدمن
  // -------------------------------------------------------------------------

  route('GET', /^\/api\/admin\/overview$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const paid = S.state.invoices.filter(i => i.status === 'paid');
    const recentInvoices = S.state.invoices
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 6)
      .map(i => ({ ...i, studentName: studentName(i.studentId), courseName: courseTitle(i.courseId) }));
    return sendJSON(res, 200, {
      stats: {
        students: S.state.students.length,
        activeStudents: S.state.students.filter(s => s.active).length,
        teachers: S.state.teachers.length,
        subjects: S.state.subjects.length,
        courses: S.state.courses.length,
        subscriptions: S.state.subscriptions.length,
        revenue: paid.reduce((sum, i) => sum + Number(i.amount || 0), 0),
        pendingInvoices: S.state.invoices.filter(i => i.status === 'pending').length,
        pendingPosts: S.state.communityPosts.filter(p => !p.is_approved).length,
        openQa: S.state.qa.filter(q => q.status === 'open').length
      },
      recentInvoices,
      recentAudit: S.state.audit.slice(0, 6)
    });
  }, 'admin');

  // -------------------------------------------------------------------------
  // الطلاب
  // -------------------------------------------------------------------------

  route('GET', /^\/api\/admin\/students$/, async ({ res, query, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const q = query.get('q') || '';
    const year = query.get('year') || '';
    const status = query.get('status') || '';
    let list = S.state.students.filter(
      s => matches(s.name, q) || matches(s.phone, q)
    );
    if (year) list = list.filter(s => String(s.year) === String(year));
    if (status === 'active') list = list.filter(s => s.active);
    if (status === 'inactive') list = list.filter(s => !s.active);
    const enriched = list.map(s => ({
      ...s,
      subscriptions: S.state.subscriptions.filter(x => Number(x.studentId) === Number(s.id)).length,
      paid: S.state.invoices
        .filter(i => Number(i.studentId) === Number(s.id) && i.status === 'paid')
        .reduce((sum, i) => sum + Number(i.amount || 0), 0)
    }));
    return sendJSON(res, 200, paginate(enriched, query));
  }, 'admin');

  route('POST', /^\/api\/admin\/students$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const body = await bodyOf(req);
    const errors = requireFields(body, ['name', 'phone']);
    if (errors) return fail(res, 422, 'راجع الحقول المطلوبة.', errors);
    const phone = digits(body.phone);
    if (S.state.students.some(s => digits(s.phone) === phone)) {
      return fail(res, 422, 'رقم الهاتف مسجّل بالفعل.', { phone: ['رقم الهاتف مسجّل بالفعل.'] });
    }
    const student = {
      id: S.nextId(S.state.students),
      name: String(body.name).trim(),
      phone,
      parentPhone: digits(body.parentPhone || ''),
      year: Number(body.year) || 3,
      school: String(body.school || '').trim(),
      active: body.active === undefined ? true : !!body.active,
      createdAt: S.nowISO()
    };
    S.state.students.push(student);
    S.audit(`admin:${actor.name}`, 'student.create', `إضافة الطالب ${student.name}`);
    S.save();
    return sendJSON(res, 201, { student });
  }, 'admin');

  route('PATCH', /^\/api\/admin\/students\/(\d+)$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const student = S.state.students.find(s => Number(s.id) === Number(params[0]));
    if (!student) return fail(res, 404, 'الطالب غير موجود.');
    const body = await bodyOf(req);
    if (body.name !== undefined) student.name = String(body.name).trim() || student.name;
    if (body.phone !== undefined) student.phone = digits(body.phone) || student.phone;
    if (body.parentPhone !== undefined) student.parentPhone = digits(body.parentPhone);
    if (body.year !== undefined) student.year = Number(body.year) || student.year;
    if (body.school !== undefined) student.school = String(body.school);
    if (body.active !== undefined) student.active = !!body.active;
    S.audit(`admin:${actor.name}`, 'student.update', `تعديل الطالب ${student.name}`);
    S.save();
    return sendJSON(res, 200, { student });
  }, 'admin');

  // -------------------------------------------------------------------------
  // المدرسون
  // -------------------------------------------------------------------------

  route('GET', /^\/api\/admin\/teachers$/, async ({ res, query, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const q = query.get('q') || '';
    const list = S.state.teachers
      .filter(t => matches(t.name, q) || matches(t.phone, q))
      .map(t => ({
        ...t,
        password: undefined,
        courses: S.state.courses.filter(c => Number(c.teacherId) === Number(t.id)).length,
        students: new Set(
          S.state.subscriptions
            .filter(s => {
              const c = S.courseById(s.courseId);
              return c && Number(c.teacherId) === Number(t.id);
            })
            .map(s => s.studentId)
        ).size
      }));
    return sendJSON(res, 200, { data: list, total: list.length });
  }, 'admin');

  route('POST', /^\/api\/admin\/teachers$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const body = await bodyOf(req);
    const errors = requireFields(body, ['name', 'phone', 'password']);
    if (errors) return fail(res, 422, 'راجع الحقول المطلوبة.', errors);
    const teacher = {
      id: S.nextId(S.state.teachers),
      name: String(body.name).trim(),
      phone: digits(body.phone),
      password: String(body.password),
      description: String(body.description || ''),
      picture: String(body.picture || 'media/teacher-1.svg'),
      visible: body.visible === undefined ? 1 : Number(body.visible) ? 1 : 0,
      active: true,
      createdAt: S.nowISO()
    };
    S.state.teachers.push(teacher);
    S.audit(`admin:${actor.name}`, 'teacher.create', `إضافة المدرس ${teacher.name}`);
    S.save();
    return sendJSON(res, 201, { teacher: { ...teacher, password: undefined } });
  }, 'admin');

  route('PATCH', /^\/api\/admin\/teachers\/(\d+)$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const teacher = S.teacherById(params[0]);
    if (!teacher) return fail(res, 404, 'المدرس غير موجود.');
    const body = await bodyOf(req);
    if (body.name !== undefined) teacher.name = String(body.name).trim() || teacher.name;
    if (body.phone !== undefined) teacher.phone = digits(body.phone) || teacher.phone;
    if (body.description !== undefined) teacher.description = String(body.description);
    if (body.password) teacher.password = String(body.password);
    if (body.visible !== undefined) teacher.visible = Number(body.visible) ? 1 : 0;
    if (body.active !== undefined) teacher.active = !!body.active;
    S.audit(`admin:${actor.name}`, 'teacher.update', `تعديل المدرس ${teacher.name}`);
    S.save();
    return sendJSON(res, 200, { teacher: { ...teacher, password: undefined } });
  }, 'admin');

  // -------------------------------------------------------------------------
  // المواد
  // -------------------------------------------------------------------------

  route('GET', /^\/api\/admin\/subjects$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const list = S.state.subjects.map(s => ({
      ...s,
      courses: S.state.courses.filter(c => Number(c.subjectId) === Number(s.id)).length,
      teachers: s.teacherIds.length
    }));
    return sendJSON(res, 200, { data: list, total: list.length });
  }, 'admin');

  route('POST', /^\/api\/admin\/subjects$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const body = await bodyOf(req);
    const errors = requireFields(body, ['name']);
    if (errors) return fail(res, 422, 'راجع الحقول المطلوبة.', errors);
    const subject = {
      id: S.nextId(S.state.subjects),
      name: String(body.name).trim(),
      year: Number(body.year) || 3,
      visible: body.visible === undefined ? 1 : Number(body.visible) ? 1 : 0,
      description: String(body.description || ''),
      teacherIds: Array.isArray(body.teacherIds) ? body.teacherIds.map(Number) : []
    };
    S.state.subjects.push(subject);
    S.audit(`admin:${actor.name}`, 'subject.create', `إضافة المادة ${subject.name}`);
    S.save();
    return sendJSON(res, 201, { subject });
  }, 'admin');

  route('PATCH', /^\/api\/admin\/subjects\/(\d+)$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const subject = S.subjectById(params[0]);
    if (!subject) return fail(res, 404, 'المادة غير موجودة.');
    const body = await bodyOf(req);
    if (body.name !== undefined) subject.name = String(body.name).trim() || subject.name;
    if (body.year !== undefined) subject.year = Number(body.year) || subject.year;
    if (body.description !== undefined) subject.description = String(body.description);
    if (body.visible !== undefined) subject.visible = Number(body.visible) ? 1 : 0;
    if (Array.isArray(body.teacherIds)) subject.teacherIds = body.teacherIds.map(Number);
    S.audit(`admin:${actor.name}`, 'subject.update', `تعديل المادة ${subject.name}`);
    S.save();
    return sendJSON(res, 200, { subject });
  }, 'admin');

  // -------------------------------------------------------------------------
  // الكورسات + المحتوى
  // -------------------------------------------------------------------------

  route('GET', /^\/api\/admin\/courses$/, async ({ res, query, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const q = query.get('q') || '';
    const year = query.get('year') || '';
    let list = S.state.courses.filter(c => matches(c.name, q));
    if (year) list = list.filter(c => String(c.year) === String(year));
    const rows = list.map(courseAdminRow);
    return sendJSON(res, 200, { data: rows, total: rows.length });
  }, 'admin');

  route('POST', /^\/api\/admin\/courses$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const body = await bodyOf(req);
    const errors = requireFields(body, ['name', 'subjectId', 'teacherId']);
    if (errors) return fail(res, 422, 'راجع الحقول المطلوبة.', errors);
    if (!S.subjectById(body.subjectId)) return fail(res, 422, 'المادة غير موجودة.');
    if (!S.teacherById(body.teacherId)) return fail(res, 422, 'المدرس غير موجود.');
    const id = S.nextId(S.state.courses);
    const course = {
      id,
      name: String(body.name).trim(),
      description: String(body.description || ''),
      price: Number(body.price) || 0,
      year: Number(body.year) || (S.subjectById(body.subjectId).year || 3),
      subjectId: Number(body.subjectId),
      teacherId: Number(body.teacherId),
      visible: body.visible === undefined ? 1 : Number(body.visible) ? 1 : 0,
      isNew: !!body.isNew,
      renamed: body.renamed === undefined ? false : !!body.renamed,
      picture: String(body.picture || `media/covers/course-${((id - 1) % 8) + 1}.svg`),
      createdAt: S.nowISO(),
      updatedAt: S.nowISO()
    };
    S.state.courses.push(course);
    S.audit(`admin:${actor.name}`, 'course.create', `إضافة الكورس ${course.name}`);
    S.save();
    return sendJSON(res, 201, { course: courseAdminRow(course) });
  }, 'admin');

  route('PATCH', /^\/api\/admin\/courses\/(\d+)$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const course = S.courseById(params[0]);
    if (!course) return fail(res, 404, 'الكورس غير موجود.');
    const body = await bodyOf(req);
    if (body.name !== undefined) course.name = String(body.name).trim() || course.name;
    if (body.description !== undefined) course.description = String(body.description);
    if (body.price !== undefined) course.price = Number(body.price) || 0;
    if (body.year !== undefined) course.year = Number(body.year) || course.year;
    if (body.subjectId !== undefined) course.subjectId = Number(body.subjectId);
    if (body.teacherId !== undefined) course.teacherId = Number(body.teacherId);
    if (body.visible !== undefined) course.visible = Number(body.visible) ? 1 : 0;
    if (body.isNew !== undefined) course.isNew = !!body.isNew;
    if (body.renamed !== undefined) course.renamed = !!body.renamed;
    if (body.picture !== undefined) course.picture = String(body.picture);
    course.updatedAt = S.nowISO();
    S.audit(`admin:${actor.name}`, 'course.update', `تعديل الكورس ${course.name}`);
    S.save();
    return sendJSON(res, 200, { course: courseAdminRow(course) });
  }, 'admin');

  route('DELETE', /^\/api\/admin\/courses\/(\d+)$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const course = S.courseById(params[0]);
    if (!course) return fail(res, 404, 'الكورس غير موجود.');
    S.state.courses = S.state.courses.filter(c => Number(c.id) !== Number(course.id));
    const sectionIds = S.state.sections.filter(s => Number(s.courseId) === Number(course.id)).map(s => s.id);
    S.state.sections = S.state.sections.filter(s => Number(s.courseId) !== Number(course.id));
    S.state.exams = S.state.exams.filter(e => Number(e.courseId) !== Number(course.id));
    S.state.questions = S.state.questions.filter(q => Number(q.courseId) !== Number(course.id));
    S.state.subscriptions = S.state.subscriptions.filter(s => Number(s.courseId) !== Number(course.id));
    S.state.codes = S.state.codes.filter(c => Number(c.courseId) !== Number(course.id));
    S.audit(`admin:${actor.name}`, 'course.delete', `حذف الكورس ${course.name} (${sectionIds.length} أقسام)`);
    S.save();
    return sendJSON(res, 200, { message: 'تم حذف الكورس.' });
  }, 'admin');

  function contentFor(actor, res, courseId) {
    const course = ownCourse(actor, courseId);
    if (!course) {
      fail(res, 404, 'الكورس غير موجود أو لا تملك صلاحية عليه.');
      return null;
    }
    return course;
  }

  route('GET', /^\/api\/admin\/courses\/(\d+)\/content$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const course = S.courseById(params[0]);
    if (!course) return fail(res, 404, 'الكورس غير موجود.');
    return sendJSON(res, 200, {
      course: { id: course.id, name: course.name },
      sections: S.sectionsForCourse(course.id),
      exams: S.examsForCourse(course.id)
    });
  }, 'admin');

  route('POST', /^\/api\/admin\/courses\/(\d+)\/sections$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const course = S.courseById(params[0]);
    if (!course) return fail(res, 404, 'الكورس غير موجود.');
    const body = await bodyOf(req);
    const errors = requireFields(body, ['name']);
    if (errors) return fail(res, 422, 'اسم القسم مطلوب.', errors);
    const section = {
      id: S.nextId(S.state.sections),
      courseId: course.id,
      name: String(body.name).trim(),
      order: S.sectionsForCourse(course.id).length + 1,
      lessons: [],
      createdAt: S.nowISO()
    };
    S.state.sections.push(section);
    S.audit(`admin:${actor.name}`, 'section.create', `إضافة قسم ${section.name} في ${course.name}`);
    S.save();
    return sendJSON(res, 201, { section });
  }, 'admin');

  route('PATCH', /^\/api\/admin\/sections\/(\d+)$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const section = S.state.sections.find(s => Number(s.id) === Number(params[0]));
    if (!section) return fail(res, 404, 'القسم غير موجود.');
    const body = await bodyOf(req);
    if (body.name !== undefined) section.name = String(body.name).trim() || section.name;
    S.audit(`admin:${actor.name}`, 'section.update', `تعديل القسم ${section.name}`);
    S.save();
    return sendJSON(res, 200, { section });
  }, 'admin');

  route('DELETE', /^\/api\/admin\/sections\/(\d+)$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const section = S.state.sections.find(s => Number(s.id) === Number(params[0]));
    if (!section) return fail(res, 404, 'القسم غير موجود.');
    S.state.sections = S.state.sections.filter(s => Number(s.id) !== Number(section.id));
    S.state.exams = S.state.exams.filter(e => Number(e.sectionId) !== Number(section.id));
    S.audit(`admin:${actor.name}`, 'section.delete', `حذف القسم ${section.name}`);
    S.save();
    return sendJSON(res, 200, { message: 'تم حذف القسم.' });
  }, 'admin');

  route('POST', /^\/api\/admin\/sections\/(\d+)\/lessons$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const section = S.state.sections.find(s => Number(s.id) === Number(params[0]));
    if (!section) return fail(res, 404, 'القسم غير موجود.');
    const body = await bodyOf(req);
    const errors = requireFields(body, ['title']);
    if (errors) return fail(res, 422, 'عنوان الحصة مطلوب.', errors);
    const lesson = {
      id: S.nextId(S.state.sections.flatMap(s => s.lessons)),
      sectionId: section.id,
      title: String(body.title).trim(),
      description: String(body.description || ''),
      duration: Number(body.duration) || 30,
      videoUrl: String(body.videoUrl || '/media/demo-video.html'),
      isFree: !!body.isFree,
      published: body.published === undefined ? true : !!body.published,
      order: section.lessons.length + 1
    };
    section.lessons.push(lesson);
    S.audit(`admin:${actor.name}`, 'lesson.create', `إضافة حصة ${lesson.title}`);
    S.save();
    return sendJSON(res, 201, { lesson });
  }, 'admin');

  route('PATCH', /^\/api\/admin\/lessons\/(\d+)$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    let lesson = null;
    for (const section of S.state.sections) {
      const found = section.lessons.find(l => Number(l.id) === Number(params[0]));
      if (found) { lesson = found; break; }
    }
    if (!lesson) return fail(res, 404, 'الحصة غير موجودة.');
    const body = await bodyOf(req);
    if (body.title !== undefined) lesson.title = String(body.title).trim() || lesson.title;
    if (body.description !== undefined) lesson.description = String(body.description);
    if (body.duration !== undefined) lesson.duration = Number(body.duration) || lesson.duration;
    if (body.videoUrl !== undefined) lesson.videoUrl = String(body.videoUrl);
    if (body.isFree !== undefined) lesson.isFree = !!body.isFree;
    if (body.published !== undefined) lesson.published = !!body.published;
    S.audit(`admin:${actor.name}`, 'lesson.update', `تعديل الحصة ${lesson.title}`);
    S.save();
    return sendJSON(res, 200, { lesson });
  }, 'admin');

  route('DELETE', /^\/api\/admin\/lessons\/(\d+)$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    let removed = null;
    for (const section of S.state.sections) {
      const index = section.lessons.findIndex(l => Number(l.id) === Number(params[0]));
      if (index >= 0) { removed = section.lessons.splice(index, 1)[0]; break; }
    }
    if (!removed) return fail(res, 404, 'الحصة غير موجودة.');
    S.audit(`admin:${actor.name}`, 'lesson.delete', `حذف الحصة ${removed.title}`);
    S.save();
    return sendJSON(res, 200, { message: 'تم حذف الحصة.' });
  }, 'admin');

  // -------------------------------------------------------------------------
  // بنوك الأسئلة والامتحانات — أدمن
  // -------------------------------------------------------------------------

  route('GET', /^\/api\/admin\/qbanks$/, async ({ res, query, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const teacherId = query.get('teacherId');
    let list = S.state.qbanks;
    if (teacherId) list = list.filter(b => Number(b.teacherId) === Number(teacherId));
    return sendJSON(res, 200, {
      data: list.map(b => ({ ...b, teacherName: teacherName(b.teacherId), questionsCount: b.questions.length }))
    });
  }, 'admin');

  route('POST', /^\/api\/admin\/qbanks$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const body = await bodyOf(req);
    const errors = requireFields(body, ['name', 'teacherId']);
    if (errors) return fail(res, 422, 'راجع الحقول المطلوبة.', errors);
    const bank = {
      id: S.nextId(S.state.qbanks),
      teacherId: Number(body.teacherId),
      name: String(body.name).trim(),
      createdAt: S.nowISO(),
      questions: []
    };
    S.state.qbanks.push(bank);
    S.audit(`admin:${actor.name}`, 'qbank.create', `إنشاء بنك ${bank.name}`);
    S.save();
    return sendJSON(res, 201, { bank });
  }, 'admin');

  route('GET', /^\/api\/admin\/questions$/, async ({ res, query, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const bankId = query.get('bankId');
    if (bankId) {
      const bank = S.state.qbanks.find(b => Number(b.id) === Number(bankId));
      return sendJSON(res, 200, { data: bank ? bank.questions : [], total: bank ? bank.questions.length : 0 });
    }
    return sendJSON(res, 200, { data: S.state.questions, total: S.state.questions.length });
  }, 'admin');

  route('POST', /^\/api\/admin\/questions$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const body = await bodyOf(req);
    const bank = S.state.qbanks.find(b => Number(b.id) === Number(body.bankId));
    if (!bank) return fail(res, 422, 'بنك الأسئلة غير موجود.');
    const errors = requireFields(body, ['text']);
    if (errors) return fail(res, 422, 'نص السؤال مطلوب.', errors);
    const question = {
      id: S.nextId(S.state.qbanks.flatMap(b => b.questions)),
      type: body.type === 'essay' ? 'essay' : 'mcq',
      text: String(body.text).trim(),
      options: Array.isArray(body.options) ? body.options.map(String) : ['اختيار أ', 'اختيار ب', 'اختيار ج', 'اختيار د'],
      correct: body.type === 'essay' ? null : Number(body.correct) || 0,
      points: Number(body.points) || (body.type === 'essay' ? 5 : 2)
    };
    bank.questions.push(question);
    S.audit(`admin:${actor.name}`, 'question.create', `إضافة سؤال في ${bank.name}`);
    S.save();
    return sendJSON(res, 201, { question });
  }, 'admin');

  route('DELETE', /^\/api\/admin\/questions\/(\d+)$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    let removed = null;
    for (const bank of S.state.qbanks) {
      const index = bank.questions.findIndex(q => Number(q.id) === Number(params[0]));
      if (index >= 0) { removed = bank.questions.splice(index, 1)[0]; break; }
    }
    if (!removed) return fail(res, 404, 'السؤال غير موجود.');
    S.audit(`admin:${actor.name}`, 'question.delete', 'حذف سؤال');
    S.save();
    return sendJSON(res, 200, { message: 'تم حذف السؤال.' });
  }, 'admin');

  function buildExamQuestions(questionIds) {
    const all = S.state.qbanks.flatMap(b => b.questions);
    return (questionIds || [])
      .map(id => all.find(q => Number(q.id) === Number(id)))
      .filter(Boolean)
      .map(q => ({ ...q }));
  }

  route('GET', /^\/api\/admin\/exams$/, async ({ res, query, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const courseId = query.get('courseId');
    let list = S.state.exams;
    if (courseId) list = list.filter(e => Number(e.courseId) === Number(courseId));
    const rows = list.map(e => ({
      ...e,
      courseName: courseTitle(e.courseId),
      teacherName: teacherName(e.teacherId),
      questionsCount: e.questions.length,
      attempts: S.state.attempts.filter(a => Number(a.examId) === Number(e.id)).length
    }));
    return sendJSON(res, 200, { data: rows, total: rows.length });
  }, 'admin');

  route('POST', /^\/api\/admin\/exams$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const body = await bodyOf(req);
    const errors = requireFields(body, ['title', 'courseId']);
    if (errors) return fail(res, 422, 'راجع الحقول المطلوبة.', errors);
    const course = S.courseById(body.courseId);
    if (!course) return fail(res, 422, 'الكورس غير موجود.');
    const exam = {
      id: S.nextId(S.state.exams),
      courseId: course.id,
      sectionId: Number(body.sectionId) || null,
      teacherId: course.teacherId,
      title: String(body.title).trim(),
      type: body.type === 'hm' ? 'hm' : 'exam',
      duration: Number(body.duration) || 60,
      published: body.published === undefined ? true : !!body.published,
      createdAt: S.nowISO(),
      questions: buildExamQuestions(body.questionIds)
    };
    S.state.exams.push(exam);
    S.audit(`admin:${actor.name}`, 'exam.create', `إنشاء امتحان ${exam.title}`);
    S.save();
    return sendJSON(res, 201, { exam });
  }, 'admin');

  route('PATCH', /^\/api\/admin\/exams\/(\d+)$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const exam = S.state.exams.find(e => Number(e.id) === Number(params[0]));
    if (!exam) return fail(res, 404, 'الامتحان غير موجود.');
    const body = await bodyOf(req);
    if (body.title !== undefined) exam.title = String(body.title).trim() || exam.title;
    if (body.type !== undefined) exam.type = body.type === 'hm' ? 'hm' : 'exam';
    if (body.duration !== undefined) exam.duration = Number(body.duration) || exam.duration;
    if (body.sectionId !== undefined) exam.sectionId = Number(body.sectionId) || null;
    if (body.published !== undefined) exam.published = !!body.published;
    if (Array.isArray(body.questionIds)) exam.questions = buildExamQuestions(body.questionIds);
    S.audit(`admin:${actor.name}`, 'exam.update', `تعديل الامتحان ${exam.title}`);
    S.save();
    return sendJSON(res, 200, { exam });
  }, 'admin');

  route('DELETE', /^\/api\/admin\/exams\/(\d+)$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const exam = S.state.exams.find(e => Number(e.id) === Number(params[0]));
    if (!exam) return fail(res, 404, 'الامتحان غير موجود.');
    S.state.exams = S.state.exams.filter(e => Number(e.id) !== Number(exam.id));
    S.state.attempts = S.state.attempts.filter(a => Number(a.examId) !== Number(exam.id));
    S.audit(`admin:${actor.name}`, 'exam.delete', `حذف الامتحان ${exam.title}`);
    S.save();
    return sendJSON(res, 200, { message: 'تم حذف الامتحان.' });
  }, 'admin');

  // -------------------------------------------------------------------------
  // الفواتير
  // -------------------------------------------------------------------------

  route('GET', /^\/api\/admin\/invoices$/, async ({ res, query, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const status = query.get('status') || '';
    let list = S.state.invoices;
    if (status) list = list.filter(i => i.status === status);
    const rows = list
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(i => ({ ...i, studentName: studentName(i.studentId), courseName: courseTitle(i.courseId) }));
    return sendJSON(res, 200, paginate(rows, query));
  }, 'admin');

  route('POST', /^\/api\/admin\/invoices\/(\d+)\/pay$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const invoice = S.state.invoices.find(i => Number(i.id) === Number(params[0]));
    if (!invoice) return fail(res, 404, 'الفاتورة غير موجودة.');
    if (invoice.status === 'paid') return fail(res, 409, 'الفاتورة مدفوعة بالفعل.');
    invoice.status = 'paid';
    invoice.paidAt = S.nowISO();
    if (!S.state.subscriptions.some(s => Number(s.studentId) === Number(invoice.studentId) && Number(s.courseId) === Number(invoice.courseId))) {
      S.state.subscriptions.push({
        id: S.nextId(S.state.subscriptions),
        studentId: invoice.studentId,
        courseId: invoice.courseId,
        invoiceId: invoice.id,
        createdAt: invoice.paidAt,
        progress: 0
      });
    }
    S.audit(`admin:${actor.name}`, 'invoice.pay', `تأكيد دفع ${invoice.reference}`);
    S.save();
    return sendJSON(res, 200, { invoice });
  }, 'admin');

  route('POST', /^\/api\/admin\/invoices\/(\d+)\/cancel$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const invoice = S.state.invoices.find(i => Number(i.id) === Number(params[0]));
    if (!invoice) return fail(res, 404, 'الفاتورة غير موجودة.');
    invoice.status = 'cancelled';
    S.audit(`admin:${actor.name}`, 'invoice.cancel', `إلغاء الفاتورة ${invoice.reference}`);
    S.save();
    return sendJSON(res, 200, { invoice });
  }, 'admin');

  // -------------------------------------------------------------------------
  // أكواد الشحن
  // -------------------------------------------------------------------------

  function makeCode() {
    const part = () => crypto.randomBytes(2).toString('hex').toUpperCase();
    return `PS-${part()}-${part()}`;
  }

  route('GET', /^\/api\/admin\/codes$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const rows = S.state.codes.map(c => ({ ...c, courseName: courseTitle(c.courseId), usedByName: c.usedBy ? studentName(c.usedBy) : null }));
    return sendJSON(res, 200, { data: rows, total: rows.length });
  }, 'admin');

  route('POST', /^\/api\/admin\/codes$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const body = await bodyOf(req);
    const course = S.courseById(body.courseId);
    if (!course) return fail(res, 422, 'اختر كورسًا صحيحًا.');
    const count = Math.min(50, Math.max(1, Number(body.count) || 1));
    const created = [];
    for (let i = 0; i < count; i++) {
      const code = {
        id: S.nextId(S.state.codes),
        code: makeCode(),
        courseId: course.id,
        value: Number(body.value) || course.price,
        createdAt: S.nowISO(),
        used: false,
        usedBy: null,
        revoked: false
      };
      S.state.codes.push(code);
      created.push(code);
    }
    S.audit(`admin:${actor.name}`, 'code.create', `إنشاء ${created.length} كود لكورس ${course.name}`);
    S.save();
    return sendJSON(res, 201, { codes: created });
  }, 'admin');

  route('POST', /^\/api\/admin\/codes\/(\d+)\/revoke$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const code = S.state.codes.find(c => Number(c.id) === Number(params[0]));
    if (!code) return fail(res, 404, 'الكود غير موجود.');
    code.revoked = true;
    S.audit(`admin:${actor.name}`, 'code.revoke', `إلغاء الكود ${code.code}`);
    S.save();
    return sendJSON(res, 200, { code });
  }, 'admin');

  // -------------------------------------------------------------------------
  // المجتمع
  // -------------------------------------------------------------------------

  route('GET', /^\/api\/admin\/community$/, async ({ res, query, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const status = query.get('status') || '';
    let list = S.state.communityPosts;
    if (status === 'pending') list = list.filter(p => !p.is_approved);
    if (status === 'approved') list = list.filter(p => p.is_approved);
    const rows = list.map(p => ({
      ...p,
      categoryName: (S.state.communityCategories.find(c => Number(c.id) === Number(p.community_category_id)) || {}).name || '—'
    }));
    return sendJSON(res, 200, { data: rows, total: rows.length, categories: S.state.communityCategories });
  }, 'admin');

  route('POST', /^\/api\/admin\/community\/(\d+)\/(approve|reject)$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const post = S.state.communityPosts.find(p => Number(p.id) === Number(params[0]));
    if (!post) return fail(res, 404, 'المنشور غير موجود.');
    if (params[1] === 'approve') {
      post.is_approved = true;
      S.audit(`admin:${actor.name}`, 'post.approve', 'اعتماد منشور');
    } else {
      S.state.communityPosts = S.state.communityPosts.filter(p => Number(p.id) !== Number(post.id));
      S.audit(`admin:${actor.name}`, 'post.reject', 'رفض منشور');
    }
    S.save();
    return sendJSON(res, 200, { message: params[1] === 'approve' ? 'تم اعتماد المنشور.' : 'تم رفض المنشور.' });
  }, 'admin');

  // -------------------------------------------------------------------------
  // الإعدادات والسجل والأدمن
  // -------------------------------------------------------------------------

  route('GET', /^\/api\/admin\/settings$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    return sendJSON(res, 200, { settings: S.state.settings });
  }, 'admin');

  route('PATCH', /^\/api\/admin\/settings$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const body = await bodyOf(req);
    const settings = S.state.settings;
    if (body.registrationOpen !== undefined) settings.registrationOpen = !!body.registrationOpen;
    if (body.paymentsMode !== undefined) settings.paymentsMode = String(body.paymentsMode);
    if (body.notice !== undefined) settings.notice = String(body.notice);
    if (body.supportPhone !== undefined) settings.supportPhone = digits(body.supportPhone);
    if (body.couponable !== undefined) settings.couponable = !!body.couponable;
    S.audit(`admin:${actor.name}`, 'settings.update', 'تعديل إعدادات المنصة');
    S.save();
    return sendJSON(res, 200, { settings });
  }, 'admin');

  route('GET', /^\/api\/admin\/audit$/, async ({ res, query, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    return sendJSON(res, 200, paginate(S.state.audit, query, 30));
  }, 'admin');

  route('GET', /^\/api\/admin\/admins$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    return sendJSON(res, 200, {
      data: S.state.admins.map(a => ({ id: a.id, name: a.name, email: a.email, phone: a.phone, role: a.role, active: a.active }))
    });
  }, 'admin');

  route('POST', /^\/api\/admin\/admins$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'admin')) return;
    const body = await bodyOf(req);
    const errors = requireFields(body, ['name', 'email', 'password']);
    if (errors) return fail(res, 422, 'راجع الحقول المطلوبة.', errors);
    const admin = {
      id: S.nextId(S.state.admins),
      name: String(body.name).trim(),
      email: String(body.email).trim(),
      phone: digits(body.phone || ''),
      password: String(body.password),
      role: 'admin',
      active: true
    };
    S.state.admins.push(admin);
    S.audit(`admin:${actor.name}`, 'admin.create', `إضافة أدمن ${admin.name}`);
    S.save();
    return sendJSON(res, 201, { admin: { ...admin, password: undefined } });
  }, 'admin');

  // -------------------------------------------------------------------------
  // لوحة المدرس
  // -------------------------------------------------------------------------

  function teacherCourses(teacherId) {
    return S.state.courses.filter(c => Number(c.teacherId) === Number(teacherId));
  }

  function teacherStudents(teacherId) {
    const courseIds = new Set(teacherCourses(teacherId).map(c => Number(c.id)));
    const map = new Map();
    for (const sub of S.state.subscriptions) {
      if (!courseIds.has(Number(sub.courseId))) continue;
      const student = S.state.students.find(s => Number(s.id) === Number(sub.studentId));
      if (!student) continue;
      const entry = map.get(student.id) || { ...student, courses: [], progress: 0 };
      entry.courses.push(courseTitle(sub.courseId));
      entry.progress = Math.round((entry.progress * (entry.courses.length - 1) + (sub.progress || 0)) / entry.courses.length);
      map.set(student.id, entry);
    }
    return [...map.values()];
  }

  route('GET', /^\/api\/teacher-panel\/overview$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const courses = teacherCourses(actor.id);
    const courseIds = new Set(courses.map(c => Number(c.id)));
    const invoices = S.state.invoices.filter(i => courseIds.has(Number(i.courseId)) && i.status === 'paid');
    const examIds = new Set(S.state.exams.filter(e => courseIds.has(Number(e.courseId))).map(e => e.id));
    return sendJSON(res, 200, {
      stats: {
        courses: courses.length,
        students: teacherStudents(actor.id).length,
        lessons: courses.reduce((sum, c) => sum + S.sectionsForCourse(c.id).reduce((n, s) => n + s.lessons.length, 0), 0),
        exams: examIds.size,
        pendingGrading: S.state.attempts.filter(a => examIds.has(Number(a.examId)) && a.status === 'pending').length,
        openQa: S.state.qa.filter(q => Number(q.teacherId) === Number(actor.id) && q.status === 'open').length,
        revenue: invoices.reduce((sum, i) => sum + Number(i.amount || 0), 0)
      },
      courses: courses.map(courseAdminRow),
      recentQa: S.state.qa.filter(q => Number(q.teacherId) === Number(actor.id)).slice(0, 5).map(q => ({ ...q, studentName: studentName(q.studentId), courseName: courseTitle(q.courseId) }))
    });
  }, 'teacher');

  route('GET', /^\/api\/teacher-panel\/courses$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const rows = teacherCourses(actor.id).map(courseAdminRow);
    return sendJSON(res, 200, { data: rows, total: rows.length });
  }, 'teacher');

  route('PATCH', /^\/api\/teacher-panel\/courses\/(\d+)$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const course = ownCourse(actor, params[0]);
    if (!course) return fail(res, 404, 'الكورس غير موجود أو لا تملك صلاحية عليه.');
    const body = await bodyOf(req);
    if (body.name !== undefined) course.name = String(body.name).trim() || course.name;
    if (body.description !== undefined) course.description = String(body.description);
    if (body.price !== undefined) course.price = Number(body.price) || 0;
    if (body.visible !== undefined) course.visible = Number(body.visible) ? 1 : 0;
    if (body.isNew !== undefined) course.isNew = !!body.isNew;
    if (body.renamed !== undefined) course.renamed = !!body.renamed;
    course.updatedAt = S.nowISO();
    S.audit(`teacher:${actor.name}`, 'course.update', `تعديل كورس ${course.name}`);
    S.save();
    return sendJSON(res, 200, { course: courseAdminRow(course) });
  }, 'teacher');

  route('GET', /^\/api\/teacher-panel\/courses\/(\d+)\/content$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const course = contentFor(actor, res, params[0]);
    if (!course) return;
    return sendJSON(res, 200, {
      course: { id: course.id, name: course.name },
      sections: S.sectionsForCourse(course.id),
      exams: S.examsForCourse(course.id)
    });
  }, 'teacher');

  route('POST', /^\/api\/teacher-panel\/courses\/(\d+)\/sections$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const course = contentFor(actor, res, params[0]);
    if (!course) return;
    const body = await bodyOf(req);
    const errors = requireFields(body, ['name']);
    if (errors) return fail(res, 422, 'اسم القسم مطلوب.', errors);
    const section = {
      id: S.nextId(S.state.sections),
      courseId: course.id,
      name: String(body.name).trim(),
      order: S.sectionsForCourse(course.id).length + 1,
      lessons: [],
      createdAt: S.nowISO()
    };
    S.state.sections.push(section);
    S.audit(`teacher:${actor.name}`, 'section.create', `إضافة قسم ${section.name}`);
    S.save();
    return sendJSON(res, 201, { section });
  }, 'teacher');

  route('PATCH', /^\/api\/teacher-panel\/sections\/(\d+)$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const section = S.state.sections.find(s => Number(s.id) === Number(params[0]));
    if (!section) return fail(res, 404, 'القسم غير موجود.');
    const course = ownCourse(actor, section.courseId);
    if (!course) return fail(res, 403, 'لا تملك صلاحية على هذا القسم.');
    const body = await bodyOf(req);
    if (body.name !== undefined) section.name = String(body.name).trim() || section.name;
    S.audit(`teacher:${actor.name}`, 'section.update', `تعديل القسم ${section.name}`);
    S.save();
    return sendJSON(res, 200, { section });
  }, 'teacher');

  route('DELETE', /^\/api\/teacher-panel\/sections\/(\d+)$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const section = S.state.sections.find(s => Number(s.id) === Number(params[0]));
    if (!section) return fail(res, 404, 'القسم غير موجود.');
    if (!ownCourse(actor, section.courseId)) return fail(res, 403, 'لا تملك صلاحية على هذا القسم.');
    S.state.sections = S.state.sections.filter(s => Number(s.id) !== Number(section.id));
    S.state.exams = S.state.exams.filter(e => Number(e.sectionId) !== Number(section.id));
    S.audit(`teacher:${actor.name}`, 'section.delete', `حذف القسم ${section.name}`);
    S.save();
    return sendJSON(res, 200, { message: 'تم حذف القسم.' });
  }, 'teacher');

  route('POST', /^\/api\/teacher-panel\/sections\/(\d+)\/lessons$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const section = S.state.sections.find(s => Number(s.id) === Number(params[0]));
    if (!section) return fail(res, 404, 'القسم غير موجود.');
    if (!ownCourse(actor, section.courseId)) return fail(res, 403, 'لا تملك صلاحية على هذا القسم.');
    const body = await bodyOf(req);
    const errors = requireFields(body, ['title']);
    if (errors) return fail(res, 422, 'عنوان الحصة مطلوب.', errors);
    const lesson = {
      id: S.nextId(S.state.sections.flatMap(s => s.lessons)),
      sectionId: section.id,
      title: String(body.title).trim(),
      description: String(body.description || ''),
      duration: Number(body.duration) || 30,
      videoUrl: String(body.videoUrl || '/media/demo-video.html'),
      isFree: !!body.isFree,
      published: body.published === undefined ? true : !!body.published,
      order: section.lessons.length + 1
    };
    section.lessons.push(lesson);
    S.audit(`teacher:${actor.name}`, 'lesson.create', `إضافة حصة ${lesson.title}`);
    S.save();
    return sendJSON(res, 201, { lesson });
  }, 'teacher');

  route('PATCH', /^\/api\/teacher-panel\/lessons\/(\d+)$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    let lesson = null;
    let section = null;
    for (const sec of S.state.sections) {
      const found = sec.lessons.find(l => Number(l.id) === Number(params[0]));
      if (found) { lesson = found; section = sec; break; }
    }
    if (!lesson) return fail(res, 404, 'الحصة غير موجودة.');
    if (!ownCourse(actor, section.courseId)) return fail(res, 403, 'لا تملك صلاحية على هذه الحصة.');
    const body = await bodyOf(req);
    if (body.title !== undefined) lesson.title = String(body.title).trim() || lesson.title;
    if (body.description !== undefined) lesson.description = String(body.description);
    if (body.duration !== undefined) lesson.duration = Number(body.duration) || lesson.duration;
    if (body.videoUrl !== undefined) lesson.videoUrl = String(body.videoUrl);
    if (body.isFree !== undefined) lesson.isFree = !!body.isFree;
    if (body.published !== undefined) lesson.published = !!body.published;
    S.audit(`teacher:${actor.name}`, 'lesson.update', `تعديل حصة ${lesson.title}`);
    S.save();
    return sendJSON(res, 200, { lesson });
  }, 'teacher');

  route('DELETE', /^\/api\/teacher-panel\/lessons\/(\d+)$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    let removed = null;
    let section = null;
    for (const sec of S.state.sections) {
      const index = sec.lessons.findIndex(l => Number(l.id) === Number(params[0]));
      if (index >= 0) { removed = sec.lessons.splice(index, 1)[0]; section = sec; break; }
    }
    if (!removed) return fail(res, 404, 'الحصة غير موجودة.');
    if (!ownCourse(actor, section.courseId)) return fail(res, 403, 'لا تملك صلاحية على هذه الحصة.');
    S.audit(`teacher:${actor.name}`, 'lesson.delete', `حذف حصة ${removed.title}`);
    S.save();
    return sendJSON(res, 200, { message: 'تم حذف الحصة.' });
  }, 'teacher');

  route('GET', /^\/api\/teacher-panel\/qbanks$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const banks = S.state.qbanks.filter(b => Number(b.teacherId) === Number(actor.id));
    return sendJSON(res, 200, { data: banks });
  }, 'teacher');

  route('POST', /^\/api\/teacher-panel\/qbanks$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const body = await bodyOf(req);
    const errors = requireFields(body, ['name']);
    if (errors) return fail(res, 422, 'اسم البنك مطلوب.', errors);
    const bank = { id: S.nextId(S.state.qbanks), teacherId: actor.id, name: String(body.name).trim(), createdAt: S.nowISO(), questions: [] };
    S.state.qbanks.push(bank);
    S.audit(`teacher:${actor.name}`, 'qbank.create', `إنشاء بنك ${bank.name}`);
    S.save();
    return sendJSON(res, 201, { bank });
  }, 'teacher');

  route('POST', /^\/api\/teacher-panel\/qbanks\/(\d+)\/questions$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const bank = S.state.qbanks.find(b => Number(b.id) === Number(params[0]) && Number(b.teacherId) === Number(actor.id));
    if (!bank) return fail(res, 404, 'بنك الأسئلة غير موجود.');
    const body = await bodyOf(req);
    const errors = requireFields(body, ['text']);
    if (errors) return fail(res, 422, 'نص السؤال مطلوب.', errors);
    const question = {
      id: S.nextId(S.state.qbanks.flatMap(b => b.questions)),
      type: body.type === 'essay' ? 'essay' : 'mcq',
      text: String(body.text).trim(),
      options: Array.isArray(body.options) ? body.options.map(String) : ['اختيار أ', 'اختيار ب', 'اختيار ج', 'اختيار د'],
      correct: body.type === 'essay' ? null : Number(body.correct) || 0,
      points: Number(body.points) || (body.type === 'essay' ? 5 : 2)
    };
    bank.questions.push(question);
    S.audit(`teacher:${actor.name}`, 'question.create', `إضافة سؤال في ${bank.name}`);
    S.save();
    return sendJSON(res, 201, { question });
  }, 'teacher');

  route('DELETE', /^\/api\/teacher-panel\/questions\/(\d+)$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    let removed = null;
    for (const bank of S.state.qbanks) {
      if (Number(bank.teacherId) !== Number(actor.id)) continue;
      const index = bank.questions.findIndex(q => Number(q.id) === Number(params[0]));
      if (index >= 0) { removed = bank.questions.splice(index, 1)[0]; break; }
    }
    if (!removed) return fail(res, 404, 'السؤال غير موجود.');
    S.audit(`teacher:${actor.name}`, 'question.delete', 'حذف سؤال');
    S.save();
    return sendJSON(res, 200, { message: 'تم حذف السؤال.' });
  }, 'teacher');

  route('GET', /^\/api\/teacher-panel\/exams$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const rows = S.state.exams
      .filter(e => Number(e.teacherId) === Number(actor.id))
      .map(e => ({
        ...e,
        courseName: courseTitle(e.courseId),
        questionsCount: e.questions.length,
        attempts: S.state.attempts.filter(a => Number(a.examId) === Number(e.id)).length
      }));
    return sendJSON(res, 200, { data: rows, total: rows.length });
  }, 'teacher');

  route('POST', /^\/api\/teacher-panel\/exams$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const body = await bodyOf(req);
    const errors = requireFields(body, ['title', 'courseId']);
    if (errors) return fail(res, 422, 'راجع الحقول المطلوبة.', errors);
    const course = ownCourse(actor, body.courseId);
    if (!course) return fail(res, 422, 'الكورس غير موجود أو لا تملك صلاحية عليه.');
    const exam = {
      id: S.nextId(S.state.exams),
      courseId: course.id,
      sectionId: Number(body.sectionId) || null,
      teacherId: actor.id,
      title: String(body.title).trim(),
      type: body.type === 'hm' ? 'hm' : 'exam',
      duration: Number(body.duration) || 60,
      published: body.published === undefined ? true : !!body.published,
      createdAt: S.nowISO(),
      questions: buildExamQuestions(body.questionIds)
    };
    S.state.exams.push(exam);
    S.audit(`teacher:${actor.name}`, 'exam.create', `إنشاء امتحان ${exam.title}`);
    S.save();
    return sendJSON(res, 201, { exam });
  }, 'teacher');

  route('PATCH', /^\/api\/teacher-panel\/exams\/(\d+)$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const exam = S.state.exams.find(e => Number(e.id) === Number(params[0]) && Number(e.teacherId) === Number(actor.id));
    if (!exam) return fail(res, 404, 'الامتحان غير موجود.');
    const body = await bodyOf(req);
    if (body.title !== undefined) exam.title = String(body.title).trim() || exam.title;
    if (body.type !== undefined) exam.type = body.type === 'hm' ? 'hm' : 'exam';
    if (body.duration !== undefined) exam.duration = Number(body.duration) || exam.duration;
    if (body.sectionId !== undefined) exam.sectionId = Number(body.sectionId) || null;
    if (body.published !== undefined) exam.published = !!body.published;
    if (Array.isArray(body.questionIds)) exam.questions = buildExamQuestions(body.questionIds);
    S.audit(`teacher:${actor.name}`, 'exam.update', `تعديل امتحان ${exam.title}`);
    S.save();
    return sendJSON(res, 200, { exam });
  }, 'teacher');

  route('DELETE', /^\/api\/teacher-panel\/exams\/(\d+)$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const exam = S.state.exams.find(e => Number(e.id) === Number(params[0]) && Number(e.teacherId) === Number(actor.id));
    if (!exam) return fail(res, 404, 'الامتحان غير موجود.');
    S.state.exams = S.state.exams.filter(e => Number(e.id) !== Number(exam.id));
    S.state.attempts = S.state.attempts.filter(a => Number(a.examId) !== Number(exam.id));
    S.audit(`teacher:${actor.name}`, 'exam.delete', `حذف امتحان ${exam.title}`);
    S.save();
    return sendJSON(res, 200, { message: 'تم حذف الامتحان.' });
  }, 'teacher');

  route('GET', /^\/api\/teacher-panel\/students$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    return sendJSON(res, 200, { data: teacherStudents(actor.id) });
  }, 'teacher');

  route('GET', /^\/api\/teacher-panel\/grading$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const examIds = new Set(S.state.exams.filter(e => Number(e.teacherId) === Number(actor.id)).map(e => e.id));
    const rows = S.state.attempts
      .filter(a => examIds.has(Number(a.examId)) && a.status === 'pending')
      .map(a => ({
        ...a,
        studentName: studentName(a.studentId),
        examTitle: (S.state.exams.find(e => Number(e.id) === Number(a.examId)) || {}).title || '—'
      }));
    return sendJSON(res, 200, { data: rows });
  }, 'teacher');

  route('GET', /^\/api\/teacher-panel\/grading\/(\d+)$/, async ({ res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const attempt = S.state.attempts.find(a => Number(a.id) === Number(params[0]));
    if (!attempt) return fail(res, 404, 'المحاولة غير موجودة.');
    const exam = S.state.exams.find(e => Number(e.id) === Number(attempt.examId));
    if (!exam || Number(exam.teacherId) !== Number(actor.id)) return fail(res, 403, 'لا تملك صلاحية على هذه المحاولة.');
    return sendJSON(res, 200, {
      attempt,
      exam: { id: exam.id, title: exam.title, questions: exam.questions },
      student: S.state.students.find(s => Number(s.id) === Number(attempt.studentId)) || null
    });
  }, 'teacher');

  route('POST', /^\/api\/teacher-panel\/grading\/(\d+)$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const attempt = S.state.attempts.find(a => Number(a.id) === Number(params[0]));
    if (!attempt) return fail(res, 404, 'المحاولة غير موجودة.');
    const exam = S.state.exams.find(e => Number(e.id) === Number(attempt.examId));
    if (!exam || Number(exam.teacherId) !== Number(actor.id)) return fail(res, 403, 'لا تملك صلاحية على هذه المحاولة.');
    const body = await bodyOf(req);
    const scores = body.scores && typeof body.scores === 'object' ? body.scores : {};
    attempt.answers = attempt.answers.map(answer => {
      const question = exam.questions.find(q => Number(q.id) === Number(answer.questionId));
      if (scores[answer.questionId] !== undefined) {
        const max = question ? Number(question.points) || 0 : 0;
        return { ...answer, score: Math.max(0, Math.min(max, Number(scores[answer.questionId]) || 0)) };
      }
      return answer;
    });
    attempt.total = attempt.answers.reduce((sum, a) => sum + (Number(a.score) || 0), 0);
    attempt.status = 'graded';
    attempt.gradedAt = S.nowISO();
    attempt.gradedBy = actor.id;
    S.audit(`teacher:${actor.name}`, 'attempt.grade', `تصحيح محاولة الطالب ${studentName(attempt.studentId)}`);
    S.save();
    return sendJSON(res, 200, { attempt });
  }, 'teacher');

  route('GET', /^\/api\/teacher-panel\/qa$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const rows = S.state.qa
      .filter(q => Number(q.teacherId) === Number(actor.id))
      .map(q => ({ ...q, studentName: studentName(q.studentId), courseName: courseTitle(q.courseId) }));
    return sendJSON(res, 200, { data: rows });
  }, 'teacher');

  route('POST', /^\/api\/teacher-panel\/qa\/(\d+)\/answer$/, async ({ req, res, params, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const item = S.state.qa.find(q => Number(q.id) === Number(params[0]) && Number(q.teacherId) === Number(actor.id));
    if (!item) return fail(res, 404, 'السؤال غير موجود.');
    const body = await bodyOf(req);
    const errors = requireFields(body, ['answer']);
    if (errors) return fail(res, 422, 'اكتب الإجابة أولًا.', errors);
    item.answer = String(body.answer).trim();
    item.status = 'answered';
    item.answeredAt = S.nowISO();
    S.audit(`teacher:${actor.name}`, 'qa.answer', 'الرد على سؤال طالب');
    S.save();
    return sendJSON(res, 200, { item });
  }, 'teacher');

  route('GET', /^\/api\/teacher-panel\/codes$/, async ({ res, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const courseIds = new Set(teacherCourses(actor.id).map(c => Number(c.id)));
    const rows = S.state.codes
      .filter(c => courseIds.has(Number(c.courseId)))
      .map(c => ({ ...c, courseName: courseTitle(c.courseId), usedByName: c.usedBy ? studentName(c.usedBy) : null }));
    return sendJSON(res, 200, { data: rows });
  }, 'teacher');

  route('POST', /^\/api\/teacher-panel\/codes$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const body = await bodyOf(req);
    const course = ownCourse(actor, body.courseId);
    if (!course) return fail(res, 422, 'اختر كورسًا من كورساتك.');
    const count = Math.min(20, Math.max(1, Number(body.count) || 1));
    const created = [];
    for (let i = 0; i < count; i++) {
      const code = {
        id: S.nextId(S.state.codes),
        code: makeCode(),
        courseId: course.id,
        value: Number(body.value) || course.price,
        createdAt: S.nowISO(),
        used: false,
        usedBy: null,
        revoked: false
      };
      S.state.codes.push(code);
      created.push(code);
    }
    S.audit(`teacher:${actor.name}`, 'code.create', `إنشاء ${created.length} كود لكورس ${course.name}`);
    S.save();
    return sendJSON(res, 201, { codes: created });
  }, 'teacher');

  route('PATCH', /^\/api\/teacher-panel\/profile$/, async ({ req, res, actor }) => {
    if (!guard(actor, res, 'teacher')) return;
    const body = await bodyOf(req);
    const teacher = actor.entity;
    if (body.name !== undefined) teacher.name = String(body.name).trim() || teacher.name;
    if (body.phone !== undefined) teacher.phone = digits(body.phone) || teacher.phone;
    if (body.description !== undefined) teacher.description = String(body.description);
    if (body.password) teacher.password = String(body.password);
    S.audit(`teacher:${actor.name}`, 'profile.update', 'تحديث بيانات المدرس');
    S.save();
    return sendJSON(res, 200, { teacher: { ...teacher, password: undefined } });
  }, 'teacher');

  // -------------------------------------------------------------------------
  // التوجيه
  // -------------------------------------------------------------------------

  return async function handlePanel(req, res, url) {
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const method = req.method.toUpperCase();
    for (const entry of routes) {
      if (entry.method !== method) continue;
      const match = entry.pattern.exec(pathname);
      if (!match) continue;
      const actor = actorFor(req);
      if (entry.role && !guard(actor, res, entry.role)) return true;
      try {
        await entry.handler({ req, res, url, query: url.searchParams, params: match.slice(1), actor });
      } catch (err) {
        console.error('[panel]', pathname, err);
        if (!res.headersSent) fail(res, 500, 'حدث خطأ غير متوقع.');
      }
      return true;
    }
    return false;
  };
}

module.exports = { createPanelApi, issueToken, verifyToken };
