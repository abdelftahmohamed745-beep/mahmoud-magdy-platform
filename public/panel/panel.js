'use strict';
/*
 * نواة لوحة التحكم — مشتركة بين لوحة الأدمن ولوحة المدرس.
 *
 * كل البيانات تُقرأ من واجهة API المحلية (/api/admin أو /api/teacher-panel)
 * وتُخزَّن في lib/store.js، فأي تعديل يظهر مباشرة في واجهة الطالب.
 */
window.PS = (function () {
  const ROLE = document.body.dataset.panel === 'teacher' ? 'teacher' : 'admin';
  const IS_TEACHER = ROLE === 'teacher';

  const CFG = IS_TEACHER
    ? {
        role: 'teacher',
        apiBase: '/api/teacher-panel',
        tokenKey: 'ps_teacher_token',
        panelName: 'لوحة المدرس',
        panelSub: 'إدارة كورساتك وطلابك',
        siteUrl: '/'
      }
    : {
        role: 'admin',
        apiBase: '/api/admin',
        tokenKey: 'ps_admin_token',
        panelName: 'لوحة تحكم الأدمن',
        panelSub: 'إدارة كاملة للمنصة',
        siteUrl: '/'
      };

  let token = '';
  try {
    token = localStorage.getItem(CFG.tokenKey) || '';
  } catch (err) {
    token = '';
  }

  let me = null;
  let currentRoute = '';

  const SECTIONS = {};
  const NAV = IS_TEACHER
    ? [
        { group: 'الرئيسية', items: [{ key: 'overview', label: 'نظرة عامة', icon: 'grid' }] },
        {
          group: 'المحتوى',
          items: [
            { key: 'courses', label: 'كورساتي', icon: 'layers' },
            { key: 'qbanks', label: 'بنوك الأسئلة', icon: 'help' },
            { key: 'exams', label: 'الامتحانات', icon: 'exam' }
          ]
        },
        {
          group: 'الطلاب',
          items: [
            { key: 'students', label: 'طلابي', icon: 'users' },
            { key: 'grading', label: 'التصحيح', icon: 'check' },
            { key: 'qa', label: 'الأسئلة والأجوبة', icon: 'chat' }
          ]
        },
        {
          group: 'الحساب',
          items: [
            { key: 'codes', label: 'أكواد الشحن', icon: 'code' },
            { key: 'profile', label: 'ملفي الشخصي', icon: 'user' }
          ]
        }
      ]
    : [
        { group: 'الرئيسية', items: [{ key: 'overview', label: 'نظرة عامة', icon: 'grid' }] },
        {
          group: 'إدارة المحتوى',
          items: [
            { key: 'courses', label: 'الكورسات', icon: 'layers' },
            { key: 'subjects', label: 'المواد', icon: 'book' },
            { key: 'teachers', label: 'المدرسون', icon: 'teacher' },
            { key: 'qbanks', label: 'بنوك الأسئلة', icon: 'help' },
            { key: 'exams', label: 'الامتحانات', icon: 'exam' }
          ]
        },
        {
          group: 'الطلاب والمبيعات',
          items: [
            { key: 'students', label: 'الطلاب', icon: 'users' },
            { key: 'invoices', label: 'الفواتير', icon: 'invoice' },
            { key: 'codes', label: 'أكواد الشحن', icon: 'code' }
          ]
        },
        {
          group: 'المنصة',
          items: [
            { key: 'community', label: 'المجتمع', icon: 'chat' },
            { key: 'settings', label: 'الإعدادات', icon: 'settings' },
            { key: 'audit', label: 'سجل العمليات', icon: 'history' },
            { key: 'admins', label: 'الإداريون', icon: 'shield' }
          ]
        }
      ];

  // -----------------------------------------------------------------------
  // أدوات عامة
  // -----------------------------------------------------------------------

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function fmtMoney(value) {
    const n = Number(value) || 0;
    return `${n.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`;
  }

  function fmtNumber(value) {
    return (Number(value) || 0).toLocaleString('ar-EG');
  }

  function fmtDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
  }

  function fmtDateOnly(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ar-EG', { dateStyle: 'medium' });
  }

  function qs(params) {
    const search = new URLSearchParams();
    Object.keys(params || {}).forEach(key => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== '') search.set(key, value);
    });
    const text = search.toString();
    return text ? `?${text}` : '';
  }

  function debounce(fn, wait) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // -----------------------------------------------------------------------
  // أيقونات
  // -----------------------------------------------------------------------

  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    teacher: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1.2 2.7 3 6 3s6-1.8 6-3v-5"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4"/><path d="M12 17h.01"/>',
    exam: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
    invoice: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>',
    code: '<path d="M20.59 13.41 12 22l-9-9V3h10l7.59 7.59a2 2 0 0 1 0 2.82Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9 9 0 0 1-4-1L3 21l1.9-4A8.5 8.5 0 1 1 21 11.5Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    money: '<circle cx="12" cy="12" r="9"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M12 6v12"/>',
    video: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 10 6-3v10l-6-3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
    star: '<path d="m12 3 2.7 5.7 6.3.9-4.5 4.4 1 6.2-5.5-3-5.5 3 1-6.2L3 9.6l6.3-.9Z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4-2v-4Z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    arrow: '<path d="m9 18 6-6-6-6"/>'
  };

  function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.grid}</svg>`;
  }

  // -----------------------------------------------------------------------
  // الشبكة
  // -----------------------------------------------------------------------

  async function api(path, options) {
    const opts = options || {};
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(CFG.apiBase + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });

    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      data = null;
    }

    if (res.status === 401) {
      const error = new Error((data && data.message) || 'انتهت الجلسة. سجّل الدخول من جديد.');
      error.status = 401;
      throw error;
    }

    if (!res.ok) {
      const error = new Error((data && data.message) || 'حدث خطأ غير متوقع.');
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data || {};
  }

  // -----------------------------------------------------------------------
  // تنبيهات ونوافذ
  // -----------------------------------------------------------------------

  function toast(message, type) {
    const root = document.getElementById('toasts');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast ${type === 'ok' ? 'ok' : type === 'err' ? 'err' : 'info'}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 280);
    }, 3600);
  }

  let modalKeyHandler = null;

  function openModal(options) {
    const root = document.getElementById('modal-root');
    const wideClass = options.xwide ? 'xwide' : options.wide ? 'wide' : '';
    root.innerHTML = `
      <div class="modal-overlay" role="dialog" aria-modal="true">
        <div class="modal ${wideClass}">
          <div class="modal-head">
            <div>
              <h3>${esc(options.title || '')}</h3>
              ${options.subtitle ? `<p>${esc(options.subtitle)}</p>` : ''}
            </div>
            <button type="button" class="modal-close" data-close aria-label="إغلاق">✕</button>
          </div>
          <div class="modal-body">${options.body || ''}</div>
          ${options.footer ? `<div class="modal-foot">${options.footer}</div>` : ''}
        </div>
      </div>`;

    const overlay = root.firstElementChild;
    const close = () => {
      root.innerHTML = '';
      if (modalKeyHandler) {
        document.removeEventListener('keydown', modalKeyHandler);
        modalKeyHandler = null;
      }
    };

    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-close]')) close();
    });

    modalKeyHandler = event => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', modalKeyHandler);

    return { overlay, close, root };
  }

  function readForm(form) {
    const data = {};
    for (const el of Array.from(form.elements)) {
      if (!el.name) continue;
      if (el.type === 'checkbox') data[el.name] = el.checked;
      else if (el.type === 'number') data[el.name] = el.value === '' ? null : Number(el.value);
      else data[el.name] = el.value;
    }
    return data;
  }

  function formModal(options) {
    const modal = openModal({
      title: options.title,
      subtitle: options.subtitle,
      wide: options.wide,
      xwide: options.xwide,
      body: `<form id="panel-form" autocomplete="off">${options.body || ''}</form>`,
      footer: `<button type="submit" form="panel-form" class="btn ${options.danger ? 'danger' : ''}">${esc(
        options.submitLabel || 'حفظ'
      )}</button>
        <button type="button" class="btn ghost" data-close>إلغاء</button>`
    });

    const form = modal.overlay.querySelector('#panel-form');
    const submit = modal.overlay.querySelector('[form="panel-form"]');

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = 'جارٍ الحفظ…';
      try {
        await options.onSubmit(readForm(form), form, modal.close);
      } catch (err) {
        toast(err.message || 'تعذّر الحفظ.', 'err');
      } finally {
        if (document.body.contains(submit)) {
          submit.disabled = false;
          submit.textContent = original;
        }
      }
    });

    if (options.onMount) options.onMount(modal.overlay, form, modal.close);
    return modal;
  }

  function confirmModal(options) {
    const modal = openModal({
      title: options.title || 'تأكيد العملية',
      body: `<div class="alert ${options.danger === false ? 'info' : 'danger'}">${esc(
        options.message || 'هل أنت متأكد؟'
      )}</div>`,
      footer: `<button type="button" class="btn ${options.danger === false ? '' : 'danger'}" id="confirm-btn">${esc(
        options.confirmLabel || 'تأكيد'
      )}</button><button type="button" class="btn ghost" data-close>إلغاء</button>`
    });

    const button = modal.overlay.querySelector('#confirm-btn');
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'جارٍ التنفيذ…';
      try {
        await options.onConfirm();
        modal.close();
      } catch (err) {
        toast(err.message || 'تعذّر تنفيذ العملية.', 'err');
        button.disabled = false;
        button.textContent = options.confirmLabel || 'تأكيد';
      }
    });
    return modal;
  }

  // -----------------------------------------------------------------------
  // قوالب
  // -----------------------------------------------------------------------

  function loadingBlock(text) {
    return `<div class="loading-block"><div class="spinner"></div><div>${esc(text || 'جارٍ التحميل…')}</div></div>`;
  }

  function emptyState(title, subtitle, iconName) {
    return `<div class="empty">
      <div class="empty-ico">${icon(iconName || 'grid')}</div>
      <h4>${esc(title || 'لا توجد بيانات')}</h4>
      <p>${esc(subtitle || '')}</p>
    </div>`;
  }

  function pageHead(title, subtitle, actions) {
    return `<div class="page-head">
      <div>
        <h2>${esc(title)}</h2>
        ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
      </div>
      ${actions ? `<div class="toolbar">${actions}</div>` : ''}
    </div>`;
  }

  function table(columns, rows) {
    return `<div class="table-wrap"><table class="data">
      <thead><tr>${columns.map(col => `<th>${esc(col.label)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows
          .map(
            row =>
              `<tr>${columns
                .map(col => `<td class="${col.cls || ''}">${col.render ? col.render(row) : esc(row[col.key])}</td>`)
                .join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table></div>`;
  }

  function badge(text, tone, plain) {
    return `<span class="badge ${tone || ''} ${plain ? 'plain' : ''}">${esc(text)}</span>`;
  }

  const STATUS_LABELS = {
    paid: ['مدفوعة', 'ok'],
    pending: ['قيد المراجعة', 'warn'],
    cancelled: ['ملغاة', 'danger'],
    graded: ['مُصححة', 'ok'],
    open: ['بانتظار الرد', 'warn'],
    answered: ['تم الرد', 'ok'],
    exam: ['امتحان', 'brand'],
    hm: ['واجب', 'info']
  };

  function statusBadge(status) {
    const entry = STATUS_LABELS[status] || [status || '—', 'plain'];
    return badge(entry[0], entry[1]);
  }

  function actorParts(actor) {
    const text = String(actor || '');
    const index = text.indexOf(':');
    if (index > 0) return { role: text.slice(0, index), name: text.slice(index + 1) };
    return { role: '', name: text };
  }

  function actorName(actor) {
    return actorParts(actor).name || '—';
  }

  function actorHtml(actor) {
    const parts = actorParts(actor);
    const label = parts.role === 'teacher' ? 'مدرس' : parts.role === 'admin' ? 'أدمن' : '';
    return `<span class="name-cell">${esc(parts.name || '—')}</span>${
      label ? ` ${badge(label, parts.role === 'teacher' ? 'info' : 'brand', true)}` : ''
    }`;
  }

  function pagination(meta) {
    if (!meta || !meta.total) return '';
    const page = Number(meta.page) || 1;
    const pages = Number(meta.pages) || 1;
    const from = (page - 1) * meta.limit + 1;
    const to = Math.min(page * meta.limit, meta.total);
    let buttons = '';
    const start = Math.max(1, Math.min(page - 2, pages - 4));
    const end = Math.min(pages, start + 4);
    for (let i = start; i <= end; i++) {
      buttons += `<button type="button" class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    return `<div class="pagination">
      <div class="info">عرض ${from}–${to} من ${fmtNumber(meta.total)}</div>
      <div class="pages">
        <button type="button" class="page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>السابق</button>
        ${buttons}
        <button type="button" class="page-btn" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>التالي</button>
      </div>
    </div>`;
  }

  function bindPagination(container, load) {
    container.querySelectorAll('[data-page]').forEach(button => {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        load(Number(button.dataset.page));
      });
    });
  }

  function statCard(label, value, iconName, foot, tone) {
    return `<div class="stat ${tone || ''}">
      <div class="stat-ico">${icon(iconName)}</div>
      <div class="stat-label">${esc(label)}</div>
      <div class="stat-value">${esc(value)}</div>
      ${foot ? `<div class="stat-foot">${esc(foot)}</div>` : ''}
    </div>`;
  }

  function fInput(name, label, value, options) {
    const opts = options || {};
    return `<div class="field">
      <label for="f-${name}">${esc(label)}${opts.required ? ' *' : ''}</label>
      <input id="f-${name}" name="${name}" type="${opts.type || 'text'}" value="${esc(value == null ? '' : value)}"
        placeholder="${esc(opts.placeholder || '')}" ${opts.required ? 'required' : ''}
        ${opts.min !== undefined ? `min="${opts.min}"` : ''} ${opts.max !== undefined ? `max="${opts.max}"` : ''}
        ${opts.step !== undefined ? `step="${opts.step}"` : ''} ${opts.disabled ? 'disabled' : ''} />
      ${opts.help ? `<div class="help">${esc(opts.help)}</div>` : ''}
    </div>`;
  }

  function fSelect(name, label, value, options, config) {
    const cfg = config || {};
    return `<div class="field">
      <label for="f-${name}">${esc(label)}${cfg.required ? ' *' : ''}</label>
      <select id="f-${name}" name="${name}" ${cfg.required ? 'required' : ''}>
        ${cfg.placeholder ? `<option value="">${esc(cfg.placeholder)}</option>` : ''}
        ${options
          .map(option => {
            const optValue = option.value !== undefined ? option.value : option.id;
            const optLabel = option.label !== undefined ? option.label : option.name;
            return `<option value="${esc(optValue)}" ${String(optValue) === String(value) ? 'selected' : ''}>${esc(
              optLabel
            )}</option>`;
          })
          .join('')}
      </select>
      ${cfg.help ? `<div class="help">${esc(cfg.help)}</div>` : ''}
    </div>`;
  }

  function fTextarea(name, label, value, options) {
    const opts = options || {};
    return `<div class="field">
      <label for="f-${name}">${esc(label)}${opts.required ? ' *' : ''}</label>
      <textarea id="f-${name}" name="${name}" placeholder="${esc(opts.placeholder || '')}" ${
      opts.required ? 'required' : ''
    }>${esc(value == null ? '' : value)}</textarea>
      ${opts.help ? `<div class="help">${esc(opts.help)}</div>` : ''}
    </div>`;
  }

  function fCheck(name, label, checked, help) {
    return `<div class="switch-row" style="border-bottom:0;padding:6px 0">
      <div class="sw-txt"><b>${esc(label)}</b>${help ? `<span>${esc(help)}</span>` : ''}</div>
      <label class="switch">
        <input type="checkbox" name="${name}" ${checked ? 'checked' : ''} />
        <span class="track"></span>
      </label>
    </div>`;
  }

  // -----------------------------------------------------------------------
  // الدخول
  // -----------------------------------------------------------------------

  function renderLogin(message) {
    const isTeacher = IS_TEACHER;
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="login-wrap">
        <div class="login-card">
          <div class="login-brand">
            <div class="logo-row">
              <div class="logo-mark">Φ</div>
              <div>
                <h1>Physics Society</h1>
                <div class="sub">منصة محمود مجدي — الفيزياء للثانوية العامة</div>
              </div>
            </div>
            <div>
              <h2 class="headline">${isTeacher ? 'مساحة المدرس<br><span>لإدارة المحتوى والطلاب</span>' : 'إدارة المنصة<br><span>من مكان واحد</span>'}</h2>
              <p>${
                isTeacher
                  ? 'أضف الحصص والامتحانات، صحّح إجابات الطلاب، وتابع أسئلتهم وأكواد الشحن الخاصة بكورساتك.'
                  : 'تحكم كامل في الكورسات والمواد والمدرسين والطلاب والفواتير والمجتمع، مع سجل لكل عملية.'
              }</p>
              <div class="chips">
                <span class="chip">${isTeacher ? 'كورساتي' : 'الطلاب والفواتير'}</span>
                <span class="chip">${isTeacher ? 'التصحيح والواجبات' : 'بنوك الأسئلة'}</span>
                <span class="chip">${isTeacher ? 'الأسئلة والأجوبة' : 'المجتمع والإعدادات'}</span>
              </div>
            </div>
            <div class="sub">نسخة تجريبية لإعادة بناء المنصة — كل البيانات محلية.</div>
          </div>
          <div class="login-form-side">
            <h2>${isTeacher ? 'دخول المدرس' : 'دخول الأدمن'}</h2>
            <p class="hint">${
              isTeacher ? 'أدخل رقم هاتفك وكلمة المرور الخاصة بلوحة المدرس.' : 'أدخل البريد الإلكتروني أو رقم الهاتف وكلمة المرور.'
            }</p>
            <div class="login-error ${message ? 'show' : ''}" id="login-error">${esc(message || '')}</div>
            <form id="login-form" autocomplete="off">
              ${
                isTeacher
                  ? fInput('phone', 'رقم الهاتف', '', { required: true, placeholder: '01xxxxxxxxx', type: 'tel' })
                  : fInput('email', 'البريد الإلكتروني أو الهاتف', '', { required: true, placeholder: 'admin@physics.society' })
              }
              ${fInput('password', 'كلمة المرور', '', { required: true, type: 'password', placeholder: '••••••••' })}
              <button type="submit" class="btn block" id="login-submit">دخول</button>
            </form>
            <div class="login-demo">
              <b>بيانات تجريبية:</b><br />
              ${
                isTeacher
                  ? 'هاتف: <b>01100000001</b> — كلمة المرور: <b>teacher123</b>'
                  : 'البريد: <b>admin@physics.society</b> — كلمة المرور: <b>Admin@2026</b>'
              }
            </div>
            <div class="login-footer">
              <a href="/">← العودة للموقع</a>
              <span>Physics Society © 2026</span>
            </div>
          </div>
        </div>
      </div>`;

    const form = document.getElementById('login-form');
    const error = document.getElementById('login-error');
    const submit = document.getElementById('login-submit');

    form.addEventListener('submit', async event => {
      event.preventDefault();
      error.classList.remove('show');
      submit.disabled = true;
      submit.textContent = 'جارٍ الدخول…';
      const body = readForm(form);
      try {
        const data = await fetch(`${CFG.apiBase}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body)
        }).then(async res => {
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.message || 'بيانات الدخول غير صحيحة.');
          return json;
        });
        token = data.token;
        try {
          localStorage.setItem(CFG.tokenKey, token);
        } catch (err) {
          /* التخزين قد يكون معطلًا */
        }
        await boot();
      } catch (err) {
        error.textContent = err.message || 'تعذّر تسجيل الدخول.';
        error.classList.add('show');
      } finally {
        submit.disabled = false;
        submit.textContent = 'دخول';
      }
    });
  }

  async function logout(silent) {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
    } catch (err) {
      /* تجاهل */
    }
    token = '';
    me = null;
    try {
      localStorage.removeItem(CFG.tokenKey);
    } catch (err) {
      /* تجاهل */
    }
    currentRoute = '';
    if (!silent) toast('تم تسجيل الخروج.', 'ok');
    renderLogin();
  }

  // -----------------------------------------------------------------------
  // الهيكل
  // -----------------------------------------------------------------------

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '؟';
    if (parts.length === 1) return parts[0].slice(0, 2);
    return `${parts[0][0]}${parts[1][0]}`;
  }

  function renderShell() {
    const app = document.getElementById('app');
    const person = me || {};
    const displayName = person.name || (IS_TEACHER ? 'المدرس' : 'الأدمن');
    const roleLabel = IS_TEACHER ? 'حساب مدرس' : person.role === 'owner' ? 'مالك المنصة' : 'أدمن';

    app.innerHTML = `
      <div class="shell" id="shell">
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
        <aside class="sidebar">
          <div class="sidebar-brand">
            <div class="logo-mark">Φ</div>
            <div>
              <div class="name">Physics Society</div>
              <div class="role">${esc(CFG.panelName)}</div>
            </div>
          </div>
          <nav class="nav" id="nav">
            ${NAV.map(
              group => `
              <div class="nav-group-title">${esc(group.group)}</div>
              ${group.items
                .map(
                  item => `<button type="button" class="nav-item" data-route="${item.key}">
                    <span class="ico">${icon(item.icon)}</span>
                    <span>${esc(item.label)}</span>
                  </button>`
                )
                .join('')}`
            ).join('')}
          </nav>
          <div class="sidebar-foot">
            <div class="sidebar-user">
              <div class="avatar">${esc(initials(displayName))}</div>
              <div class="who"><b>${esc(displayName)}</b><span>${esc(roleLabel)}</span></div>
            </div>
            <button type="button" class="nav-item" id="logout-btn">
              <span class="ico">${icon('logout')}</span><span>تسجيل الخروج</span>
            </button>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button type="button" class="icon-btn menu-btn" id="menu-btn" aria-label="القائمة">${icon('menu')}</button>
            <div>
              <h1 class="page-title" id="top-title">${esc(CFG.panelName)}</h1>
              <p class="page-sub" id="top-sub">${esc(CFG.panelSub)}</p>
            </div>
            <div class="spacer"></div>
            <span class="clock" id="clock"></span>
            <a class="icon-btn" href="/" title="الموقع" aria-label="الموقع">${icon('home')}</a>
            <button type="button" class="icon-btn" id="top-logout" title="تسجيل الخروج" aria-label="تسجيل الخروج">${icon('logout')}</button>
          </header>
          <main class="content" id="view"></main>
        </div>
      </div>`;

    const shell = document.getElementById('shell');
    const view = document.getElementById('view');
    const topTitle = document.getElementById('top-title');
    const topSub = document.getElementById('top-sub');

    document.getElementById('menu-btn').addEventListener('click', () => shell.classList.toggle('nav-open'));
    document.getElementById('sidebar-overlay').addEventListener('click', () => shell.classList.remove('nav-open'));
    document.getElementById('logout-btn').addEventListener('click', () => logout(false));
    document.getElementById('top-logout').addEventListener('click', () => logout(false));

    document.getElementById('nav').addEventListener('click', event => {
      const button = event.target.closest('[data-route]');
      if (!button) return;
      shell.classList.remove('nav-open');
      if (currentRoute === button.dataset.route) {
        showRoute(button.dataset.route);
      } else {
        location.hash = `#/${button.dataset.route}`;
      }
    });

    function tick() {
      const clock = document.getElementById('clock');
      if (!clock) return;
      clock.textContent = new Date().toLocaleString('ar-EG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    tick();
    setInterval(tick, 30000);

    function showRoute(route) {
      const section = SECTIONS[route] || SECTIONS.overview;
      if (!section) {
        view.innerHTML = emptyState('القسم غير متاح', 'لم يتم تحميل هذا القسم بعد.', 'grid');
        return;
      }
      currentRoute = route;
      document.querySelectorAll('.nav-item[data-route]').forEach(item => {
        item.classList.toggle('active', item.dataset.route === route);
      });
      topTitle.textContent = section.title || route;
      topSub.textContent = section.subtitle || CFG.panelSub;
      document.title = `${section.title || route} — ${CFG.panelName}`;
      view.innerHTML = loadingBlock();
      Promise.resolve()
        .then(() => section.render(view))
        .catch(err => {
          if (err && err.status === 401) {
            logout(true);
            return;
          }
          console.error('[panel]', err);
          view.innerHTML = `<div class="alert danger">${esc(err.message || 'تعذّر تحميل البيانات.')}</div>
            <button type="button" class="btn ghost" onclick="location.reload()">إعادة المحاولة</button>`;
        });
    }

    function routeFromHash() {
      const route = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
      showRoute(route || 'overview');
    }

    window.addEventListener('hashchange', routeFromHash);
    routeFromHash();
  }

  // -----------------------------------------------------------------------
  // الإقلاع
  // -----------------------------------------------------------------------

  async function boot() {
    if (!token) {
      renderLogin();
      return;
    }
    try {
      const data = await api('/auth/me');
      me = data.admin || data.teacher || null;
      if (!me) throw new Error('تعذّر التحقق من الجلسة.');
      renderShell();
    } catch (err) {
      if (err.status === 401) {
        token = '';
        try {
          localStorage.removeItem(CFG.tokenKey);
        } catch (storageError) {
          /* تجاهل */
        }
        renderLogin('انتهت الجلسة. سجّل الدخول من جديد.');
        return;
      }
      renderLogin(err.message || 'تعذّر الاتصال بالخادم.');
    }
  }

  function registerSections(map) {
    Object.keys(map).forEach(key => {
      SECTIONS[key] = map[key];
    });
  }

  return {
    ROLE,
    IS_TEACHER,
    CFG,
    SECTIONS,
    registerSections,
    boot,
    api,
    esc,
    icon,
    qs,
    debounce,
    toast,
    openModal,
    formModal,
    confirmModal,
    readForm,
    loadingBlock,
    emptyState,
    pageHead,
    table,
    badge,
    statusBadge,
    actorParts,
    actorName,
    actorHtml,
    pagination,
    bindPagination,
    statCard,
    fInput,
    fSelect,
    fTextarea,
    fCheck,
    fmtMoney,
    fmtNumber,
    fmtDate,
    fmtDateOnly,
    getMe: () => me
  };
})();
