'use strict';
/*
 * أقسام مشتركة بين لوحة الأدمن ولوحة المدرس:
 * الكورسات ومحتواها، بنوك الأسئلة، الامتحانات، الطلاب، أكواد الشحن.
 */
window.PSX = (function () {
  const P = window.PS;
  const { esc, icon, api, qs, toast, formModal, openModal, confirmModal, readForm } = P;

  const YEARS = [
    { value: 1, label: 'الصف الأول الثانوي' },
    { value: 2, label: 'الصف الثاني الثانوي' },
    { value: 3, label: 'الصف الثالث الثانوي' }
  ];

  function yearLabel(year) {
    const found = YEARS.find(y => String(y.value) === String(year));
    return found ? found.label : `سنة ${year || '—'}`;
  }

  function actionsCell(html) {
    return `<div class="actions">${html}</div>`;
  }

  function courseImage(course) {
    const src = course.picture ? `/${String(course.picture).replace(/^\/+/, '')}` : '/media/covers/course-1.svg';
    return `<img src="${esc(src)}" alt="" onerror="this.style.display='none'" />`;
  }

  async function loadCourses() {
    const data = await api('/courses');
    return data.data || [];
  }

  async function loadSubjects() {
    const data = await api('/subjects');
    return data.data || [];
  }

  async function loadTeachers() {
    const data = await api('/teachers');
    return data.data || [];
  }

  async function loadBanks() {
    const data = await api('/qbanks');
    return data.data || [];
  }

  // =======================================================================
  // الكورسات
  // =======================================================================

  async function renderCourses(view, mode) {
    const isTeacher = mode === 'teacher';
    view.innerHTML = `
      ${P.pageHead(
        isTeacher ? 'كورساتي' : 'الكورسات',
        isTeacher ? 'عدّل بيانات كورساتك وأدر الأقسام والحصص والامتحانات.' : 'أضف الكورسات وعدّل محتواها واربطها بالمواد والمدرسين.',
        isTeacher ? '' : `<button type="button" class="btn" id="add-course">${icon('plus')} كورس جديد</button>`
      )}
      <div class="card">
        <div class="card-head">
          <div class="toolbar" style="flex:1">
            <div class="search">${icon('search')}<input type="search" id="course-search" placeholder="ابحث باسم الكورس…" /></div>
            <select id="course-year">
              <option value="">كل الصفوف</option>
              ${YEARS.map(y => `<option value="${y.value}">${esc(y.label)}</option>`).join('')}
            </select>
          </div>
          <div id="course-count" class="badge brand plain"></div>
        </div>
        <div id="courses-table"></div>
      </div>`;

    const tableBox = view.querySelector('#courses-table');
    const countBox = view.querySelector('#course-count');
    const state = { q: '', year: '' };

    async function load() {
      tableBox.innerHTML = P.loadingBlock('جارٍ تحميل الكورسات…');
      const rows = await api('/courses' + qs(state)).then(data => data.data || []);
      countBox.textContent = `${P.fmtNumber(rows.length)} كورس`;

      if (!rows.length) {
        tableBox.innerHTML = P.emptyState('لا توجد كورسات مطابقة', 'جرّب تغيير كلمة البحث أو الصف.', 'layers');
        return;
      }

      const columns = [
        {
          label: 'الكورس',
          render: course => `<div class="course-chip">${courseImage(course)}<div>
            <div class="cc-name">${esc(course.name)}</div>
            <div class="cc-sub">${esc(course.subjectName || '')} · ${esc(yearLabel(course.year))}</div>
          </div></div>`
        },
        { label: 'المدرس', render: course => esc(course.teacherName || '—') },
        { label: 'السعر', render: course => `<span class="num">${esc(P.fmtMoney(course.price))}</span>` },
        {
          label: 'المحتوى',
          render: course => `<span class="badge plain">${P.fmtNumber(course.lessons)} حصة</span> <span class="badge plain">${P.fmtNumber(course.exams)} امتحان</span>`
        },
        { label: 'الطلاب', render: course => P.fmtNumber(course.students) },
        {
          label: 'الحالة',
          render: course =>
            Number(course.visible) === 1 ? P.badge('ظاهر', 'ok') : P.badge('مخفي', 'danger')
        },
        {
          label: 'الإجراءات',
          render: course =>
            actionsCell(`
              <button type="button" class="btn soft sm" data-content="${course.id}">${icon('layers')} المحتوى</button>
              <button type="button" class="btn ghost sm" data-edit="${course.id}">${icon('edit')} تعديل</button>
              ${isTeacher ? '' : `<button type="button" class="btn ghost sm" data-delete="${course.id}" title="حذف">${icon('trash')}</button>`}
            `)
        }
      ];

      tableBox.innerHTML = P.table(columns, rows);

      tableBox.querySelectorAll('[data-edit]').forEach(button => {
        button.addEventListener('click', () => {
          const course = rows.find(row => String(row.id) === button.dataset.edit);
          if (course) openCourseForm(mode, course, load);
        });
      });

      tableBox.querySelectorAll('[data-content]').forEach(button => {
        button.addEventListener('click', () => {
          const course = rows.find(row => String(row.id) === button.dataset.content);
          if (course) openContentModal(course);
        });
      });

      tableBox.querySelectorAll('[data-delete]').forEach(button => {
        button.addEventListener('click', () => {
          const course = rows.find(row => String(row.id) === button.dataset.delete);
          if (!course) return;
          confirmModal({
            title: 'حذف الكورس',
            message: `سيتم حذف «${course.name}» وكل أقسامه وامتحاناته واشتراكاته. هل تريد المتابعة؟`,
            confirmLabel: 'حذف نهائي',
            onConfirm: async () => {
              await api(`/courses/${course.id}`, { method: 'DELETE' });
              toast('تم حذف الكورس.', 'ok');
              load();
            }
          });
        });
      });
    }

    const search = view.querySelector('#course-search');
    search.addEventListener('input', P.debounce(() => {
      state.q = search.value.trim();
      load();
    }, 260));
    view.querySelector('#course-year').addEventListener('change', event => {
      state.year = event.target.value;
      load();
    });

    const addButton = view.querySelector('#add-course');
    if (addButton) addButton.addEventListener('click', () => openCourseForm(mode, null, load));

    await load();
  }

  async function openCourseForm(mode, course, onDone) {
    const isTeacher = mode === 'teacher';
    let subjects = [];
    let teachers = [];

    if (!isTeacher) {
      [subjects, teachers] = await Promise.all([loadSubjects(), loadTeachers()]);
    }

    const body = `
      ${P.fInput('name', 'اسم الكورس', course ? course.name : '', { required: true, placeholder: 'مثال: الفيزياء — الكهرباء التيارية' })}
      ${!isTeacher ? `<div class="field-row">
        ${P.fSelect('subjectId', 'المادة', course ? course.subjectId : '', subjects, { required: true, placeholder: 'اختر المادة' })}
        ${P.fSelect('teacherId', 'المدرس', course ? course.teacherId : '', teachers, { required: true, placeholder: 'اختر المدرس' })}
      </div>` : ''}
      <div class="field-row">
        ${P.fInput('price', 'السعر (ج.م)', course ? course.price : 250, { type: 'number', min: 0, step: 1 })}
        ${P.fSelect('year', 'الصف الدراسي', course ? course.year : 3, YEARS)}
      </div>
      ${P.fTextarea('description', 'وصف الكورس', course ? course.description : '', { placeholder: 'وصف قصير يظهر في صفحة الكورس' })}
      ${P.fInput('picture', 'مسار صورة الغلاف', course ? course.picture : '', { placeholder: 'media/covers/course-1.svg', help: 'اتركه فارغًا لاستخدام غلاف افتراضي.' })}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        ${P.fCheck('visible', 'ظاهر للطلاب', course ? Number(course.visible) === 1 : true)}
        ${P.fCheck('isNew', 'كورس جديد', course ? !!course.isNew : false)}
        ${P.fCheck('renamed', 'كورس مُعاد تسميته', course ? !!course.renamed : false)}
      </div>`;

    formModal({
      title: course ? 'تعديل الكورس' : 'إضافة كورس جديد',
      subtitle: course ? course.name : 'املأ بيانات الكورس الأساسية، ويمكنك إضافة المحتوى بعد الحفظ.',
      wide: true,
      body,
      submitLabel: course ? 'حفظ التعديلات' : 'إنشاء الكورس',
      onSubmit: async (data, form, close) => {
        if (course) {
          await api(`/courses/${course.id}`, { method: 'PATCH', body: data });
          toast('تم تحديث الكورس.', 'ok');
        } else {
          await api('/courses', { method: 'POST', body: data });
          toast('تم إنشاء الكورس.', 'ok');
        }
        close();
        onDone();
      }
    });
  }

  // =======================================================================
  // محتوى الكورس (أقسام / حصص / امتحانات)
  // =======================================================================

  function openContentModal(course) {
    const modal = openModal({
      title: `محتوى: ${course.name}`,
      subtitle: 'أضف الأقسام والحصص ورتّب المحتوى كما يظهر للطالب.',
      xwide: true,
      body: `<div id="content-body">${P.loadingBlock('جارٍ تحميل المحتوى…')}</div>`,
      footer: `<button type="button" class="btn ghost" data-close>إغلاق</button>`
    });

    const box = modal.overlay.querySelector('#content-body');

    async function refresh() {
      box.innerHTML = P.loadingBlock('جارٍ تحميل المحتوى…');
      const data = await api(`/courses/${course.id}/content`);
      const sections = data.sections || [];
      const exams = data.exams || [];

      box.innerHTML = `
        <div class="toolbar" style="justify-content:space-between;margin-bottom:16px">
          <div>
            <b style="font-size:15px">${P.fmtNumber(sections.length)} قسم</b>
            <span style="color:var(--muted);font-size:12px"> · ${P.fmtNumber(
              sections.reduce((sum, section) => sum + (section.lessons || []).length, 0)
            )} حصة · ${P.fmtNumber(exams.length)} امتحان</span>
          </div>
          <button type="button" class="btn sm" id="toggle-section-form">${icon('plus')} قسم جديد</button>
        </div>

        <form id="new-section-form" class="card" style="display:none;padding:14px;margin-bottom:16px">
          <div class="field-row" style="align-items:end">
            <div class="field" style="margin:0">
              <label>اسم القسم</label>
              <input name="name" required placeholder="مثال: الأسبوع الثالث" />
            </div>
            <button type="submit" class="btn">إضافة القسم</button>
          </div>
        </form>

        ${sections
          .map(section => {
            const lessons = section.lessons || [];
            return `<div class="section-block" data-section="${section.id}">
              <div class="section-head">
                <div>
                  <b>${esc(section.name)}</b>
                  <div class="meta">${P.fmtNumber(lessons.length)} حصة</div>
                </div>
                <div class="actions">
                  <button type="button" class="btn soft sm" data-add-lesson="${section.id}">${icon('plus')} حصة</button>
                  <button type="button" class="btn ghost sm" data-del-section="${section.id}">${icon('trash')} حذف القسم</button>
                </div>
              </div>
              <div>
                ${
                  lessons.length
                    ? lessons
                        .map(
                          lesson => `<div class="lesson-row">
                            <div class="l-ico">${icon('video')}</div>
                            <div class="l-main">
                              <b>${esc(lesson.title)}</b>
                              <span>${P.fmtNumber(lesson.duration)} دقيقة${lesson.isFree ? ' · مجانية' : ''}${
                            lesson.published ? '' : ' · غير منشورة'
                          }</span>
                            </div>
                            <div class="l-actions">
                              <button type="button" class="btn ghost sm" data-edit-lesson="${lesson.id}">${icon('edit')}</button>
                              <button type="button" class="btn ghost sm" data-del-lesson="${lesson.id}">${icon('trash')}</button>
                            </div>
                          </div>
                          <form class="inline-form" data-lesson-edit-form="${lesson.id}" hidden style="padding:12px 16px;background:#fbfdff;border-top:1px dashed var(--line)">
                            <div class="field-row">
                              <div class="field" style="margin:0"><label>عنوان الحصة</label><input name="title" value="${esc(lesson.title)}" required /></div>
                              <div class="field" style="margin:0"><label>المدة (دقيقة)</label><input name="duration" type="number" min="1" value="${esc(lesson.duration)}" /></div>
                            </div>
                            <div class="field"><label>رابط الفيديو</label><input name="videoUrl" value="${esc(lesson.videoUrl || '')}" /></div>
                            <div style="display:flex;gap:16px;align-items:center">
                              <label style="display:flex;gap:6px;align-items:center;font-size:12px"><input type="checkbox" name="isFree" ${
                                lesson.isFree ? 'checked' : ''
                              } /> مجانية</label>
                              <label style="display:flex;gap:6px;align-items:center;font-size:12px"><input type="checkbox" name="published" ${
                                lesson.published ? 'checked' : ''
                              } /> منشورة</label>
                              <button type="submit" class="btn sm">حفظ</button>
                            </div>
                          </form>`
                        )
                        .join('')
                    : `<div class="empty" style="padding:22px"><p>لا توجد حصص في هذا القسم بعد.</p></div>`
                }
              </div>
              <form class="inline-form" data-lesson-form="${section.id}" hidden style="padding:14px 16px;background:#fbfdff;border-top:1px dashed var(--line)">
                <div class="field-row">
                  <div class="field" style="margin:0"><label>عنوان الحصة</label><input name="title" required placeholder="مثال: مسائل على قانون أوم" /></div>
                  <div class="field" style="margin:0"><label>المدة (دقيقة)</label><input name="duration" type="number" min="1" value="30" /></div>
                </div>
                <div class="field"><label>رابط الفيديو</label><input name="videoUrl" value="/media/demo-video.html" /></div>
                <div style="display:flex;gap:16px;align-items:center">
                  <label style="display:flex;gap:6px;align-items:center;font-size:12px"><input type="checkbox" name="isFree" /> مجانية</label>
                  <button type="submit" class="btn sm">إضافة الحصة</button>
                </div>
              </form>
            </div>`;
          })
          .join('')}

        ${
          sections.length
            ? ''
            : `<div class="empty"><div class="empty-ico">${icon('layers')}</div><h4>لا توجد أقسام بعد</h4><p>ابدأ بإضافة أول قسم ثم أضف الحصص داخله.</p></div>`
        }

        ${
          exams.length
            ? `<div class="card" style="margin-top:18px">
                <div class="card-head"><h3>امتحانات الكورس</h3><span class="badge plain">${P.fmtNumber(exams.length)}</span></div>
                <div class="table-wrap"><table class="data" style="min-width:520px">
                  <thead><tr><th>الامتحان</th><th>النوع</th><th>الأسئلة</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
                  <tbody>${exams
                    .map(
                      exam => `<tr>
                        <td class="name-cell">${esc(exam.title)}</td>
                        <td>${P.statusBadge(exam.type)}</td>
                        <td>${P.fmtNumber((exam.questions || []).length)}</td>
                        <td>${exam.published ? P.badge('منشور', 'ok') : P.badge('مسودة', 'warn')}</td>
                        <td><button type="button" class="btn ghost sm" data-del-exam="${exam.id}">${icon('trash')} حذف</button></td>
                      </tr>`
                    )
                    .join('')}</tbody>
                </table></div>
              </div>`
            : ''
        }`;

      const toggle = box.querySelector('#toggle-section-form');
      const newSectionForm = box.querySelector('#new-section-form');
      toggle.addEventListener('click', () => {
        newSectionForm.style.display = newSectionForm.style.display === 'none' ? 'block' : 'none';
      });

      box.querySelectorAll('[data-add-lesson]').forEach(button => {
        button.addEventListener('click', () => {
          const form = box.querySelector(`[data-lesson-form="${button.dataset.addLesson}"]`);
          if (form) form.hidden = !form.hidden;
        });
      });

      box.querySelectorAll('[data-edit-lesson]').forEach(button => {
        button.addEventListener('click', () => {
          const form = box.querySelector(`[data-lesson-edit-form="${button.dataset.editLesson}"]`);
          if (form) form.hidden = !form.hidden;
        });
      });

      box.querySelectorAll('[data-del-section]').forEach(button => {
        button.addEventListener('click', () => {
          const section = sections.find(item => String(item.id) === button.dataset.delSection);
          confirmModal({
            title: 'حذف القسم',
            message: `سيتم حذف «${section ? section.name : ''}» وكل الحصص والامتحانات داخله.`,
            confirmLabel: 'حذف',
            onConfirm: async () => {
              await api(`/sections/${button.dataset.delSection}`, { method: 'DELETE' });
              toast('تم حذف القسم.', 'ok');
              refresh();
            }
          });
        });
      });

      box.querySelectorAll('[data-del-lesson]').forEach(button => {
        button.addEventListener('click', () => {
          confirmModal({
            title: 'حذف الحصة',
            message: 'سيتم حذف الحصة من محتوى الكورس.',
            confirmLabel: 'حذف',
            onConfirm: async () => {
              await api(`/lessons/${button.dataset.delLesson}`, { method: 'DELETE' });
              toast('تم حذف الحصة.', 'ok');
              refresh();
            }
          });
        });
      });

      box.querySelectorAll('[data-del-exam]').forEach(button => {
        button.addEventListener('click', () => {
          confirmModal({
            title: 'حذف الامتحان',
            message: 'سيتم حذف الامتحان وكل محاولات الطلاب عليه.',
            confirmLabel: 'حذف',
            onConfirm: async () => {
              await api(`/exams/${button.dataset.delExam}`, { method: 'DELETE' });
              toast('تم حذف الامتحان.', 'ok');
              refresh();
            }
          });
        });
      });
    }

    box.addEventListener('submit', async event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      try {
        if (form.id === 'new-section-form') {
          event.preventDefault();
          const data = readForm(form);
          if (!String(data.name || '').trim()) return;
          await api(`/courses/${course.id}/sections`, { method: 'POST', body: data });
          toast('تم إضافة القسم.', 'ok');
          await refresh();
          return;
        }

        if (form.matches('[data-lesson-form]')) {
          event.preventDefault();
          const data = readForm(form);
          await api(`/sections/${form.dataset.lessonForm}/lessons`, { method: 'POST', body: data });
          toast('تم إضافة الحصة.', 'ok');
          await refresh();
          return;
        }

        if (form.matches('[data-lesson-edit-form]')) {
          event.preventDefault();
          const data = readForm(form);
          await api(`/lessons/${form.dataset.lessonEditForm}`, { method: 'PATCH', body: data });
          toast('تم تحديث الحصة.', 'ok');
          await refresh();
        }
      } catch (err) {
        toast(err.message || 'تعذّر حفظ التغييرات.', 'err');
      }
    });

    refresh().catch(err => {
      box.innerHTML = `<div class="alert danger">${esc(err.message || 'تعذّر تحميل المحتوى.')}</div>`;
    });
  }

  // =======================================================================
  // بنوك الأسئلة
  // =======================================================================

  async function renderQbanks(view, mode) {
    const isTeacher = mode === 'teacher';
    view.innerHTML = `
      ${P.pageHead(
        'بنوك الأسئلة',
        isTeacher ? 'أنشئ بنوك أسئلة واستخدمها في امتحاناتك.' : 'بنوك أسئلة لكل مدرس، ومنها تُبنى الامتحانات والواجبات.',
        `<button type="button" class="btn" id="add-bank">${icon('plus')} بنك جديد</button>`
      )}
      <div id="banks-list">${P.loadingBlock('جارٍ تحميل البنوك…')}</div>`;

    const box = view.querySelector('#banks-list');

    async function load() {
      box.innerHTML = P.loadingBlock('جارٍ تحميل البنوك…');
      const banks = await loadBanks();

      if (!banks.length) {
        box.innerHTML = `<div class="card">${P.emptyState('لا توجد بنوك أسئلة', 'ابدأ بإنشاء بنك ثم أضف إليه الأسئلة.', 'help')}</div>`;
        return;
      }

      box.innerHTML = `<div class="card"><div class="table-wrap"><table class="data">
        <thead><tr>
          <th>اسم البنك</th>
          ${isTeacher ? '' : '<th>المدرس</th>'}
          <th>عدد الأسئلة</th>
          <th>تاريخ الإنشاء</th>
          <th>الإجراءات</th>
        </tr></thead>
        <tbody>${banks
          .map(
            bank => `<tr>
              <td class="name-cell">${esc(bank.name)}</td>
              ${isTeacher ? '' : `<td>${esc(bank.teacherName || '—')}</td>`}
              <td>${P.fmtNumber((bank.questions || []).length)} سؤال</td>
              <td>${P.fmtDateOnly(bank.createdAt)}</td>
              <td>${actionsCell(
                `<button type="button" class="btn soft sm" data-manage="${bank.id}">${icon('help')} إدارة الأسئلة</button>`
              )}</td>
            </tr>`
          )
          .join('')}</tbody>
      </table></div></div>`;

      box.querySelectorAll('[data-manage]').forEach(button => {
        button.addEventListener('click', () => {
          const bank = banks.find(item => String(item.id) === button.dataset.manage);
          if (bank) openBankModal(bank, mode, load);
        });
      });
    }

    view.querySelector('#add-bank').addEventListener('click', () => {
      const body = `
        ${P.fInput('name', 'اسم البنك', '', { required: true, placeholder: 'مثال: بنك أسئلة الكهرباء' })}
        ${
          isTeacher
            ? ''
            : P.fSelect(
                'teacherId',
                'المدرس',
                '',
                [],
                { required: true, placeholder: 'اختر المدرس', help: 'سيتم تحميل قائمة المدرسين…' }
              )
        }`;

      const modal = formModal({
        title: 'إنشاء بنك أسئلة',
        body,
        submitLabel: 'إنشاء',
        onSubmit: async (data, form, close) => {
          await api('/qbanks', { method: 'POST', body: data });
          toast('تم إنشاء البنك.', 'ok');
          close();
          load();
        }
      });

      if (!isTeacher) {
        const select = modal.overlay.querySelector('[name="teacherId"]');
        loadTeachers()
          .then(teachers => {
            select.innerHTML =
              '<option value="">اختر المدرس</option>' +
              teachers
                .map(teacher => `<option value="${teacher.id}">${esc(teacher.name)}</option>`)
                .join('');
          })
          .catch(() => {});
      }
    });

    await load();
  }

  function openBankModal(bank, mode, onDone) {
    const isTeacher = mode === 'teacher';
    const modal = openModal({
      title: bank.name,
      subtitle: 'أضف الأسئلة أو احذفها. تُستخدم هذه الأسئلة عند إنشاء الامتحانات.',
      wide: true,
      body: `<div id="bank-body">${P.loadingBlock('جارٍ تحميل الأسئلة…')}</div>`,
      footer: `<button type="button" class="btn ghost" data-close>إغلاق</button>`
    });

    const box = modal.overlay.querySelector('#bank-body');

    function questionHtml(question) {
      const type = question.type === 'essay' ? 'مقالي' : 'اختيار من متعدد';
      return `<div class="q-item">
        <div class="q-head">
          <div style="display:flex;gap:8px;align-items:center">
            ${P.badge(type, question.type === 'essay' ? 'info' : 'brand')}
            ${P.badge(`${P.fmtNumber(question.points)} درجة`, 'plain')}
          </div>
          <button type="button" class="btn ghost sm" data-del-question="${question.id}">${icon('trash')}</button>
        </div>
        <div class="q-text">${esc(question.text)}</div>
        ${
          question.type === 'essay'
            ? ''
            : `<ul class="q-opts">${(question.options || [])
                .map(
                  (option, index) =>
                    `<li class="${index === Number(question.correct) ? 'correct' : ''}">${esc(option)}${
                      index === Number(question.correct) ? ' ✓' : ''
                    }</li>`
                )
                .join('')}</ul>`
        }
      </div>`;
    }

    async function refresh() {
      const banks = await loadBanks();
      const fresh = banks.find(item => String(item.id) === String(bank.id));
      if (!fresh) {
        box.innerHTML = `<div class="alert danger">تم حذف هذا البنك.</div>`;
        return;
      }
      bank = fresh;
      const questions = fresh.questions || [];

      box.innerHTML = `
        <div class="toolbar" style="justify-content:space-between;margin-bottom:14px">
          <span class="badge brand plain">${P.fmtNumber(questions.length)} سؤال</span>
          <button type="button" class="btn sm" id="toggle-question-form">${icon('plus')} سؤال جديد</button>
        </div>
        <div id="question-list">
          ${
            questions.length
              ? questions.map(questionHtml).join('')
              : P.emptyState('لا توجد أسئلة بعد', 'أضف أول سؤال من الزر أعلى الصفحة.', 'help')
          }
        </div>
        <form id="new-question-form" class="card" style="display:none;padding:16px;margin-top:16px">
          <div class="field-row">
            <div class="field" style="margin:0"><label>نوع السؤال</label>
              <select name="type" id="q-type">
                <option value="mcq">اختيار من متعدد</option>
                <option value="essay">مقالي</option>
              </select>
            </div>
            <div class="field" style="margin:0"><label>الدرجة</label><input name="points" type="number" min="1" value="2" /></div>
          </div>
          <div class="field"><label>نص السؤال</label><textarea name="text" required placeholder="اكتب نص السؤال…"></textarea></div>
          <div id="mcq-options">
            <div class="field-row">
              <div class="field" style="margin:0"><label>الاختيار الأول</label><input name="option0" value="اختيار أ" /></div>
              <div class="field" style="margin:0"><label>الاختيار الثاني</label><input name="option1" value="اختيار ب" /></div>
            </div>
            <div class="field-row">
              <div class="field" style="margin:0"><label>الاختيار الثالث</label><input name="option2" value="اختيار ج" /></div>
              <div class="field" style="margin:0"><label>الاختيار الرابع</label><input name="option3" value="اختيار د" /></div>
            </div>
            <div class="field"><label>الإجابة الصحيحة</label>
              <select name="correct">
                <option value="0">الاختيار الأول</option>
                <option value="1">الاختيار الثاني</option>
                <option value="2">الاختيار الثالث</option>
                <option value="3">الاختيار الرابع</option>
              </select>
            </div>
          </div>
          <button type="submit" class="btn">إضافة السؤال</button>
        </form>`;

      const toggle = box.querySelector('#toggle-question-form');
      const form = box.querySelector('#new-question-form');
      toggle.addEventListener('click', () => {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
      });
      const typeSelect = box.querySelector('#q-type');
      typeSelect.addEventListener('change', () => {
        box.querySelector('#mcq-options').style.display = typeSelect.value === 'essay' ? 'none' : 'block';
      });

      box.querySelectorAll('[data-del-question]').forEach(button => {
        button.addEventListener('click', () => {
          confirmModal({
            title: 'حذف السؤال',
            message: 'سيتم حذف السؤال من البنك.',
            confirmLabel: 'حذف',
            onConfirm: async () => {
              await api(`/questions/${button.dataset.delQuestion}`, { method: 'DELETE' });
              toast('تم حذف السؤال.', 'ok');
              refresh();
              onDone && onDone();
            }
          });
        });
      });
    }

    box.addEventListener('submit', async event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.id !== 'new-question-form') return;
      event.preventDefault();
      const data = readForm(form);
      const payload = {
        type: data.type,
        text: data.text,
        points: data.points,
        options: [data.option0, data.option1, data.option2, data.option3],
        correct: data.correct
      };
      try {
        if (isTeacher) {
          await api(`/qbanks/${bank.id}/questions`, { method: 'POST', body: payload });
        } else {
          await api('/questions', { method: 'POST', body: { ...payload, bankId: bank.id } });
        }
        toast('تم إضافة السؤال.', 'ok');
        refresh();
        onDone && onDone();
      } catch (err) {
        toast(err.message || 'تعذّر إضافة السؤال.', 'err');
      }
    });

    refresh().catch(err => {
      box.innerHTML = `<div class="alert danger">${esc(err.message || 'تعذّر تحميل الأسئلة.')}</div>`;
    });
  }

  // =======================================================================
  // الامتحانات
  // =======================================================================

  async function renderExams(view, mode) {
    const isTeacher = mode === 'teacher';
    view.innerHTML = `
      ${P.pageHead(
        'الامتحانات والواجبات',
        isTeacher ? 'أنشئ امتحانات من بنوك أسئلتك وحدد مدة النشر.' : 'أنشئ الامتحانات والواجبات من بنوك الأسئلة واربطها بالكورسات.',
        `<button type="button" class="btn" id="add-exam">${icon('plus')} امتحان جديد</button>`
      )}
      <div class="card">
        <div class="card-head">
          <div class="toolbar" style="flex:1">
            <div class="search">${icon('search')}<input type="search" id="exam-search" placeholder="ابحث بعنوان الامتحان…" /></div>
            <select id="exam-course"><option value="">كل الكورسات</option></select>
          </div>
          <span class="badge brand plain" id="exam-count"></span>
        </div>
        <div id="exams-table"></div>
      </div>`;

    const tableBox = view.querySelector('#exams-table');
    const countBox = view.querySelector('#exam-count');
    const courseSelect = view.querySelector('#exam-course');
    const state = { q: '', courseId: '' };

    const [courses, banks] = await Promise.all([loadCourses(), loadBanks()]);
    courseSelect.innerHTML =
      '<option value="">كل الكورسات</option>' +
      courses.map(course => `<option value="${course.id}">${esc(course.name)}</option>`).join('');

    async function load() {
      tableBox.innerHTML = P.loadingBlock('جارٍ تحميل الامتحانات…');
      let rows = await api('/exams' + qs(state)).then(data => data.data || []);
      countBox.textContent = `${P.fmtNumber(rows.length)} امتحان`;

      if (!rows.length) {
        tableBox.innerHTML = P.emptyState('لا توجد امتحانات', 'أنشئ أول امتحان من الزر أعلى الصفحة.', 'exam');
        return;
      }

      const columns = [
        {
          label: 'الامتحان',
          render: exam => `<div class="name-cell">${esc(exam.title)}</div><div class="sub-cell">${esc(exam.courseName || '')}</div>`
        },
        { label: 'النوع', render: exam => P.statusBadge(exam.type) },
        { label: 'المدة', render: exam => `${P.fmtNumber(exam.duration)} دقيقة` },
        { label: 'الأسئلة', render: exam => P.fmtNumber(exam.questionsCount != null ? exam.questionsCount : (exam.questions || []).length) },
        { label: 'المحاولات', render: exam => P.fmtNumber(exam.attempts) },
        {
          label: 'الحالة',
          render: exam =>
            exam.published
              ? `<button type="button" class="badge ok" style="border:0;cursor:pointer" data-toggle="${exam.id}">منشور</button>`
              : `<button type="button" class="badge warn" style="border:0;cursor:pointer" data-toggle="${exam.id}">مسودة</button>`
        },
        {
          label: 'الإجراءات',
          render: exam =>
            actionsCell(`
              <button type="button" class="btn ghost sm" data-edit="${exam.id}">${icon('edit')} تعديل</button>
              <button type="button" class="btn ghost sm" data-delete="${exam.id}">${icon('trash')}</button>
            `)
        }
      ];

      tableBox.innerHTML = P.table(columns, rows);

      tableBox.querySelectorAll('[data-toggle]').forEach(button => {
        button.addEventListener('click', async () => {
          const exam = rows.find(item => String(item.id) === button.dataset.toggle);
          try {
            await api(`/exams/${exam.id}`, { method: 'PATCH', body: { published: !exam.published } });
            toast(exam.published ? 'تم إخفاء الامتحان.' : 'تم نشر الامتحان.', 'ok');
            load();
          } catch (err) {
            toast(err.message || 'تعذّر تغيير حالة النشر.', 'err');
          }
        });
      });

      tableBox.querySelectorAll('[data-edit]').forEach(button => {
        button.addEventListener('click', () => {
          const exam = rows.find(item => String(item.id) === button.dataset.edit);
          if (exam) openExamForm(mode, exam, courses, banks, load);
        });
      });

      tableBox.querySelectorAll('[data-delete]').forEach(button => {
        button.addEventListener('click', () => {
          const exam = rows.find(item => String(item.id) === button.dataset.delete);
          confirmModal({
            title: 'حذف الامتحان',
            message: `سيتم حذف «${exam ? exam.title : ''}» وكل محاولات الطلاب.`,
            confirmLabel: 'حذف',
            onConfirm: async () => {
              await api(`/exams/${exam.id}`, { method: 'DELETE' });
              toast('تم حذف الامتحان.', 'ok');
              load();
            }
          });
        });
      });
    }

    const search = view.querySelector('#exam-search');
    search.addEventListener('input', P.debounce(() => {
      state.q = search.value.trim();
      load();
    }, 260));
    courseSelect.addEventListener('change', () => {
      state.courseId = courseSelect.value;
      load();
    });

    view.querySelector('#add-exam').addEventListener('click', () => {
      openExamForm(mode, null, courses, banks, load);
    });

    await load();
  }

  function openExamForm(mode, exam, courses, banks, onDone) {
    const selectedIds = new Set((exam && exam.questions ? exam.questions : []).map(question => String(question.id)));

    const questionsHtml = banks.length
      ? banks
          .map(bank => {
            if (!bank.questions || !bank.questions.length) return '';
            return `<div style="margin-bottom:12px">
              <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px">${esc(bank.name)}</div>
              <div class="check-list">
                ${bank.questions
                  .map(
                    question => `<label class="check-row">
                      <input type="checkbox" name="q_${question.id}" ${selectedIds.has(String(question.id)) ? 'checked' : ''} />
                      <span class="ct">${esc(question.text)} <span class="badge plain" style="font-size:10px">${
                      question.type === 'essay' ? 'مقالي' : 'اختيار'
                    }</span></span>
                    </label>`
                  )
                  .join('')}
              </div>
            </div>`;
          })
          .join('')
      : `<div class="alert warn">لا توجد أسئلة في بنوك الأسئلة بعد. أضف أسئلة أولًا ثم أنشئ الامتحان.</div>`;

    const body = `
      <div class="field-row">
        ${P.fInput('title', 'عنوان الامتحان', exam ? exam.title : '', { required: true, placeholder: 'مثال: امتحان شامل على الكهرباء' })}
        ${P.fSelect('courseId', 'الكورس', exam ? exam.courseId : '', courses, { required: true, placeholder: 'اختر الكورس' })}
      </div>
      <div class="field-row">
        ${P.fSelect('type', 'النوع', exam ? exam.type : 'exam', [
          { value: 'exam', label: 'امتحان' },
          { value: 'hm', label: 'واجب (HM)' }
        ])}
        ${P.fInput('duration', 'المدة (دقيقة)', exam ? exam.duration : 60, { type: 'number', min: 1 })}
      </div>
      ${P.fCheck('published', 'نشر الامتحان للطلاب', exam ? !!exam.published : true)}
      <div class="field">
        <label>أسئلة الامتحان</label>
        <div class="alert info" style="margin-bottom:10px">اختر الأسئلة من بنوك الأسئلة. عدد الأسئلة المحددة يظهر تلقائيًا.</div>
        ${questionsHtml}
      </div>`;

    formModal({
      title: exam ? 'تعديل الامتحان' : 'إنشاء امتحان جديد',
      subtitle: exam ? exam.title : 'اختر الكورس والأسئلة وحدد مدة الامتحان.',
      wide: true,
      body,
      submitLabel: exam ? 'حفظ التعديلات' : 'إنشاء الامتحان',
      onSubmit: async (data, form, close) => {
        const questionIds = Object.keys(data)
          .filter(key => key.startsWith('q_') && data[key])
          .map(key => Number(key.slice(2)));
        if (!questionIds.length) {
          throw new Error('اختر سؤالًا واحدًا على الأقل للامتحان.');
        }
        const payload = {
          title: data.title,
          courseId: Number(data.courseId),
          type: data.type,
          duration: Number(data.duration) || 60,
          published: !!data.published,
          questionIds
        };
        if (exam) {
          await api(`/exams/${exam.id}`, { method: 'PATCH', body: payload });
          toast('تم تحديث الامتحان.', 'ok');
        } else {
          await api('/exams', { method: 'POST', body: payload });
          toast('تم إنشاء الامتحان.', 'ok');
        }
        close();
        onDone();
      }
    });
  }

  // =======================================================================
  // الطلاب
  // =======================================================================

  async function renderStudents(view, mode) {
    const isTeacher = mode === 'teacher';

    if (isTeacher) {
      view.innerHTML = `
        ${P.pageHead('طلابي', 'كل الطلاب المشتركين في كورساتك ونسبة تقدمهم.')}
        <div class="card"><div id="teacher-students">${P.loadingBlock('جارٍ تحميل الطلاب…')}</div></div>`;
      const box = view.querySelector('#teacher-students');
      const rows = await api('/students').then(data => data.data || []);
      if (!rows.length) {
        box.innerHTML = P.emptyState('لا يوجد طلاب بعد', 'سيظهر الطلاب هنا بعد اشتراكهم في كورساتك.', 'users');
        return;
      }
      box.innerHTML = P.table(
        [
          {
            label: 'الطالب',
            render: student => `<div class="name-cell">${esc(student.name)}</div><div class="sub-cell">${esc(student.school || '')}</div>`
          },
          { label: 'الهاتف', render: student => `<span class="num" dir="ltr">${esc(student.phone)}</span>` },
          { label: 'الصف', render: student => esc(yearLabel(student.year)) },
          { label: 'الكورسات', render: student => esc((student.courses || []).join('، ') || '—') },
          { label: 'التقدم', render: student => `<span class="badge brand plain">${P.fmtNumber(student.progress)}%</span>` }
        ],
        rows
      );
      return;
    }

    view.innerHTML = `
      ${P.pageHead('الطلاب', 'ابحث عن أي طالب، عدّل بياناته، أو أوقف حسابه.', `<button type="button" class="btn" id="add-student">${icon('plus')} طالب جديد</button>`)}
      <div class="card">
        <div class="card-head">
          <div class="toolbar" style="flex:1">
            <div class="search">${icon('search')}<input type="search" id="student-search" placeholder="ابحث بالاسم أو رقم الهاتف…" /></div>
            <select id="student-year">
              <option value="">كل الصفوف</option>
              ${YEARS.map(year => `<option value="${year.value}">${esc(year.label)}</option>`).join('')}
            </select>
            <select id="student-status">
              <option value="">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">موقوف</option>
            </select>
          </div>
          <span class="badge brand plain" id="student-count"></span>
        </div>
        <div id="students-table"></div>
      </div>`;

    const tableBox = view.querySelector('#students-table');
    const countBox = view.querySelector('#student-count');
    const state = { page: 1, q: '', year: '', status: '' };

    async function load(page) {
      state.page = page || 1;
      tableBox.innerHTML = P.loadingBlock('جارٍ تحميل الطلاب…');
      const meta = await api('/students' + qs(state));
      const rows = meta.data || [];
      countBox.textContent = `${P.fmtNumber(meta.total || 0)} طالب`;

      if (!rows.length) {
        tableBox.innerHTML = P.emptyState('لا يوجد طلاب مطابقون', 'جرّب تغيير البحث أو الفلاتر.', 'users');
        return;
      }

      tableBox.innerHTML =
        P.table(
          [
            {
              label: 'الطالب',
              render: student => `<div class="name-cell">${esc(student.name)}</div><div class="sub-cell">${esc(student.school || '—')}</div>`
            },
            { label: 'الهاتف', render: student => `<span class="num" dir="ltr">${esc(student.phone)}</span>` },
            { label: 'ولي الأمر', render: student => `<span class="num" dir="ltr">${esc(student.parentPhone || '—')}</span>` },
            { label: 'الصف', render: student => esc(yearLabel(student.year)) },
            { label: 'الاشتراكات', render: student => P.fmtNumber(student.subscriptions) },
            { label: 'المدفوع', render: student => `<span class="num">${esc(P.fmtMoney(student.paid))}</span>` },
            {
              label: 'الحالة',
              render: student => (student.active ? P.badge('نشط', 'ok') : P.badge('موقوف', 'danger'))
            },
            {
              label: 'الإجراءات',
              render: student =>
                actionsCell(`
                  <button type="button" class="btn ghost sm" data-edit="${student.id}">${icon('edit')} تعديل</button>
                  <button type="button" class="btn ghost sm" data-toggle="${student.id}">${
                  student.active ? 'إيقاف' : 'تفعيل'
                }</button>
                `)
            }
          ],
          rows
        ) + P.pagination(meta);

      P.bindPagination(tableBox, load);

      tableBox.querySelectorAll('[data-edit]').forEach(button => {
        button.addEventListener('click', () => {
          const student = rows.find(row => String(row.id) === button.dataset.edit);
          if (student) openStudentForm(student, () => load(state.page));
        });
      });

      tableBox.querySelectorAll('[data-toggle]').forEach(button => {
        button.addEventListener('click', async () => {
          const student = rows.find(row => String(row.id) === button.dataset.toggle);
          try {
            await api(`/students/${student.id}`, { method: 'PATCH', body: { active: !student.active } });
            toast(student.active ? 'تم إيقاف حساب الطالب.' : 'تم تفعيل حساب الطالب.', 'ok');
            load(state.page);
          } catch (err) {
            toast(err.message || 'تعذّر تحديث حالة الطالب.', 'err');
          }
        });
      });
    }

    const search = view.querySelector('#student-search');
    search.addEventListener('input', P.debounce(() => {
      state.q = search.value.trim();
      load(1);
    }, 280));
    view.querySelector('#student-year').addEventListener('change', event => {
      state.year = event.target.value;
      load(1);
    });
    view.querySelector('#student-status').addEventListener('change', event => {
      state.status = event.target.value;
      load(1);
    });
    view.querySelector('#add-student').addEventListener('click', () => openStudentForm(null, () => load(1)));

    await load(1);
  }

  function openStudentForm(student, onDone) {
    const body = `
      <div class="field-row">
        ${P.fInput('name', 'اسم الطالب', student ? student.name : '', { required: true })}
        ${P.fInput('phone', 'رقم الهاتف', student ? student.phone : '', { required: true, type: 'tel', placeholder: '01xxxxxxxxx' })}
      </div>
      <div class="field-row">
        ${P.fInput('parentPhone', 'هاتف ولي الأمر', student ? student.parentPhone : '', { type: 'tel' })}
        ${P.fSelect('year', 'الصف الدراسي', student ? student.year : 3, YEARS)}
      </div>
      ${P.fInput('school', 'المدرسة', student ? student.school : '', { placeholder: 'اسم المدرسة' })}
      ${P.fCheck('active', 'الحساب نشط', student ? !!student.active : true, 'الطلاب الموقوفون لا يستطيعون الدخول.')}`;

    formModal({
      title: student ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد',
      subtitle: student ? student.name : 'أدخل بيانات الطالب الأساسية.',
      body,
      submitLabel: student ? 'حفظ التعديلات' : 'إضافة الطالب',
      onSubmit: async (data, form, close) => {
        if (student) {
          await api(`/students/${student.id}`, { method: 'PATCH', body: data });
          toast('تم تحديث بيانات الطالب.', 'ok');
        } else {
          await api('/students', { method: 'POST', body: data });
          toast('تم إضافة الطالب.', 'ok');
        }
        close();
        onDone();
      }
    });
  }

  // =======================================================================
  // أكواد الشحن
  // =======================================================================

  async function renderCodes(view, mode) {
    const isTeacher = mode === 'teacher';
    view.innerHTML = `
      ${P.pageHead(
        'أكواد الشحن',
        isTeacher ? 'أنشئ أكواد شحن لكورساتك وتابع استخدامها.' : 'أنشئ أكواد شحن للكورسات وتابع من استخدمها.',
        `<button type="button" class="btn" id="add-codes">${icon('plus')} إنشاء أكواد</button>`
      )}
      <div class="card"><div id="codes-table">${P.loadingBlock('جارٍ تحميل الأكواد…')}</div></div>`;

    const tableBox = view.querySelector('#codes-table');
    let courses = [];

    async function load() {
      tableBox.innerHTML = P.loadingBlock('جارٍ تحميل الأكواد…');
      const rows = await api('/codes').then(data => data.data || []);
      if (!rows.length) {
        tableBox.innerHTML = P.emptyState('لا توجد أكواد شحن', 'أنشئ مجموعة أكواد من الزر أعلى الصفحة.', 'code');
        return;
      }

      tableBox.innerHTML = P.table(
        [
          { label: 'الكود', render: code => `<span class="code-box">${esc(code.code)}</span>` },
          { label: 'الكورس', render: code => esc(code.courseName || '—') },
          { label: 'القيمة', render: code => `<span class="num">${esc(P.fmtMoney(code.value))}</span>` },
          {
            label: 'الحالة',
            render: code =>
              code.revoked
                ? P.badge('ملغي', 'danger')
                : code.used
                ? P.badge('مستخدم', 'info')
                : P.badge('متاح', 'ok')
          },
          { label: 'استخدمه', render: code => esc(code.usedByName || '—') },
          { label: 'تاريخ الإنشاء', render: code => P.fmtDateOnly(code.createdAt) },
          {
            label: 'الإجراءات',
            render: code =>
              code.used || code.revoked
                ? '—'
                : `<button type="button" class="btn ghost sm" data-revoke="${code.id}">${icon('x')} إلغاء</button>`
          }
        ],
        rows
      );

      tableBox.querySelectorAll('[data-revoke]').forEach(button => {
        button.addEventListener('click', () => {
          confirmModal({
            title: 'إلغاء الكود',
            message: 'لن يستطيع أي طالب استخدام هذا الكود بعد الإلغاء.',
            confirmLabel: 'إلغاء الكود',
            onConfirm: async () => {
              await api(`/codes/${button.dataset.revoke}/revoke`, { method: 'POST', body: {} });
              toast('تم إلغاء الكود.', 'ok');
              load();
            }
          });
        });
      });
    }

    view.querySelector('#add-codes').addEventListener('click', async () => {
      if (!courses.length) courses = await loadCourses();
      const modal = formModal({
        title: 'إنشاء أكواد شحن',
        subtitle: 'كل كود يمنح اشتراكًا في الكورس المحدد.',
        body: `
          ${P.fSelect('courseId', 'الكورس', '', courses, { required: true, placeholder: 'اختر الكورس' })}
          <div class="field-row">
            ${P.fInput('count', 'عدد الأكواد', 5, { type: 'number', min: 1, max: isTeacher ? 20 : 50 })}
            ${P.fInput('value', 'قيمة الكود (اختياري)', '', { type: 'number', min: 0, help: 'اتركه فارغًا لاستخدام سعر الكورس.' })}
          </div>`,
        submitLabel: 'إنشاء الأكواد',
        onSubmit: async (data, form, close) => {
          const result = await api('/codes', {
            method: 'POST',
            body: { courseId: Number(data.courseId), count: Number(data.count) || 1, value: data.value || undefined }
          });
          const codes = (result.codes || []).map(code => code.code);
          close();
          toast(`تم إنشاء ${codes.length} كود.`, 'ok');
          openModal({
            title: 'الأكواد الجديدة',
            subtitle: 'انسخ الأكواد وسلّمها للطلاب.',
            body: `<div style="display:flex;flex-wrap:wrap;gap:8px">${codes
              .map(code => `<span class="code-box">${esc(code)}</span>`)
              .join('')}</div>`,
            footer: `<button type="button" class="btn ghost" data-close>إغلاق</button>`
          });
          load();
        }
      });
      return modal;
    });

    await load();
  }

  return {
    YEARS,
    yearLabel,
    courseImage,
    loadCourses,
    loadSubjects,
    loadTeachers,
    loadBanks,
    renderCourses,
    renderQbanks,
    renderExams,
    renderStudents,
    renderCodes,
    openContentModal
  };
})();
