'use strict';
/*
 * مخزن بيانات اللوحات (أدمن/مدرس) — نسخة تجريبية قابلة للحفظ.
 *
 * - محليًا يُحفظ في .data/store.json حتى تبقى التعديلات بعد إعادة التشغيل.
 * - على Vercel (نظام ملفات للقراءة فقط) يُحفظ في /tmp فقط داخل نفس النسخة،
 *   فإن أُعيد تشغيل الدالة يعود للبيانات الابتدائية. هذا قيد نسخة الـ demo
 *   الموثّق في README، ولا يوجد أي قاعدة بيانات خارجية.
 */
const fs = require('node:fs');
const path = require('node:path');
const D = require('./data');

const ROOT = path.resolve(__dirname, '..');
const STORE_FILE =
  process.env.STORE_FILE ||
  (process.env.VERCEL ? path.join('/tmp', 'physics-society-store.json') : path.join(ROOT, '.data', 'store.json'));

const SEED_VERSION = 1;

// ---------------------------------------------------------------------------
// أدوات
// ---------------------------------------------------------------------------

function nowISO() {
  return new Date().toISOString();
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// بيانات ابتدائية
// ---------------------------------------------------------------------------

const DEMO_STUDENTS = [
  { id: 1, name: D.user.full_name, phone: '01000000000', parentPhone: '01100000001', year: 3, school: 'مدرسة النور الثانوية', active: true },
  { id: 2, name: 'سارة أحمد محمود', phone: '01000000011', parentPhone: '01100000011', year: 3, school: 'مدرسة الأمل الثانوية', active: true },
  { id: 3, name: 'يوسف علي حسن', phone: '01000000012', parentPhone: '01100000012', year: 3, school: 'مدرسة المستقبل الثانوية', active: true },
  { id: 4, name: 'منة الله حسن', phone: '01000000013', parentPhone: '01100000013', year: 2, school: 'مدرسة النيل الثانوية', active: true },
  { id: 5, name: 'كريم حسن سعيد', phone: '01000000014', parentPhone: '01100000014', year: 2, school: 'مدرسة الحرية الثانوية', active: true },
  { id: 6, name: 'نور محمد إبراهيم', phone: '01000000015', parentPhone: '01100000015', year: 3, school: 'مدرسة الشروق الثانوية', active: false }
];

const DEMO_ADMINS = [
  {
    id: 1,
    name: 'أدمن المنصة',
    email: 'admin@physics.society',
    phone: '01000000009',
    password: 'Admin@2026',
    role: 'owner',
    active: true
  }
];

const DEMO_TEACHERS = D.teachers.map((t, index) => ({
  id: t.id,
  name: t.name,
  phone: index === 0 ? '01100000001' : '01100000002',
  password: 'teacher123',
  description: t.description,
  picture: t.picture,
  visible: 1,
  active: true
}));

const DEFAULT_SETTINGS = {
  registrationOpen: true,
  paymentsMode: 'manual',
  notice: 'نسخة تجريبية لإعادة بناء الواجهة — لا يتم تحصيل أي مبالغ.',
  supportPhone: '01000000000',
  couponable: true
};

// ---------------------------------------------------------------------------
// بناء الحالة الابتدائية
// ---------------------------------------------------------------------------

function buildSeed() {
  const courses = D.courses.map((c, i) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    price: c.price,
    year: c.year,
    subjectId: c.subject_id,
    teacherId: c.teacher_id,
    visible: 1,
    isNew: !!c.isNew,
    renamed: !!c.renamed,
    picture: c.picture,
    createdAt: `2026-09-${pad(10 + i)}T12:00:00.000Z`,
    updatedAt: `2026-10-${pad(10 + i)}T12:00:00.000Z`
  }));

  const sections = [];
  const exams = [];
  const questions = [];
  let sectionId = 1;
  let lessonId = 1;
  let examId = 1;
  let questionId = 1;

  for (const course of courses) {
    const content = D.courseContent(course.id);
    content.forEach((sec, sIndex) => {
      const section = {
        id: sectionId++,
        courseId: course.id,
        name: sec.name,
        order: sIndex + 1,
        createdAt: nowISO()
      };
      section.lessons = [];
      for (const item of sec.sectionables) {
        if (item.sectionable_type === 'video') {
          const v = item.sectionable;
          section.lessons.push({
            id: lessonId++,
            sectionId: section.id,
            title: v.name,
            description: v.description,
            duration: v.duration_minutes,
            videoUrl: '/media/demo-video.html',
            isFree: !!v.is_free,
            published: true,
            order: section.lessons.length + 1
          });
        } else {
          const e = item.sectionable;
          const exam = {
            id: examId++,
            courseId: course.id,
            sectionId: section.id,
            teacherId: course.teacherId,
            title: e.name,
            type: e.type === 'hm' ? 'hm' : 'exam',
            duration: 60,
            published: true,
            createdAt: nowISO(),
            questions: []
          };
          for (let q = 0; q < 4; q++) {
            const isEssay = q === 3;
            const question = {
              id: questionId++,
              bankId: null,
              type: isEssay ? 'essay' : 'mcq',
              text: isEssay
                ? `اشرح بالتفصيل فكرة السؤال ${q + 1} في ${course.name}.`
                : `اختر الإجابة الصحيحة للسؤال ${q + 1} في ${course.name}.`,
              options: isEssay ? [] : ['الإجابة الأولى', 'الإجابة الثانية', 'الإجابة الثالثة', 'الإجابة الرابعة'],
              correct: isEssay ? null : q % 4,
              points: isEssay ? 5 : 2
            };
            exam.questions.push(question);
            questions.push({ ...question, examId: exam.id, courseId: course.id, teacherId: course.teacherId });
          }
          exams.push(exam);
        }
      }
      sections.push(section);
    });
  }

  // بنوك أسئلة لكل مدرس
  const qbanks = DEMO_TEACHERS.map((teacher, index) => {
    const bank = { id: index + 1, teacherId: teacher.id, name: `بنك أسئلة ${teacher.name}`, createdAt: nowISO(), questions: [] };
    for (let q = 0; q < 6; q++) {
      const isEssay = q === 5;
      bank.questions.push({
        id: 1000 + index * 100 + q,
        type: isEssay ? 'essay' : 'mcq',
        text: isEssay
          ? 'اشرح الفرق بين المجال الكهربي والمجال المغناطيسي مع مثال.'
          : `سؤال اختيار من متعدد رقم ${q + 1} — ${teacher.name}`,
        options: isEssay ? [] : ['اختيار أ', 'اختيار ب', 'اختيار ج', 'اختيار د'],
        correct: isEssay ? null : q % 4,
        points: isEssay ? 5 : 2
      });
    }
    return bank;
  });

  // فواتير واشتراكات
  const invoices = [
    { id: 1, reference: 'DEMO-001-100001', studentId: 1, courseId: 1, amount: 250, status: 'paid', createdAt: '2026-10-20T10:00:00.000Z', paidAt: '2026-10-20T10:05:00.000Z' },
    { id: 2, reference: 'DEMO-002-100002', studentId: 2, courseId: 2, amount: 300, status: 'paid', createdAt: '2026-10-22T12:30:00.000Z', paidAt: '2026-10-22T12:40:00.000Z' },
    { id: 3, reference: 'DEMO-003-100003', studentId: 3, courseId: 1, amount: 250, status: 'pending', createdAt: '2026-10-29T09:15:00.000Z', paidAt: null },
    { id: 4, reference: 'DEMO-004-100004', studentId: 4, courseId: 5, amount: 220, status: 'pending', createdAt: '2026-10-30T16:45:00.000Z', paidAt: null },
    { id: 5, reference: 'DEMO-005-100005', studentId: 5, courseId: 6, amount: 200, status: 'cancelled', createdAt: '2026-10-18T08:00:00.000Z', paidAt: null }
  ];

  const subscriptions = [
    { id: 1, studentId: 1, courseId: 1, invoiceId: 1, createdAt: '2026-10-20T10:05:00.000Z', progress: 62 },
    { id: 2, studentId: 1, courseId: 2, invoiceId: null, createdAt: '2026-10-24T09:00:00.000Z', progress: 25 },
    { id: 3, studentId: 2, courseId: 2, invoiceId: 2, createdAt: '2026-10-22T12:40:00.000Z', progress: 40 },
    { id: 4, studentId: 3, courseId: 3, invoiceId: null, createdAt: '2026-10-26T18:00:00.000Z', progress: 12 }
  ];

  const codes = [
    { id: 1, code: 'PS-AAAA-1111', courseId: 1, value: 250, createdAt: '2026-10-01T10:00:00.000Z', used: false, usedBy: null, revoked: false },
    { id: 2, code: 'PS-BBBB-2222', courseId: 2, value: 300, createdAt: '2026-10-05T10:00:00.000Z', used: true, usedBy: 2, revoked: false },
    { id: 3, code: 'PS-CCCC-3333', courseId: 4, value: 150, createdAt: '2026-10-10T10:00:00.000Z', used: false, usedBy: null, revoked: false }
  ];

  const attempts = [
    {
      id: 1,
      examId: 1,
      studentId: 1,
      submittedAt: '2026-10-28T20:10:00.000Z',
      status: 'pending',
      total: 0,
      maxScore: 11,
      answers: [
        { questionId: 1, answer: '1', score: 2 },
        { questionId: 2, answer: '0', score: 0 },
        { questionId: 3, answer: '2', score: 2 },
        { questionId: 4, answer: 'التيار الكهربي هو حركة الشحنات داخل موصل، والمجال المغناطيسي ينشأ حول الشحنات المتحركة.', score: null }
      ]
    },
    {
      id: 2,
      examId: 5,
      studentId: 2,
      submittedAt: '2026-10-29T19:00:00.000Z',
      status: 'pending',
      total: 0,
      maxScore: 11,
      answers: [
        { questionId: 1, answer: '0', score: 0 },
        { questionId: 2, answer: '1', score: 2 },
        { questionId: 3, answer: '3', score: 0 },
        { questionId: 4, answer: 'المجال الكهربي يؤثر على الشحنات الساكنة، بينما المغناطيسي يؤثر على الشحنات المتحركة.', score: null }
      ]
    }
  ];

  const qa = [
    {
      id: 1,
      courseId: 1,
      teacherId: 1,
      studentId: 1,
      question: 'إزاي أفرق بين الاتجاه المغناطيسي والاتجاه التياري في قاعدة اليد اليمنى؟',
      answer: null,
      status: 'open',
      createdAt: '2026-10-27T18:30:00.000Z'
    },
    {
      id: 2,
      courseId: 2,
      teacherId: 1,
      studentId: 3,
      question: 'في مسألة الملف الدائري، إمتى أستخدم القانون اللي فيه N وإمتى أستخدمه من غير N؟',
      answer: 'لما يكون عندك أكثر من لفة استخدم N، ولو لفة واحدة استخدم القانون من غيرها.',
      status: 'answered',
      createdAt: '2026-10-25T12:00:00.000Z'
    }
  ];

  const communityPosts = D.communityPosts.map((p, index) => ({
    ...p,
    is_approved: index < D.communityPosts.length - 2 ? true : false
  }));

  const audit = [];

  return {
    version: SEED_VERSION,
    admins: DEMO_ADMINS,
    teachers: DEMO_TEACHERS,
    students: DEMO_STUDENTS,
    subjects: D.subjects.map(s => ({
      id: s.id,
      name: s.name,
      year: s.year,
      visible: s.visible,
      description: s.description,
      teacherIds: s.teachers.map(t => t.id)
    })),
    courses,
    sections,
    exams,
    questions,
    qbanks,
    invoices,
    subscriptions,
    codes,
    attempts,
    qa,
    communityCategories: clone(D.communityCategories),
    communityPosts,
    settings: { ...DEFAULT_SETTINGS },
    audit
  };
}

// ---------------------------------------------------------------------------
// تحميل / حفظ
// ---------------------------------------------------------------------------

function load() {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SEED_VERSION) return buildSeed();
    return parsed;
  } catch (err) {
    return buildSeed();
  }
}

const state = load();
let persistEnabled = true;

function save() {
  if (!persistEnabled) return false;
  try {
    fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
    const tmp = `${STORE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, STORE_FILE);
    return true;
  } catch (err) {
    persistEnabled = false;
    console.warn('[store] تعذّر الحفظ، سيتم العمل في الذاكرة فقط:', err.message);
    return false;
  }
}

function audit(actor, action, details) {
  state.audit.unshift({
    id: nextId(state.audit),
    actor,
    action,
    details: details || '',
    at: nowISO()
  });
  if (state.audit.length > 300) state.audit.length = 300;
}

// ---------------------------------------------------------------------------
// أشكال القراءة (متوافقة مع واجهة الطالب)
// ---------------------------------------------------------------------------

function teacherById(id) {
  return state.teachers.find(t => Number(t.id) === Number(id)) || null;
}

function subjectById(id) {
  return state.subjects.find(s => Number(s.id) === Number(id)) || null;
}

function courseById(id) {
  return state.courses.find(c => Number(c.id) === Number(id)) || null;
}

function courseEntity(course) {
  if (!course) return null;
  const teacher = teacherById(course.teacherId);
  const subject = subjectById(course.subjectId);
  return {
    id: course.id,
    name: course.name,
    description: course.description,
    price: course.price,
    isNew: !!course.isNew,
    picture: course.picture,
    isStaticPicture: false,
    updated_at: course.updatedAt,
    created_at: course.createdAt,
    subscriptions_count: state.subscriptions.filter(s => Number(s.courseId) === Number(course.id)).length,
    is_course_renamed: !!course.renamed,
    renamed: !!course.renamed,
    isYear: false,
    isPrepaid: false,
    is_pinned: course.id === 1 ? 1 : 0,
    sellable: { id: course.id, type: 'course' },
    year: course.year,
    subject_id: course.subjectId,
    teacher_id: course.teacherId,
    teacher: teacher ? { id: teacher.id, name: teacher.name, picture: teacher.picture } : null,
    subject: subject ? { id: subject.id, name: subject.name } : null
  };
}

function visibleCourses() {
  return state.courses.filter(c => Number(c.visible) === 1);
}

function coursesForYear(year) {
  return visibleCourses().filter(c => Number(c.year) === Number(year)).map(courseEntity);
}

function coursesForSubject(subjectId) {
  return visibleCourses().filter(c => Number(c.subjectId) === Number(subjectId)).map(courseEntity);
}

function coursesForTeacher(teacherId, onlyRenamed) {
  return visibleCourses()
    .filter(c => Number(c.teacherId) === Number(teacherId) && !!c.renamed === !!onlyRenamed)
    .map(courseEntity);
}

function sectionsForCourse(courseId) {
  return state.sections
    .filter(s => Number(s.courseId) === Number(courseId))
    .sort((a, b) => a.order - b.order);
}

function examsForCourse(courseId) {
  return state.exams.filter(e => Number(e.courseId) === Number(courseId) && e.published);
}

function courseDetail(id) {
  const course = courseById(id);
  if (!course) return null;
  const entity = courseEntity(course);
  const lessons = sectionsForCourse(course.id).flatMap(s => s.lessons);
  const exams = examsForCourse(course.id);
  const totalMinutes = lessons.reduce((sum, l) => sum + (Number(l.duration) || 0), 0);
  return {
    ...entity,
    course_type: 'normal',
    is_disabled_counts: false,
    first_free_video: {
      platform: null,
      first_free_video_section_id: null,
      first_free_video_sectionable_id: null
    },
    videos_count: lessons.length,
    exams_count: exams.filter(e => e.type !== 'hm').length,
    hms_count: exams.filter(e => e.type === 'hm').length,
    books_count: 1,
    questions_count: exams.reduce((sum, e) => sum + e.questions.length, 0),
    total_questions_quantity: exams.reduce((sum, e) => sum + e.questions.length, 0),
    total_videos_duration: totalMinutes,
    available_to_subscribe: true,
    available_seats: null,
    center_reservation_opens_at: null,
    center_schedule: null,
    center_map_url: null,
    is_available_for_custom_assigned_subscription: false,
    is_couponable: !!state.settings.couponable,
    upgradable_from_course_id: null,
    prepaidable: false,
    subscription_id: null,
    serial: null,
    pin_code: null
  };
}

function courseContent(id) {
  const course = courseById(id);
  if (!course) return [];
  return sectionsForCourse(course.id).map(section => {
    const sectionables = [];
    for (const lesson of section.lessons) {
      if (!lesson.published) continue;
      sectionables.push({
        id: lesson.id,
        sectionable_type: 'video',
        sectionable_id: lesson.id,
        is_locked: false,
        key_item: false,
        visible_from: null,
        visible_to: null,
        sectionable: {
          id: lesson.id,
          name: lesson.title,
          description: lesson.description,
          platform: 'bunny',
          source: lesson.videoUrl,
          duration: (Number(lesson.duration) || 0) * 60,
          duration_minutes: Number(lesson.duration) || 0,
          total_time_played: 0,
          is_free: !!lesson.isFree,
          limit_reached: false,
          views_count: 120 + lesson.id * 7,
          percentage: null,
          otp: null
        }
      });
    }
    for (const exam of examsForCourse(course.id).filter(e => Number(e.sectionId) === Number(section.id))) {
      sectionables.push({
        id: exam.id,
        sectionable_type: 'exam',
        sectionable_id: exam.id,
        is_locked: false,
        key_item: false,
        visible_from: null,
        visible_to: null,
        sectionable: {
          id: exam.id,
          name: exam.title,
          type: exam.type,
          description: exam.type === 'hm' ? 'واجب على الجزء الحالي — حل الأسئلة ثم أرسل إجاباتك.' : 'امتحان شامل على الجزء الحالي.',
          duration: (Number(exam.duration) || 60) * 60,
          questions_count: exam.questions.length,
          exam_results_min_result_percentage: 0,
          exam_results_medium_percentage: 0,
          exam_results_max_result_percentage: 0,
          exam_results_count: 0,
          exam_results_finished_count: 0,
          percentage: null,
          score_text: null,
          attempts_count: 0
        }
      });
    }
    return {
      id: section.id,
      name: section.name,
      first_upload_date: section.createdAt.replace('T', ' ').slice(0, 19),
      sectionables
    };
  });
}

function findSectionable(courseId, sectionId, sectionableId) {
  const section = courseContent(courseId).find(s => Number(s.id) === Number(sectionId));
  if (!section) return null;
  return (
    section.sectionables.find(
      s => Number(s.id) === Number(sectionableId) || Number(s.sectionable_id) === Number(sectionableId)
    ) || null
  );
}

module.exports = {
  STORE_FILE,
  state,
  save,
  audit,
  nextId,
  nowISO,
  clone,
  teacherById,
  subjectById,
  courseById,
  courseEntity,
  visibleCourses,
  coursesForYear,
  coursesForSubject,
  coursesForTeacher,
  sectionsForCourse,
  examsForCourse,
  courseDetail,
  courseContent,
  findSectionable
};
