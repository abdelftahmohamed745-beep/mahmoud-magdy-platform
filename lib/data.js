'use strict';
/*
 * بيانات عرض توضيحية (Demo) لنسخة إعادة البناء.
 *
 * ملاحظة مهمة: البيانات هنا ليست بيانات الطلاب أو الكورسات الحقيقية على المنصة
 * الأصلية. كل الأسماء والأرقام والأسعار والصور محتوى تجريبي مُصمم فقط لكي تعمل
 * واجهة التطبيق (React bundle) بنفس الشكل والسلوك دون الاتصال بخوادم الغير.
 */

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJSON(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
  } catch (err) {
    return fallback;
  }
}

const governments = readJSON('governments.json', []);
const departments = readJSON('departments.json', []);
const centersYear3 = readJSON('centers-year3.json', []);
const storeLocators = readJSON('store-locators.json', []);

const TEACHER_1 = {
  id: 1,
  name: 'م. محمود مجدي',
  description:
    'مدرس الفيزياء للثانوية العامة. شرح مبسط، حل مسائل بأكثر من طريقة، ومتابعة مستمرة لحد ما تقفل المنهج.',
  picture: 'media/teacher-1.svg',
  visible: 1,
  subjects_count: 2,
  courses_count: 6
};

const TEACHER_2 = {
  id: 2,
  name: 'م. أحمد سالم',
  description: 'مدرس الفيزياء للصف الثاني الثانوي — تأسيس وحل مسائل خطوة بخطوة.',
  picture: 'media/teacher-2.svg',
  visible: 1,
  subjects_count: 1,
  courses_count: 2
};

const SUBJECT_1 = {
  id: 1,
  name: 'الفيزياء',
  year: 3,
  visible: 1,
  teachers: [{ id: TEACHER_1.id, name: TEACHER_1.name }],
  teachers_count: 1,
  courses_count: 6,
  description: 'منهج الفيزياء كامل للصف الثالث الثانوي: شرح + حل مسائل + مراجعات وامتحانات.'
};

const SUBJECT_2 = {
  id: 2,
  name: 'الفيزياء',
  year: 2,
  visible: 1,
  teachers: [{ id: TEACHER_2.id, name: TEACHER_2.name }, { id: TEACHER_1.id, name: TEACHER_1.name }],
  teachers_count: 2,
  courses_count: 2,
  description: 'منهج الفيزياء للصف الثاني الثانوي: تأسيس قوي وحل مسائل.'
};

const SUBJECTS = [SUBJECT_1, SUBJECT_2];

const TEACHERS = [
  {
    ...TEACHER_1,
    subjects: [
      { id: SUBJECT_1.id, name: SUBJECT_1.name, year: SUBJECT_1.year },
      { id: SUBJECT_2.id, name: SUBJECT_2.name, year: SUBJECT_2.year }
    ]
  },
  {
    ...TEACHER_2,
    subjects: [{ id: SUBJECT_2.id, name: SUBJECT_2.name, year: SUBJECT_2.year }]
  }
];

const COURSE_SEED = [
  {
    id: 1,
    name: 'الفيزياء — الكهرباء التيارية',
    description: 'شرح كامل لفصل الكهرباء التيارية مع حل مسائل الكتاب والامتحانات السابقة خطوة بخطوة.',
    price: 250,
    year: 3,
    subject_id: 1,
    teacher_id: 1,
    picture: 'media/covers/course-1.svg',
    is_new: true,
    renamed: true,
    videos: 12,
    exams: 4,
    hms: 3,
    books: 2,
    duration_minutes: 420
  },
  {
    id: 2,
    name: 'الفيزياء — المغناطيسية',
    description: 'كل قوانين المغناطيسية ومسائلها، مع أفكار الامتحانات وتدريب على الأسئلة المقالية.',
    price: 300,
    year: 3,
    subject_id: 1,
    teacher_id: 1,
    picture: 'media/covers/course-2.svg',
    is_new: true,
    renamed: true,
    videos: 10,
    exams: 3,
    hms: 2,
    books: 1,
    duration_minutes: 360
  },
  {
    id: 3,
    name: 'الفيزياء — الفيزياء الحديثة',
    description: 'شرح الفيزياء الحديثة من الصفر: الكم، الإشعاع، والظواهر الحديثة بأمثلة مبسطة.',
    price: 280,
    year: 3,
    subject_id: 1,
    teacher_id: 1,
    picture: 'media/covers/course-3.svg',
    is_new: false,
    renamed: true,
    videos: 9,
    exams: 3,
    hms: 2,
    books: 1,
    duration_minutes: 330
  },
  {
    id: 4,
    name: 'مراجعة ليلة الامتحان',
    description: 'مراجعة نهائية مركزة على أهم الأفكار والقوانين وأكثر الأسئلة تكرارًا في الامتحان.',
    price: 150,
    year: 3,
    subject_id: 1,
    teacher_id: 1,
    picture: 'media/covers/course-4.svg',
    is_new: true,
    renamed: true,
    videos: 6,
    exams: 2,
    hms: 1,
    books: 1,
    duration_minutes: 210
  },
  {
    id: 5,
    name: 'الفيزياء — الحركة الدورانية',
    description: 'تأسيس شامل للحركة الدورانية مع حل مسائل متنوعة وتدريبات على كل فكرة.',
    price: 220,
    year: 2,
    subject_id: 2,
    teacher_id: 2,
    picture: 'media/covers/course-5.svg',
    is_new: false,
    renamed: false,
    videos: 8,
    exams: 3,
    hms: 2,
    books: 1,
    duration_minutes: 300
  },
  {
    id: 6,
    name: 'الفيزياء — الجاذبية',
    description: 'شرح الجاذبية وقوانينها ومسائلها، مع أمثلة من الامتحانات السابقة.',
    price: 200,
    year: 2,
    subject_id: 2,
    teacher_id: 2,
    picture: 'media/covers/course-6.svg',
    is_new: false,
    renamed: false,
    videos: 7,
    exams: 2,
    hms: 1,
    books: 1,
    duration_minutes: 270
  },
  {
    id: 7,
    name: 'حل مسائل الكهرباء — مستوى متقدم',
    description: 'كورس منفصل لحل أصعب مسائل الكهرباء بأكثر من طريقة وبخطوات واضحة.',
    price: 180,
    year: 3,
    subject_id: 1,
    teacher_id: 1,
    picture: 'media/covers/course-7.svg',
    is_new: false,
    renamed: false,
    videos: 5,
    exams: 1,
    hms: 1,
    books: 0,
    duration_minutes: 180
  },
  {
    id: 8,
    name: 'التأسيس في الفيزياء',
    description: 'كورس تأسيسي لمن عايز يبدأ صح: المفاهيم الأساسية والوحدات والقياس وحل مسائل بسيطة.',
    price: 120,
    year: 2,
    subject_id: 2,
    teacher_id: 1,
    picture: 'media/covers/course-8.svg',
    is_new: true,
    renamed: true,
    videos: 6,
    exams: 2,
    hms: 1,
    books: 1,
    duration_minutes: 240
  }
];

function toEntity(seed) {
  const teacher = TEACHERS.find(t => t.id === seed.teacher_id);
  const subject = SUBJECTS.find(s => s.id === seed.subject_id);
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    price: seed.price,
    isNew: !!seed.is_new,
    picture: seed.picture,
    isStaticPicture: false,
    updated_at: seed.updated_at || `2026-10-${String(10 + seed.id).padStart(2, '0')}T12:00:00.000000Z`,
    created_at: seed.created_at || `2026-09-${String(10 + seed.id).padStart(2, '0')}T12:00:00.000000Z`,
    subscriptions_count: 0,
    is_course_renamed: !!seed.renamed,
    renamed: !!seed.renamed,
    isYear: false,
    isPrepaid: false,
    is_pinned: seed.id === 1 ? 1 : 0,
    sellable: { id: seed.id, type: 'course' },
    year: seed.year,
    subject_id: seed.subject_id,
    teacher_id: seed.teacher_id,
    teacher: teacher ? { id: teacher.id, name: teacher.name, picture: teacher.picture } : null,
    subject: subject ? { id: subject.id, name: subject.name } : null
  };
}

// القائمة كما ترجعها الواجهة في بطاقات الكورسات.
const COURSES = COURSE_SEED.map(toEntity);

function courseCard(course, opts = {}) {
  return {
    ...course,
    ...opts
  };
}

function coursesForYear(year) {
  return COURSES.filter(c => Number(c.year) === Number(year)).map(c => courseCard(c));
}

function coursesForSubject(subjectId) {
  return COURSES.filter(c => c.subject_id === Number(subjectId)).map(c => courseCard(c));
}

function coursesForTeacher(teacherId, onlyRenamed) {
  return COURSES.filter(c => c.teacher_id === Number(teacherId) && !!COURSE_SEED.find(s => s.id === c.id).renamed === !!onlyRenamed)
    .map(c => courseCard(c));
}

function courseDetail(id) {
  const course = COURSES.find(c => c.id === Number(id));
  if (!course) return null;
  const seed = COURSE_SEED.find(s => s.id === course.id);
  return {
    ...course,
    course_type: 'normal',
    is_disabled_counts: false,
    first_free_video: {
      platform: null,
      first_free_video_section_id: null,
      first_free_video_sectionable_id: null
    },
    videos_count: seed.videos,
    exams_count: seed.exams,
    hms_count: seed.hms,
    books_count: seed.books,
    questions_count: seed.exams * 10 + 15,
    total_questions_quantity: seed.exams * 10 + 15,
    total_videos_duration: Math.round((seed.duration_minutes / 60) * 10) / 10,
    available_to_subscribe: true,
    available_seats: null,
    center_reservation_opens_at: null,
    center_schedule: null,
    center_map_url: null,
    is_available_for_custom_assigned_subscription: false,
    is_couponable: true,
    upgradable_from_course_id: null,
    prepaidable: false,
    subscription_id: null,
    serial: null,
    pin_code: null
  };
}

const SECTION_TITLES = ['الأسبوع الأول', 'الأسبوع الثاني', 'الأسبوع الثالث', 'المراجعة النهائية'];

function courseContent(id) {
  const seed = COURSE_SEED.find(s => s.id === Number(id));
  if (!seed) return [];
  const sections = [];
  const totalSections = 3;
  const videosPer = Math.max(2, Math.ceil(seed.videos / totalSections));
  const examsPer = Math.max(1, Math.ceil(seed.exams / totalSections));
  let videoId = 1;
  let examId = 1;
  let sectionableId = Number(id) * 1000;
  for (let s = 0; s < totalSections; s++) {
    const sectionables = [];
    for (let v = 0; v < videosPer && videoId <= seed.videos; v++, videoId++) {
      const durationMinutes = 18 + (videoId % 5) * 7;
      sectionables.push({
        id: ++sectionableId,
        sectionable_type: 'video',
        sectionable_id: videoId,
        is_locked: false,
        key_item: false,
        visible_from: null,
        visible_to: null,
        sectionable: {
          id: videoId,
          name: `${seed.name} — الحصة ${videoId}`,
          description: `شرح الحصة ${videoId} من ${seed.name} مع حل الأمثلة والمسائل.`,
          platform: 'bunny',
          source: '/media/demo-video.html',
          duration: durationMinutes * 60,
          duration_minutes: durationMinutes,
          total_time_played: 0,
          is_free: videoId === 1,
          limit_reached: false,
          views_count: 120 + videoId * 37,
          percentage: videoId % 4 === 0 ? 70 : videoId % 3 === 0 ? 35 : null,
          otp: null
        }
      });
    }
    for (let e = 0; e < examsPer && examId <= seed.exams; e++, examId++) {
      const isHm = examId % 3 === 0;
      sectionables.push({
        id: ++sectionableId,
        sectionable_type: 'exam',
        sectionable_id: 5000 + examId,
        is_locked: false,
        key_item: false,
        visible_from: null,
        visible_to: null,
        sectionable: {
          id: 5000 + examId,
          name: isHm ? `واجب ${examId}` : `امتحان ${examId}`,
          type: isHm ? 'hm' : 'exam',
          description: isHm
            ? 'واجب على الجزء الحالي — حل الأسئلة ثم أرسل إجاباتك.'
            : 'امتحان شامل على الجزء الحالي — راجع الشرح قبل البدء.',
          duration: 3600,
          questions_count: 20,
          exam_results_min_result_percentage: 0,
          exam_results_medium_percentage: 0,
          exam_results_max_result_percentage: 0,
          exam_results_count: 0,
          exam_results_finished_count: 0,
          percentage: examId % 2 === 0 ? 85 : null,
          score_text: examId % 2 === 0 ? '17 / 20' : null,
          attempts_count: examId % 2 === 0 ? 1 : 0
        }
      });
    }
    sections.push({
      id: s + 1,
      name: SECTION_TITLES[s] || `الجزء ${s + 1}`,
      first_upload_date: `2026-09-${String(14 + s).padStart(2, '0')} 12:00:00`,
      sectionables
    });
  }
  return sections;
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


const USER = {
  id: 1,
  first_name: 'محمود',
  second_name: 'محمد',
  third_name: 'مجدي',
  last_name: 'عبد الله',
  full_name: 'محمود محمد مجدي عبد الله',
  name: 'محمود محمد مجدي عبد الله',
  phone: 1000000000,
  parent_phone: 1100000001,
  email: 'demo@example.com',
  year: 3,
  year_id: 3,
  center_id: 1,
  center: { id: 1, name: 'سنتر النور' },
  department_id: 1,
  department: { id: 1, name: departments[0] ? departments[0].text : 'مسار الهندسة وعلوم الحاسب' },
  school: 'مدرسة النور الثانوية',
  school_name: 'مدرسة النور الثانوية',
  gender: 'male',
  national_id: '30001011234567',
  is_active: true,
  is_already_migrated: true,
  roles: ['student'],
  tokens_count: 1,
  created_at: '2026-08-01T12:00:00.000000Z'
};

const DEMO_CREDENTIALS = {
  phone: 1000000000,
  phone_text: '01000000000',
  password: '246810'
};

const CATEGORIES = [
  {
    id: 1,
    titleFirst: 'أحدث',
    titleLast: 'الكورسات',
    courses: COURSES.filter(c => Number(c.year) === 3),
    visible: 1
  }
];

const COMMUNITY_CATEGORIES = [
  {
    id: 1,
    name: 'فيزياء الثالث الثانوي',
    description: 'اسأل في أي فكرة في المنهج وهنجاوبك خطوة بخطوة.',
    updated_at: '2026-10-27T18:30:00.000000Z',
    community_posts_count: 4,
    visible: 1,
    is_required_approvment_to_post: false,
    limit_community_post: 0,
    limit_duration_community_post: 0
  },
  {
    id: 2,
    name: 'فيزياء الثاني الثانوي',
    description: 'مساحة لمتابعة منهج الصف الثاني وحل المسائل.',
    updated_at: '2026-10-24T11:15:00.000000Z',
    community_posts_count: 2,
    visible: 1,
    is_required_approvment_to_post: false,
    limit_community_post: 0,
    limit_duration_community_post: 0
  },
  {
    id: 3,
    name: 'أسئلة وأجوبة',
    description: 'كل الأسئلة السريعة اللي محتاجة إجابة قصيرة.',
    updated_at: '2026-10-20T09:05:00.000000Z',
    community_posts_count: 2,
    visible: 1,
    is_required_approvment_to_post: false,
    limit_community_post: 0,
    limit_duration_community_post: 0
  }
];

const POST_TEMPLATES = [
  {
    category_id: 1,
    description: 'إزاي أفرق بين الاتجاه المغناطيسي والاتجاه التياري في قاعدة اليد اليمنى؟',
    name: 'محمود محمد'
  },
  {
    category_id: 1,
    description: 'في مسألة الملف الدائري، إمتى أستخدم القانون اللي فيه N وإمتى أستخدمه من غير N؟',
    name: 'سارة أحمد'
  },
  {
    category_id: 1,
    description: 'أفضل طريقة لمراجعة الكهرباء قبل الامتحان؟',
    name: 'يوسف علي'
  },
  {
    category_id: 1,
    description: 'لو سمحت يا مستر، ممكن حلة لمسألة ١٥ صفحة ٢٣؟',
    name: 'منة الله'
  },
  {
    category_id: 2,
    description: 'ممكن شرح مبسط للفرق بين السرعة المتوسطة والسرعة اللحظية؟',
    name: 'كريم حسن'
  },
  {
    category_id: 2,
    description: 'إمتى نستخدم معادلة الحركة التانية؟',
    name: 'نور محمد'
  },
  {
    category_id: 3,
    description: 'الوحدة بتاعت شدة المجال المغناطيسي إيه؟',
    name: 'أحمد مصطفى'
  },
  {
    category_id: 3,
    description: 'هل قانون أوم ينطبق على كل المواد؟',
    name: 'هبة سامي'
  }
];

const COMMUNITY_POSTS = POST_TEMPLATES.map((p, index) => ({
  id: index + 1,
  community_category_id: p.category_id,
  description: p.description,
  image_source: null,
  created_at: `2026-10-${String(28 - index).padStart(2, '0')}T${String(10 + index).padStart(2, '0')}:20:00.000000Z`,
  updated_at: `2026-10-${String(28 - index).padStart(2, '0')}T${String(10 + index).padStart(2, '0')}:20:00.000000Z`,
  is_approved: true,
  is_admin_post: false,
  is_seen: true,
  user: { id: index + 10, full_name: p.name },
  community_comments: [],
  community_tags: [],
  comments_count: 0
}));

const DEMO_PHONE = DEMO_CREDENTIALS.phone;
const DEMO_FATHER_PHONE = 1100000001;

const STATISTICS = {
  viewed_videos_count: 24,
  total_videos_count: 96,
  finished_exams_count: 11,
  total_exams_count: 34,
  total_results: 78,
  total_full_result: 100,
  total_video_open_duration: 31200,
  total_video_view_count: 59,
  total_exam_results_count: 27,
  finished_exam_results_count: 18
};

function parentDashboard(phone, fatherPhone) {
  // نسمح برقم الطالب التجريبي أو أي رقمين متطابقين مع الحساب التجريبي.
  const p = Number(phone);
  const f = Number(fatherPhone);
  if (p !== DEMO_PHONE && f !== DEMO_FATHER_PHONE && p !== f) {
    return { full_name: null, courses: [] };
  }
  return {
    full_name: USER.full_name,
    phone: DEMO_PHONE,
    courses: COURSES.filter(c => Number(c.year) === 3).map(c => ({
      id: c.id,
      name: c.name,
      sections: [
        {
          id: 1,
          name: 'الأسبوع الأول',
          first_upload_date: '2026-09-14 12:00:00',
          follow_up_data: {
            videos: [78, 62],
            exams: [85, 74, 0],
            hms: [90, 80, 'present']
          }
        }
      ]
    }))
  };
}

module.exports = {
  governments,
  departments,
  centersYear3,
  storeLocators,
  subjects: SUBJECTS,
  teachers: TEACHERS,
  courses: COURSES,
  user: USER,
  demoCredentials: DEMO_CREDENTIALS,
  statistics: STATISTICS,
  categories: CATEGORIES,
  communityCategories: COMMUNITY_CATEGORIES,
  communityPosts: COMMUNITY_POSTS,
  coursesForYear,
  coursesForSubject,
  coursesForTeacher,
  courseDetail,
  courseContent,
  findSectionable,
  parentDashboard
};
