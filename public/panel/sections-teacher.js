'use strict';
/*
 * أقسام لوحة المدرس: نظرة عامة، التصحيح، الأسئلة والأجوبة، الملف الشخصي.
 */
(function () {
  const P = window.PS;
  const X = window.PSX;
  const { esc, icon, api, toast, formModal, openModal, readForm } = P;

  // =======================================================================
  // نظرة عامة
  // =======================================================================

  async function renderOverview(view) {
    const data = await api('/overview');
    const stats = data.stats || {};
    const courses = data.courses || [];
    const qa = data.recentQa || [];

    view.innerHTML = `
      ${P.pageHead('نظرة عامة', 'ملخص كورساتك وطلابك والمهام المنتظرة.')}
      <div class="grid cols-4">
        ${P.statCard('كورساتي', P.fmtNumber(stats.courses), 'layers', 'كورس تحت إدارتك', '')}
        ${P.statCard('طلابي', P.fmtNumber(stats.students), 'users', 'طالب مشترك', 'alt-4')}
        ${P.statCard('الحصص', P.fmtNumber(stats.lessons), 'video', 'حصة مضافة', 'alt-1')}
        ${P.statCard('الإيرادات', P.fmtMoney(stats.revenue), 'money', 'من فواتير كورساتك', 'alt-2')}
      </div>

      <div class="grid cols-3" style="margin-top:16px">
        ${P.statCard('امتحانات', P.fmtNumber(stats.exams), 'exam', 'امتحان وواجب', '')}
        ${P.statCard('بانتظار التصحيح', P.fmtNumber(stats.pendingGrading), 'check', 'محاولة تحتاج مراجعة', 'alt-2')}
        ${P.statCard('أسئلة بانتظار الرد', P.fmtNumber(stats.openQa), 'chat', 'من طلابك', 'alt-3')}
      </div>

      <div class="grid cols-2" style="margin-top:18px">
        <div class="card">
          <div class="card-head">
            <div><h3>كورساتي</h3><p>نظرة سريعة على كل كورس</p></div>
            <a class="btn ghost sm" href="#/courses">إدارة المحتوى</a>
          </div>
          <div class="table-wrap"><table class="data" style="min-width:460px">
            <thead><tr><th>الكورس</th><th>الحصص</th><th>الطلاب</th><th>الحالة</th></tr></thead>
            <tbody>
              ${
                courses.length
                  ? courses
                      .map(
                        course => `<tr>
                          <td class="name-cell">${esc(course.name)}</td>
                          <td>${P.fmtNumber(course.lessons)}</td>
                          <td>${P.fmtNumber(course.students)}</td>
                          <td>${Number(course.visible) === 1 ? P.badge('ظاهر', 'ok') : P.badge('مخفي', 'danger')}</td>
                        </tr>`
                      )
                      .join('')
                  : `<tr><td colspan="4">${P.emptyState('لا توجد كورسات', '', 'layers')}</td></tr>`
              }
            </tbody>
          </table></div>
        </div>

        <div class="card">
          <div class="card-head">
            <div><h3>آخر أسئلة الطلاب</h3><p>الأسئلة الموجهة لك</p></div>
            <a class="btn ghost sm" href="#/qa">عرض الكل</a>
          </div>
          <div class="card-body">
            ${
              qa.length
                ? qa
                    .map(
                      item => `<div class="qa-card" style="margin-bottom:10px">
                        <div class="qa-head">
                          ${P.statusBadge(item.status)}
                          <span class="badge plain">${esc(item.studentName)}</span>
                          <span class="badge plain">${esc(item.courseName)}</span>
                        </div>
                        <div class="qa-q" style="font-size:12.5px">${esc(item.question)}</div>
                        ${item.answer ? `<div class="qa-a">${esc(item.answer)}</div>` : ''}
                      </div>`
                    )
                    .join('')
                : P.emptyState('لا توجد أسئلة', 'ستظهر أسئلة طلابك هنا.', 'chat')
            }
          </div>
        </div>
      </div>`;
  }

  // =======================================================================
  // التصحيح
  // =======================================================================

  async function renderGrading(view) {
    view.innerHTML = `
      ${P.pageHead('التصحيح', 'راجع محاولات الطلاب وصحّح الأسئلة المقالية.')}
      <div class="card"><div id="grading-table">${P.loadingBlock('جارٍ تحميل المحاولات…')}</div></div>`;

    const tableBox = view.querySelector('#grading-table');

    async function load() {
      tableBox.innerHTML = P.loadingBlock('جارٍ تحميل المحاولات…');
      const rows = await api('/grading').then(data => data.data || []);
      if (!rows.length) {
        tableBox.innerHTML = P.emptyState('لا توجد محاولات بانتظار التصحيح', 'كل المحاولات تم تصحيحها.', 'check');
        return;
      }
      tableBox.innerHTML = P.table(
        [
          { label: 'الطالب', render: attempt => `<span class="name-cell">${esc(attempt.studentName)}</span>` },
          { label: 'الامتحان', render: attempt => esc(attempt.examTitle) },
          { label: 'تاريخ التسليم', render: attempt => esc(P.fmtDate(attempt.submittedAt)) },
          { label: 'الحالة', render: attempt => P.statusBadge(attempt.status) },
          {
            label: 'الإجراءات',
            render: attempt => `<button type="button" class="btn soft sm" data-grade="${attempt.id}">${icon('edit')} تصحيح المحاولة</button>`
          }
        ],
        rows
      );

      tableBox.querySelectorAll('[data-grade]').forEach(button => {
        button.addEventListener('click', () => openGrading(Number(button.dataset.grade), load));
      });
    }

    await load();
  }

  async function openGrading(attemptId, onDone) {
    const data = await api(`/grading/${attemptId}`);
    const attempt = data.attempt || {};
    const exam = data.exam || {};
    const student = data.student || {};
    const questions = exam.questions || [];
    const answers = attempt.answers || [];

    const answerMap = new Map(answers.map(answer => [String(answer.questionId), answer]));

    const body = `
      <div class="profile-card" style="margin-bottom:16px">
        <div class="avatar">${esc(String(student.name || '؟').slice(0, 1))}</div>
        <div>
          <div class="pc-name" style="font-size:16px">${esc(student.name || 'طالب')}</div>
          <div class="pc-sub">${esc(exam.title || '')} · ${esc(P.fmtDate(attempt.submittedAt))}</div>
        </div>
        <div style="margin-inline-start:auto;text-align:left">
          <div class="badge brand plain">الدرجة الحالية: ${P.fmtNumber(attempt.total)} / ${P.fmtNumber(attempt.maxScore)}</div>
        </div>
      </div>
      ${questions
        .map((question, index) => {
          const answer = answerMap.get(String(question.id)) || { answer: '', score: 0 };
          let answerText = answer.answer;
          if (question.type !== 'essay') {
            const optionIndex = Number(answer.answer);
            answerText = (question.options || [])[optionIndex] || 'لم يجب';
          }
          return `<div class="answer-box">
            <div class="ans-q">${index + 1}. ${esc(question.text)} <span class="badge plain" style="font-size:10px">${
            question.type === 'essay' ? 'مقالي' : 'اختيار من متعدد'
          }</span></div>
            <div class="ans-a">${esc(answerText || 'لم يجب')}</div>
            <div class="score-row">
              <label style="font-size:12px;font-weight:700">الدرجة:</label>
              <input type="number" name="score_${question.id}" min="0" max="${Number(question.points) || 0}" step="0.5"
                value="${answer.score == null ? '' : answer.score}" />
              <span class="max">من ${P.fmtNumber(question.points)} درجة</span>
            </div>
          </div>`;
        })
        .join('')}`;

    formModal({
      title: 'تصحيح المحاولة',
      subtitle: 'راجع إجابات الطالب وأدخل درجة كل سؤال.',
      wide: true,
      body,
      submitLabel: 'حفظ الدرجات',
      onSubmit: async (formData, form, close) => {
        const scores = {};
        Object.keys(formData).forEach(key => {
          if (key.startsWith('score_')) scores[key.slice(6)] = Number(formData[key]) || 0;
        });
        await api(`/grading/${attemptId}`, { method: 'POST', body: { scores } });
        toast('تم حفظ درجات المحاولة.', 'ok');
        close();
        onDone();
      }
    });
  }

  // =======================================================================
  // الأسئلة والأجوبة
  // =======================================================================

  async function renderQa(view) {
    view.innerHTML = `
      ${P.pageHead('الأسئلة والأجوبة', 'رد على أسئلة طلابك في الكورسات.')}
      <div class="card">
        <div class="card-head">
          <div class="toolbar" style="flex:1">
            <select id="qa-status">
              <option value="">كل الأسئلة</option>
              <option value="open">بانتظار الرد</option>
              <option value="answered">تم الرد</option>
            </select>
          </div>
          <span class="badge brand plain" id="qa-count"></span>
        </div>
        <div class="card-body" id="qa-list">${P.loadingBlock('جارٍ تحميل الأسئلة…')}</div>
      </div>`;

    const listBox = view.querySelector('#qa-list');
    const countBox = view.querySelector('#qa-count');
    let status = '';

    async function load() {
      listBox.innerHTML = P.loadingBlock('جارٍ تحميل الأسئلة…');
      let rows = await api('/qa').then(data => data.data || []);
      if (status) rows = rows.filter(item => item.status === status);
      countBox.textContent = `${P.fmtNumber(rows.length)} سؤال`;

      if (!rows.length) {
        listBox.innerHTML = P.emptyState('لا توجد أسئلة', 'ستظهر أسئلة طلابك هنا.', 'chat');
        return;
      }

      listBox.innerHTML = rows
        .map(
          item => `<div class="qa-card" data-qa="${item.id}">
            <div class="qa-head">
              ${P.statusBadge(item.status)}
              <span class="badge plain">${esc(item.studentName)}</span>
              <span class="badge plain">${esc(item.courseName)}</span>
              <span class="mr-time" style="margin-inline-start:auto;color:var(--muted);font-size:11px">${esc(
                P.fmtDate(item.createdAt)
              )}</span>
            </div>
            <div class="qa-q">${esc(item.question)}</div>
            ${
              item.answer
                ? `<div class="qa-a"><b>ردك:</b> ${esc(item.answer)}</div>`
                : `<button type="button" class="btn sm" style="margin-top:10px" data-answer="${item.id}">${icon('send')} اكتب الرد</button>`
            }
          </div>`
        )
        .join('');

      listBox.querySelectorAll('[data-answer]').forEach(button => {
        button.addEventListener('click', () => {
          const item = rows.find(row => String(row.id) === button.dataset.answer);
          openAnswerModal(item, load);
        });
      });
    }

    view.querySelector('#qa-status').addEventListener('change', event => {
      status = event.target.value;
      load();
    });

    await load();
  }

  function openAnswerModal(item, onDone) {
    formModal({
      title: 'الرد على سؤال الطالب',
      subtitle: `${item.studentName} · ${item.courseName}`,
      wide: true,
      body: `
        <div class="alert info">${esc(item.question)}</div>
        ${P.fTextarea('answer', 'الرد', item.answer || '', { required: true, placeholder: 'اكتب شرحًا واضحًا ومبسطًا…' })}`,
      submitLabel: 'إرسال الرد',
      onSubmit: async (data, form, close) => {
        await api(`/qa/${item.id}/answer`, { method: 'POST', body: data });
        toast('تم إرسال الرد.', 'ok');
        close();
        onDone();
      }
    });
  }

  // =======================================================================
  // الملف الشخصي
  // =======================================================================

  async function renderProfile(view) {
    const me = P.getMe() || {};
    view.innerHTML = `
      ${P.pageHead('ملفي الشخصي', 'حدّث بياناتك وبيانات الدخول للوحة.')}
      <div style="max-width:820px">
        <div class="profile-card" style="margin-bottom:16px">
          <div class="avatar">${esc(String(me.name || '؟').slice(0, 1))}</div>
          <div>
            <div class="pc-name">${esc(me.name || '')}</div>
            <div class="pc-sub">${esc(me.phone || '')} · حساب مدرس</div>
          </div>
        </div>
        <form id="profile-form" class="card">
          <div class="card-head"><h3>البيانات الأساسية</h3></div>
          <div class="card-body">
            <div class="field-row">
              ${P.fInput('name', 'الاسم', me.name || '', { required: true })}
              ${P.fInput('phone', 'رقم الهاتف', me.phone || '', { required: true, type: 'tel' })}
            </div>
            ${P.fTextarea('description', 'نبذة تظهر في صفحتك', me.description || '')}
            ${P.fInput('password', 'كلمة مرور جديدة (اختياري)', '', {
              type: 'password',
              help: 'اتركها فارغة للإبقاء على كلمة المرور الحالية.'
            })}
            <button type="submit" class="btn">${icon('check')} حفظ البيانات</button>
          </div>
        </form>
      </div>`;

    const form = view.querySelector('#profile-form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      const data = readForm(form);
      if (!data.password) delete data.password;
      try {
        const result = await api('/profile', { method: 'PATCH', body: data });
        if (result.teacher) {
          const current = P.getMe();
          if (current) {
            current.name = result.teacher.name;
            current.phone = result.teacher.phone;
            current.description = result.teacher.description;
          }
        }
        toast('تم تحديث بياناتك.', 'ok');
        document.querySelector('.sidebar-user .who b').textContent = result.teacher ? result.teacher.name : data.name;
        document.querySelector('.profile-card .pc-name').textContent = result.teacher ? result.teacher.name : data.name;
        document.querySelector('.profile-card .pc-sub').textContent = `${result.teacher ? result.teacher.phone : data.phone} · حساب مدرس`;
      } catch (err) {
        toast(err.message || 'تعذّر حفظ البيانات.', 'err');
      } finally {
        button.disabled = false;
      }
    });
  }

  // =======================================================================
  // التسجيل
  // =======================================================================

  P.registerSections({
    overview: { title: 'نظرة عامة', subtitle: 'ملخص كورساتك وطلابك', render: renderOverview },
    courses: { title: 'كورساتي', subtitle: 'إدارة المحتوى والحصص', render: view => X.renderCourses(view, 'teacher') },
    qbanks: { title: 'بنوك الأسئلة', subtitle: 'أسئلة امتحاناتك', render: view => X.renderQbanks(view, 'teacher') },
    exams: { title: 'الامتحانات', subtitle: 'الامتحانات والواجبات', render: view => X.renderExams(view, 'teacher') },
    students: { title: 'طلابي', subtitle: 'الطلاب المشتركون في كورساتك', render: view => X.renderStudents(view, 'teacher') },
    grading: { title: 'التصحيح', subtitle: 'مراجعة محاولات الطلاب', render: renderGrading },
    qa: { title: 'الأسئلة والأجوبة', subtitle: 'أسئلة الطلاب وردودك', render: renderQa },
    codes: { title: 'أكواد الشحن', subtitle: 'أكواد كورساتك', render: view => X.renderCodes(view, 'teacher') },
    profile: { title: 'ملفي الشخصي', subtitle: 'بياناتك وكلمة المرور', render: renderProfile }
  });

  P.boot();
})();
