'use strict';
/*
 * أقسام لوحة الأدمن: نظرة عامة، المدرسون، المواد، الفواتير، المجتمع،
 * الإعدادات، سجل العمليات، الإداريون.
 */
(function () {
  const P = window.PS;
  const X = window.PSX;
  const { esc, icon, api, qs, toast, formModal, confirmModal, readForm } = P;

  // =======================================================================
  // نظرة عامة
  // =======================================================================

  async function renderOverview(view) {
    const data = await api('/overview');
    const stats = data.stats || {};
    const invoices = data.recentInvoices || [];
    const audit = data.recentAudit || [];

    view.innerHTML = `
      ${P.pageHead('نظرة عامة', 'ملخص سريع لحالة المنصة وآخر العمليات.')}
      <div class="grid cols-4">
        ${P.statCard('إجمالي الطلاب', P.fmtNumber(stats.students), 'users', `${P.fmtNumber(stats.activeStudents)} طالب نشط`, '')}
        ${P.statCard('الكورسات', P.fmtNumber(stats.courses), 'layers', `${P.fmtNumber(stats.teachers)} مدرس · ${P.fmtNumber(stats.subjects)} مادة`, 'alt-4')}
        ${P.statCard('الاشتراكات', P.fmtNumber(stats.subscriptions), 'star', 'اشتراك نشط في الكورسات', 'alt-1')}
        ${P.statCard('الإيرادات', P.fmtMoney(stats.revenue), 'money', `${P.fmtNumber(stats.pendingInvoices)} فاتورة بانتظار المراجعة`, 'alt-2')}
      </div>

      <div class="grid cols-3" style="margin-top:16px">
        ${P.statCard('منشورات بانتظار الاعتماد', P.fmtNumber(stats.pendingPosts), 'chat', 'في قسم المجتمع', 'alt-2')}
        ${P.statCard('أسئلة بانتظار الرد', P.fmtNumber(stats.openQa), 'help', 'من الطلاب للمدرسين', 'alt-3')}
        ${P.statCard('فواتير قيد المراجعة', P.fmtNumber(stats.pendingInvoices), 'invoice', 'تحتاج تأكيد الدفع', 'alt-2')}
      </div>

      <div class="grid cols-2" style="margin-top:18px">
        <div class="card">
          <div class="card-head">
            <div><h3>آخر الفواتير</h3><p>أحدث ٦ فواتير على المنصة</p></div>
            <a class="btn ghost sm" href="#/invoices">عرض الكل</a>
          </div>
          <div class="table-wrap"><table class="data" style="min-width:480px">
            <thead><tr><th>المرجع</th><th>الطالب</th><th>الكورس</th><th>القيمة</th><th>الحالة</th></tr></thead>
            <tbody>
              ${
                invoices.length
                  ? invoices
                      .map(
                        invoice => `<tr>
                          <td><span class="code-box">${esc(invoice.reference)}</span></td>
                          <td>${esc(invoice.studentName)}</td>
                          <td>${esc(invoice.courseName)}</td>
                          <td class="num">${esc(P.fmtMoney(invoice.amount))}</td>
                          <td>${P.statusBadge(invoice.status)}</td>
                        </tr>`
                      )
                      .join('')
                  : `<tr><td colspan="5">${P.emptyState('لا توجد فواتير', '', 'invoice')}</td></tr>`
              }
            </tbody>
          </table></div>
        </div>

        <div class="card">
          <div class="card-head">
            <div><h3>آخر العمليات</h3><p>سجل النشاط على اللوحة</p></div>
            <a class="btn ghost sm" href="#/audit">عرض الكل</a>
          </div>
          <div class="card-body">
            ${
              audit.length
                ? `<div class="mini-list">${audit
                    .map(
                      item => `<div class="mini-row">
                        <span class="dot"></span>
                        <div class="mr-main"><b>${esc(P.actorName(item.actor))}</b><span>${esc(item.details || item.action)}</span></div>
                        <span class="mr-time">${esc(P.fmtDate(item.at))}</span>
                      </div>`
                    )
                    .join('')}</div>`
                : P.emptyState('لا توجد عمليات بعد', '', 'history')
            }
          </div>
        </div>
      </div>`;
  }

  // =======================================================================
  // المدرسون
  // =======================================================================

  async function renderTeachers(view) {
    view.innerHTML = `
      ${P.pageHead('المدرسون', 'أضف مدرسين وحدّد بيانات الدخول الخاصة بلوحة المدرس.', `<button type="button" class="btn" id="add-teacher">${icon('plus')} مدرس جديد</button>`)}
      <div class="card"><div id="teachers-table">${P.loadingBlock('جارٍ تحميل المدرسين…')}</div></div>`;

    const tableBox = view.querySelector('#teachers-table');

    async function load() {
      tableBox.innerHTML = P.loadingBlock('جارٍ تحميل المدرسين…');
      const rows = await X.loadTeachers();
      if (!rows.length) {
        tableBox.innerHTML = P.emptyState('لا يوجد مدرسون', 'أضف أول مدرس من الزر أعلى الصفحة.', 'teacher');
        return;
      }
      tableBox.innerHTML = P.table(
        [
          {
            label: 'المدرس',
            render: teacher => `<div class="name-cell">${esc(teacher.name)}</div><div class="sub-cell">${esc(teacher.description || '')}</div>`
          },
          { label: 'الهاتف', render: teacher => `<span class="num" dir="ltr">${esc(teacher.phone)}</span>` },
          { label: 'الكورسات', render: teacher => P.fmtNumber(teacher.courses) },
          { label: 'الطلاب', render: teacher => P.fmtNumber(teacher.students) },
          { label: 'الحالة', render: teacher => (teacher.active === false ? P.badge('موقوف', 'danger') : P.badge('نشط', 'ok')) },
          {
            label: 'الإجراءات',
            render: teacher => `<button type="button" class="btn ghost sm" data-edit="${teacher.id}">${icon('edit')} تعديل</button>`
          }
        ],
        rows
      );

      tableBox.querySelectorAll('[data-edit]').forEach(button => {
        button.addEventListener('click', () => {
          const teacher = rows.find(row => String(row.id) === button.dataset.edit);
          if (teacher) openTeacherForm(teacher, load);
        });
      });
    }

    view.querySelector('#add-teacher').addEventListener('click', () => openTeacherForm(null, load));
    await load();
  }

  function openTeacherForm(teacher, onDone) {
    const body = `
      <div class="field-row">
        ${P.fInput('name', 'اسم المدرس', teacher ? teacher.name : '', { required: true })}
        ${P.fInput('phone', 'رقم الهاتف', teacher ? teacher.phone : '', { required: true, type: 'tel', placeholder: '01xxxxxxxxx', help: 'يُستخدم لتسجيل الدخول للوحة المدرس.' })}
      </div>
      ${P.fInput('password', teacher ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور', '', {
        required: !teacher,
        type: 'password',
        help: teacher ? 'اتركها فارغة للإبقاء على كلمة المرور الحالية.' : 'كلمة مرور لوحة المدرس.'
      })}
      ${P.fTextarea('description', 'نبذة عن المدرس', teacher ? teacher.description : '')}
      ${P.fCheck('visible', 'ظاهر في صفحات الموقع', teacher ? Number(teacher.visible) === 1 : true)}
      ${teacher ? P.fCheck('active', 'الحساب نشط', teacher.active !== false, 'المدرس الموقوف لا يستطيع الدخول.') : ''}`;

    formModal({
      title: teacher ? 'تعديل بيانات المدرس' : 'إضافة مدرس جديد',
      subtitle: teacher ? teacher.name : 'سيتمكن المدرس من الدخول للوحته برقم الهاتف وكلمة المرور.',
      body,
      submitLabel: teacher ? 'حفظ التعديلات' : 'إضافة المدرس',
      onSubmit: async (data, form, close) => {
        if (!data.password) delete data.password;
        if (teacher) {
          await api(`/teachers/${teacher.id}`, { method: 'PATCH', body: data });
          toast('تم تحديث بيانات المدرس.', 'ok');
        } else {
          await api('/teachers', { method: 'POST', body: data });
          toast('تم إضافة المدرس.', 'ok');
        }
        close();
        onDone();
      }
    });
  }

  // =======================================================================
  // المواد
  // =======================================================================

  async function renderSubjects(view) {
    view.innerHTML = `
      ${P.pageHead('المواد', 'اربط كل مادة بالصف الدراسي والمدرسين.', `<button type="button" class="btn" id="add-subject">${icon('plus')} مادة جديدة</button>`)}
      <div class="card"><div id="subjects-table">${P.loadingBlock('جارٍ تحميل المواد…')}</div></div>`;

    const tableBox = view.querySelector('#subjects-table');
    let teachers = [];

    async function load() {
      tableBox.innerHTML = P.loadingBlock('جارٍ تحميل المواد…');
      [teachers] = await Promise.all([X.loadTeachers()]);
      const rows = await X.loadSubjects();
      if (!rows.length) {
        tableBox.innerHTML = P.emptyState('لا توجد مواد', 'أضف أول مادة من الزر أعلى الصفحة.', 'book');
        return;
      }
      tableBox.innerHTML = P.table(
        [
          {
            label: 'المادة',
            render: subject => `<div class="name-cell">${esc(subject.name)}</div><div class="sub-cell">${esc(subject.description || '')}</div>`
          },
          { label: 'الصف', render: subject => esc(X.yearLabel(subject.year)) },
          { label: 'الكورسات', render: subject => P.fmtNumber(subject.courses) },
          {
            label: 'المدرسون',
            render: subject =>
              (subject.teacherIds || [])
                .map(id => {
                  const teacher = teachers.find(item => Number(item.id) === Number(id));
                  return teacher ? P.badge(teacher.name, 'brand', true) : '';
                })
                .join(' ') || '—'
          },
          { label: 'الحالة', render: subject => (Number(subject.visible) === 1 ? P.badge('ظاهرة', 'ok') : P.badge('مخفية', 'danger')) },
          {
            label: 'الإجراءات',
            render: subject => `<button type="button" class="btn ghost sm" data-edit="${subject.id}">${icon('edit')} تعديل</button>`
          }
        ],
        rows
      );

      tableBox.querySelectorAll('[data-edit]').forEach(button => {
        button.addEventListener('click', () => {
          const subject = rows.find(row => String(row.id) === button.dataset.edit);
          if (subject) openSubjectForm(subject, teachers, load);
        });
      });
    }

    view.querySelector('#add-subject').addEventListener('click', () => openSubjectForm(null, teachers, load));
    await load();
  }

  function openSubjectForm(subject, teachers, onDone) {
    const selected = new Set((subject ? subject.teacherIds || [] : []).map(String));
    const body = `
      <div class="field-row">
        ${P.fInput('name', 'اسم المادة', subject ? subject.name : '', { required: true, placeholder: 'مثال: الفيزياء' })}
        ${P.fSelect('year', 'الصف الدراسي', subject ? subject.year : 3, X.YEARS)}
      </div>
      ${P.fTextarea('description', 'وصف المادة', subject ? subject.description : '')}
      ${P.fCheck('visible', 'ظاهرة للطلاب', subject ? Number(subject.visible) === 1 : true)}
      <div class="field">
        <label>المدرسون المسؤولون</label>
        ${
          teachers.length
            ? `<div class="check-list" style="max-height:200px">${teachers
                .map(
                  teacher => `<label class="check-row">
                    <input type="checkbox" name="t_${teacher.id}" ${selected.has(String(teacher.id)) ? 'checked' : ''} />
                    <span class="ct">${esc(teacher.name)} <span class="badge plain" style="font-size:10px">${esc(teacher.phone)}</span></span>
                  </label>`
                )
                .join('')}</div>`
            : `<div class="alert warn">لا يوجد مدرسون بعد. أضف مدرسًا أولًا من صفحة المدرسين.</div>`
        }
      </div>`;

    formModal({
      title: subject ? 'تعديل المادة' : 'إضافة مادة جديدة',
      subtitle: subject ? subject.name : 'حدد اسم المادة والصف والمدرسين.',
      body,
      submitLabel: subject ? 'حفظ التعديلات' : 'إضافة المادة',
      onSubmit: async (data, form, close) => {
        const teacherIds = Object.keys(data)
          .filter(key => key.startsWith('t_') && data[key])
          .map(key => Number(key.slice(2)));
        const payload = {
          name: data.name,
          year: data.year,
          description: data.description,
          visible: data.visible,
          teacherIds
        };
        if (subject) {
          await api(`/subjects/${subject.id}`, { method: 'PATCH', body: payload });
          toast('تم تحديث المادة.', 'ok');
        } else {
          await api('/subjects', { method: 'POST', body: payload });
          toast('تم إضافة المادة.', 'ok');
        }
        close();
        onDone();
      }
    });
  }

  // =======================================================================
  // الفواتير
  // =======================================================================

  async function renderInvoices(view) {
    view.innerHTML = `
      ${P.pageHead('الفواتير', 'راجع الفواتير، أكّد المدفوعات، أو ألغِ الفواتير غير الصحيحة.')}
      <div class="card">
        <div class="card-head">
          <div class="toolbar" style="flex:1">
            <select id="invoice-status">
              <option value="">كل الحالات</option>
              <option value="paid">مدفوعة</option>
              <option value="pending">قيد المراجعة</option>
              <option value="cancelled">ملغاة</option>
            </select>
          </div>
          <span class="badge brand plain" id="invoice-count"></span>
        </div>
        <div id="invoices-table"></div>
      </div>`;

    const tableBox = view.querySelector('#invoices-table');
    const countBox = view.querySelector('#invoice-count');
    const state = { page: 1, status: '' };

    async function load(page) {
      state.page = page || 1;
      tableBox.innerHTML = P.loadingBlock('جارٍ تحميل الفواتير…');
      const meta = await api('/invoices' + qs(state));
      const rows = meta.data || [];
      countBox.textContent = `${P.fmtNumber(meta.total || 0)} فاتورة`;

      if (!rows.length) {
        tableBox.innerHTML = P.emptyState('لا توجد فواتير مطابقة', 'جرّب تغيير فلتر الحالة.', 'invoice');
        return;
      }

      tableBox.innerHTML =
        P.table(
          [
            { label: 'المرجع', render: invoice => `<span class="code-box">${esc(invoice.reference)}</span>` },
            { label: 'الطالب', render: invoice => esc(invoice.studentName) },
            { label: 'الكورس', render: invoice => esc(invoice.courseName) },
            { label: 'القيمة', render: invoice => `<span class="num">${esc(P.fmtMoney(invoice.amount))}</span>` },
            { label: 'التاريخ', render: invoice => esc(P.fmtDate(invoice.createdAt)) },
            { label: 'الحالة', render: invoice => P.statusBadge(invoice.status) },
            {
              label: 'الإجراءات',
              render: invoice =>
                invoice.status === 'pending'
                  ? `<div class="actions">
                      <button type="button" class="btn success sm" data-pay="${invoice.id}">${icon('check')} تأكيد الدفع</button>
                      <button type="button" class="btn ghost sm" data-cancel="${invoice.id}">${icon('x')} إلغاء</button>
                    </div>`
                  : '—'
            }
          ],
          rows
        ) + P.pagination(meta);

      P.bindPagination(tableBox, load);

      tableBox.querySelectorAll('[data-pay]').forEach(button => {
        button.addEventListener('click', () => {
          const invoice = rows.find(row => String(row.id) === button.dataset.pay);
          confirmModal({
            title: 'تأكيد دفع الفاتورة',
            message: `سيتم اعتبار «${invoice.reference}» مدفوعة وإضافة اشتراك الطالب في الكورس.`,
            confirmLabel: 'تأكيد الدفع',
            danger: false,
            onConfirm: async () => {
              await api(`/invoices/${invoice.id}/pay`, { method: 'POST', body: {} });
              toast('تم تأكيد الدفع.', 'ok');
              load(state.page);
            }
          });
        });
      });

      tableBox.querySelectorAll('[data-cancel]').forEach(button => {
        button.addEventListener('click', () => {
          const invoice = rows.find(row => String(row.id) === button.dataset.cancel);
          confirmModal({
            title: 'إلغاء الفاتورة',
            message: `سيتم إلغاء «${invoice.reference}».`,
            confirmLabel: 'إلغاء الفاتورة',
            onConfirm: async () => {
              await api(`/invoices/${invoice.id}/cancel`, { method: 'POST', body: {} });
              toast('تم إلغاء الفاتورة.', 'ok');
              load(state.page);
            }
          });
        });
      });
    }

    view.querySelector('#invoice-status').addEventListener('change', event => {
      state.status = event.target.value;
      load(1);
    });

    await load(1);
  }

  // =======================================================================
  // المجتمع
  // =======================================================================

  async function renderCommunity(view) {
    view.innerHTML = `
      ${P.pageHead('المجتمع', 'راجع منشورات الطلاب واعتمدها أو ارفضها.')}
      <div class="card">
        <div class="card-head">
          <div class="toolbar" style="flex:1">
            <select id="community-status">
              <option value="">كل المنشورات</option>
              <option value="pending">بانتظار الاعتماد</option>
              <option value="approved">معتمدة</option>
            </select>
          </div>
          <span class="badge brand plain" id="community-count"></span>
        </div>
        <div id="community-table"></div>
      </div>`;

    const tableBox = view.querySelector('#community-table');
    const countBox = view.querySelector('#community-count');
    let status = '';

    async function load() {
      tableBox.innerHTML = P.loadingBlock('جارٍ تحميل المنشورات…');
      const data = await api('/community' + qs({ status }));
      const rows = data.data || [];
      countBox.textContent = `${P.fmtNumber(rows.length)} منشور`;

      if (!rows.length) {
        tableBox.innerHTML = P.emptyState('لا توجد منشورات مطابقة', 'جرّب تغيير الفلتر.', 'chat');
        return;
      }

      tableBox.innerHTML = P.table(
        [
          {
            label: 'المنشور',
            render: post => `<div style="max-width:420px;line-height:1.9;font-size:12.5px">${esc(
              String(post.description || '').slice(0, 180)
            )}${String(post.description || '').length > 180 ? '…' : ''}</div>`
          },
          {
            label: 'الكاتب',
            render: post => esc((post.user && (post.user.full_name || post.user.name)) || '—')
          },
          { label: 'المجموعة', render: post => esc(post.categoryName || '—') },
          { label: 'التاريخ', render: post => esc(P.fmtDate(post.created_at)) },
          { label: 'الحالة', render: post => (post.is_approved ? P.badge('معتمد', 'ok') : P.badge('بانتظار الاعتماد', 'warn')) },
          {
            label: 'الإجراءات',
            render: post =>
              post.is_approved
                ? `<button type="button" class="btn ghost sm" data-reject="${post.id}">${icon('x')} رفض وحذف</button>`
                : `<div class="actions">
                    <button type="button" class="btn success sm" data-approve="${post.id}">${icon('check')} اعتماد</button>
                    <button type="button" class="btn ghost sm" data-reject="${post.id}">${icon('x')} رفض</button>
                  </div>`
          }
        ],
        rows
      );

      tableBox.querySelectorAll('[data-approve]').forEach(button => {
        button.addEventListener('click', async () => {
          try {
            await api(`/community/${button.dataset.approve}/approve`, { method: 'POST', body: {} });
            toast('تم اعتماد المنشور.', 'ok');
            load();
          } catch (err) {
            toast(err.message || 'تعذّر اعتماد المنشور.', 'err');
          }
        });
      });

      tableBox.querySelectorAll('[data-reject]').forEach(button => {
        button.addEventListener('click', () => {
          confirmModal({
            title: 'رفض المنشور',
            message: 'سيتم حذف المنشور نهائيًا من المجتمع.',
            confirmLabel: 'رفض وحذف',
            onConfirm: async () => {
              await api(`/community/${button.dataset.reject}/reject`, { method: 'POST', body: {} });
              toast('تم رفض المنشور.', 'ok');
              load();
            }
          });
        });
      });
    }

    view.querySelector('#community-status').addEventListener('change', event => {
      status = event.target.value;
      load();
    });

    await load();
  }

  // =======================================================================
  // الإعدادات
  // =======================================================================

  async function renderSettings(view) {
    const data = await api('/settings');
    const settings = data.settings || {};

    view.innerHTML = `
      ${P.pageHead('إعدادات المنصة', 'تحكم في التسجيل والدفع والتنبيهات العامة.')}
      <form id="settings-form" class="card" style="max-width:820px">
        <div class="card-head"><h3>الإعدادات العامة</h3></div>
        <div class="card-body">
          <div class="settings-grid">
            <div>
              ${P.fCheck('registrationOpen', 'فتح باب التسجيل', !!settings.registrationOpen, 'السماح بإنشاء حسابات جديدة.')}
              ${P.fCheck('couponable', 'تفعيل أكواد الخصم', !!settings.couponable, 'السماح باستخدام كوبونات الخصم على الكورسات.')}
            </div>
            <div>
              ${P.fSelect('paymentsMode', 'طريقة الدفع', settings.paymentsMode || 'manual', [
                { value: 'manual', label: 'مراجعة يدوية للفواتير' },
                { value: 'automatic', label: 'تأكيد تلقائي (تجريبي)' }
              ])}
              ${P.fInput('supportPhone', 'رقم الدعم الفني', settings.supportPhone || '', { type: 'tel' })}
            </div>
          </div>
          ${P.fTextarea('notice', 'تنبيه يظهر للطلاب', settings.notice || '', {
            help: 'يظهر في لوحة الطالب أو صفحة الدفع حسب تصميم المنصة.'
          })}
          <button type="submit" class="btn">${icon('check')} حفظ الإعدادات</button>
        </div>
      </form>`;

    const form = view.querySelector('#settings-form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await api('/settings', { method: 'PATCH', body: readForm(form) });
        toast('تم حفظ الإعدادات.', 'ok');
      } catch (err) {
        toast(err.message || 'تعذّر حفظ الإعدادات.', 'err');
      } finally {
        button.disabled = false;
      }
    });
  }

  // =======================================================================
  // سجل العمليات
  // =======================================================================

  async function renderAudit(view) {
    view.innerHTML = `
      ${P.pageHead('سجل العمليات', 'كل إجراء تم على اللوحة، مع صاحبه ووقته.')}
      <div class="card"><div id="audit-table">${P.loadingBlock('جارٍ تحميل السجل…')}</div></div>`;

    const tableBox = view.querySelector('#audit-table');

    async function load(page) {
      tableBox.innerHTML = P.loadingBlock('جارٍ تحميل السجل…');
      const meta = await api('/audit' + qs({ page: page || 1 }));
      const rows = meta.data || [];
      if (!rows.length) {
        tableBox.innerHTML = P.emptyState('السجل فارغ', 'ستظهر هنا كل عمليات الإضافة والتعديل والحذف.', 'history');
        return;
      }
      tableBox.innerHTML =
        P.table(
          [
            { label: 'المنفّذ', render: item => P.actorHtml(item.actor) },
            { label: 'الإجراء', render: item => `<span class="code-box" style="font-family:inherit">${esc(item.action)}</span>` },
            { label: 'التفاصيل', render: item => esc(item.details || '—') },
            { label: 'الوقت', render: item => esc(P.fmtDate(item.at)) }
          ],
          rows
        ) + P.pagination(meta);
      P.bindPagination(tableBox, load);
    }

    await load(1);
  }

  // =======================================================================
  // الإداريون
  // =======================================================================

  async function renderAdmins(view) {
    view.innerHTML = `
      ${P.pageHead('الإداريون', 'حسابات الدخول للوحة الأدمن.', `<button type="button" class="btn" id="add-admin">${icon('plus')} أدمن جديد</button>`)}
      <div class="card"><div id="admins-table">${P.loadingBlock('جارٍ تحميل الإداريين…')}</div></div>`;

    const tableBox = view.querySelector('#admins-table');

    async function load() {
      tableBox.innerHTML = P.loadingBlock('جارٍ تحميل الإداريين…');
      const rows = await api('/admins').then(data => data.data || []);
      tableBox.innerHTML = P.table(
        [
          { label: 'الاسم', render: admin => `<span class="name-cell">${esc(admin.name)}</span>` },
          { label: 'البريد الإلكتروني', render: admin => `<span dir="ltr">${esc(admin.email)}</span>` },
          { label: 'الهاتف', render: admin => `<span dir="ltr">${esc(admin.phone || '—')}</span>` },
          {
            label: 'الدور',
            render: admin => (admin.role === 'owner' ? P.badge('مالك المنصة', 'brand') : P.badge('أدمن', 'plain'))
          },
          { label: 'الحالة', render: admin => (admin.active === false ? P.badge('موقوف', 'danger') : P.badge('نشط', 'ok')) }
        ],
        rows
      );
    }

    view.querySelector('#add-admin').addEventListener('click', () => {
      formModal({
        title: 'إضافة أدمن جديد',
        subtitle: 'سيتمكن من الدخول للوحة بنفس البريد وكلمة المرور.',
        body: `
          <div class="field-row">
            ${P.fInput('name', 'الاسم', '', { required: true })}
            ${P.fInput('email', 'البريد الإلكتروني', '', { required: true, type: 'email' })}
          </div>
          <div class="field-row">
            ${P.fInput('phone', 'رقم الهاتف (اختياري)', '', { type: 'tel' })}
            ${P.fInput('password', 'كلمة المرور', '', { required: true, type: 'password' })}
          </div>`,
        submitLabel: 'إضافة الأدمن',
        onSubmit: async (data, form, close) => {
          await api('/admins', { method: 'POST', body: data });
          toast('تم إضافة الأدمن.', 'ok');
          close();
          load();
        }
      });
    });

    await load();
  }

  // =======================================================================
  // التسجيل
  // =======================================================================

  P.registerSections({
    overview: { title: 'نظرة عامة', subtitle: 'ملخص سريع لحالة المنصة', render: renderOverview },
    teachers: { title: 'المدرسون', subtitle: 'إدارة حسابات المدرسين', render: renderTeachers },
    subjects: { title: 'المواد', subtitle: 'المواد والصفوف والمدرسون', render: renderSubjects },
    courses: { title: 'الكورسات', subtitle: 'إدارة الكورسات والمحتوى', render: view => X.renderCourses(view, 'admin') },
    qbanks: { title: 'بنوك الأسئلة', subtitle: 'أسئلة الامتحانات', render: view => X.renderQbanks(view, 'admin') },
    exams: { title: 'الامتحانات', subtitle: 'الامتحانات والواجبات', render: view => X.renderExams(view, 'admin') },
    students: { title: 'الطلاب', subtitle: 'بيانات الطلاب واشتراكاتهم', render: view => X.renderStudents(view, 'admin') },
    invoices: { title: 'الفواتير', subtitle: 'المدفوعات والمراجعة', render: renderInvoices },
    codes: { title: 'أكواد الشحن', subtitle: 'توليد ومتابعة الأكواد', render: view => X.renderCodes(view, 'admin') },
    community: { title: 'المجتمع', subtitle: 'اعتماد منشورات الطلاب', render: renderCommunity },
    settings: { title: 'الإعدادات', subtitle: 'إعدادات المنصة العامة', render: renderSettings },
    audit: { title: 'سجل العمليات', subtitle: 'كل ما تم على اللوحة', render: renderAudit },
    admins: { title: 'الإداريون', subtitle: 'حسابات لوحة التحكم', render: renderAdmins }
  });

  P.boot();
})();
