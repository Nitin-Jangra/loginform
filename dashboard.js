/* ============================================================================
   HRMS DASHBOARD — dashboard.js
   ----------------------------------------------------------------------------
   Handles: auth guard · profile · attendance punch-in/out · KPI stats ·
            leave balance + donut · holidays · announcements · activity ·
            notification badges · search shortcut · logout

   ── SETUP ──────────────────────────────────────────────────────────────────
   1) Fill CONFIG.supabaseUrl + CONFIG.supabaseAnonKey below.
   2) Until you do, the file runs in DEMO MODE: UI is fully interactive,
      no data is fetched, and everything you see in the HTML stays as-is.

   ── EXPECTED SCHEMA (adjust CONFIG.tables / queries to match yours) ────────
     employees     : id, user_id, full_name, role, department, emp_id,
                     email, phone, location
     attendance    : id, employee_id, work_date (date), check_in (timestamptz),
                     check_out (timestamptz), break_minutes (int)
                     -- UNIQUE(employee_id, work_date) recommended for upsert
     leave_requests: id, employee_id, status ('approved'), starts_on (date)
     overtime      : id, employee_id, status ('approved'), minutes (int),
                     created_at
     tasks         : id, employee_id, status  ('completed' = done)
     holidays      : id, name, date (date)
     announcements : id, title, body, type ('info'|'policy'|'birthday'|'event'),
                     created_at
     activities    : id, employee_id, message, type ('leave'|'payslip'|
                     'overtime'|'task'), created_at
     notifications : id, user_id, read (bool)
     messages      : id, user_id, read (bool)

   ── RLS TIP ────────────────────────────────────────────────────────────────
     Enable Row Level Security and add policies like:
       create policy "own rows" on attendance
         for select using (employee_id in (
           select id from employees where user_id = auth.uid()
         ));
   ========================================================================== */

(function () {
'use strict';

/* ============================================================
   1. CONFIG — edit this block only
   ============================================================ */

var CONFIG = {
    supabaseUrl:     'YOUR_SUPABASE_URL',       // e.g. https://xxxx.supabase.co
    supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',  // anon/public key
    loginUrl:        'index.html',              // redirect target when signed out
    defaultBreakMinutes: 45,

    limits: { announcements: 3, activity: 4, holidays: 3 },

    tables: {
        employees:     'employees',
        attendance:    'attendance',
        leaveRequests: 'leave_requests',
        overtime:      'overtime',
        tasks:         'tasks',
        holidays:      'holidays',
        announcements: 'announcements',
        activities:    'activities',
        notifications: 'notifications',
        messages:      'messages'
    }
};

/* Demo mode = credentials not filled in yet. UI stays interactive,
   every fetch is skipped and static HTML content is preserved. */
var DEMO = !/^https:\/\/(?!YOUR_)/.test(CONFIG.supabaseUrl) ||
           CONFIG.supabaseAnonKey.indexOf('YOUR_') === 0;

/* ============================================================
   2. STATE + TINY DOM UTILS
   ============================================================ */

var sb = null;        // supabase client
var USER = null;      // auth user
var EMP = null;       // employee row
var todayRec = null;  // today's attendance record

function $(sel, root)  { return (root || document).querySelector(sel); }
function byId(id)      { return document.getElementById(id); }
function setText(id, v){ var el = byId(id); if (el) el.textContent = v; }

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function initials(name) {
    var parts = String(name || '').trim().split(/\s+/);
    return ((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '');
}

function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

/* 2025-06-12 (local timezone, avoids UTC off-by-one) */
function todayISO(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function monthRangeISO() {
    var d = new Date();
    var first = new Date(d.getFullYear(), d.getMonth(), 1);
    var last  = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from: todayISO(first), to: todayISO(last) };
}

/* "12 Jun 2025" */
function humanDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* "12 June 2025" (attendance card) */
function longDate(iso) {
    var d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* { time: "09:05", meridiem: "AM" } in 12h format */
function clockParts(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d)) return null;
    var h = d.getHours();
    var mer = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return { time: pad2(h12) + ':' + pad2(d.getMinutes()), meridiem: mer };
}

/* minutes -> "07h 35m" */
function minutesToHm(min) {
    min = Math.max(0, Math.round(min));
    return pad2(Math.floor(min / 60)) + 'h ' + pad2(min % 60) + 'm';
}

/* "2 days ago" */
function timeAgo(iso) {
    if (!iso) return '';
    var diffMs = Date.now() - new Date(iso).getTime();
    var mins = Math.floor(diffMs / 60000);
    if (mins < 1)    return 'Just now';
    if (mins < 60)   return mins + ' min ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24)    return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    var days = Math.floor(hrs / 24);
    if (days < 30)   return days + (days === 1 ? ' day ago' : ' days ago');
    return humanDate(iso);
}

/* whole days from today until date (local) */
function daysUntil(iso) {
    var today = new Date(todayISO());
    var target = new Date(iso);
    return Math.round((target - today) / 86400000);
}

/* re-run count-up animation on a stat element */
function animateNumber(el, target, pad) {
    if (!el) return;
    if (DEMO && typeof target !== 'number') return;

    var reduce = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
        var s0 = String(target);
        while (pad && s0.length < pad) s0 = '0' + s0;
        el.textContent = s0;
        return;
    }

    var duration = 900, start = null;
    function fmt(v) {
        var s = String(Math.round(v));
        while (pad && s.length < pad) s = '0' + s;
        return s;
    }
    function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased);
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

/* ============================================================
   3. AUTH
   ============================================================ */

function initClient() {
    if (DEMO) return false;
    if (!window.supabase) {
        console.warn('[HRMS] Supabase CDN not loaded — falling back to demo mode.');
        return false;
    }
    sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    return true;
}

async function requireAuth() {
    var res = await sb.auth.getUser();
    USER = res && res.data ? res.data.user : null;
    if (!USER) {
        window.location.href = CONFIG.loginUrl;
        throw new Error('[HRMS] Not signed in — redirecting to ' + CONFIG.loginUrl);
    }
    return USER;
}

async function logout() {
    try {
        if (sb) await sb.auth.signOut();
    } catch (e) {
        console.error('[HRMS] Logout failed:', e);
    }
    window.location.href = CONFIG.loginUrl;
}

/* ============================================================
   4. PROFILE + GREETING
   ============================================================ */

function applyGreeting(name) {
    var el = byId('welcomeName');
    if (!el) return;
    var h = new Date().getHours();
    var g = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
    var first = String(name || '').trim().split(/\s+/)[0] || 'there';
    el.textContent = g + ', ' + first + '! \uD83D\uDC4B';
}

function applyProfile(emp) {
    if (!emp) return;

    var name = emp.full_name || emp.name || '';
    if (name) {
        setText('profileName', name);
        setText('topbarName', name);
        applyGreeting(name);
        var ini = initials(name).toUpperCase();
        var pa = byId('profileAvatar'), ta = byId('topbarAvatar');
        if (pa) pa.textContent = ini;
        if (ta) ta.textContent = ini;
    }

    setText('profileRole', emp.role || emp.job_title || '');
    setText('profileDept', emp.department || '');
    if (emp.emp_id) setText('employeeId', 'Employee ID: ' + emp.emp_id);
    if (emp.email)    setText('profileEmail', emp.email);
    if (emp.phone)    setText('profilePhone', emp.phone);
    if (emp.location) setText('profileLocation', emp.location);
}

async function loadProfile() {
    if (DEMO) { applyGreeting('Nitin Jangra'); return; }

    var row = await sb.from(CONFIG.tables.employees)
        .select('*')
        .eq('user_id', USER.id)
        .maybeSingle();

    if (row.error) { console.error('[HRMS] Profile:', row.error.message); return; }
    EMP = row.data;
    applyProfile(EMP);

    if (!EMP) console.warn('[HRMS] No employees row for user_id =', USER.id);
}

/* ============================================================
   5. ATTENDANCE — today + punch in / out
   ============================================================ */

function setPill(state) { // 'present' | 'absent'
    var pill = byId('presentPill');
    if (!pill) return;
    if (state === 'absent') {
        pill.textContent = 'Not Checked In';
        pill.classList.add('pill-absent');
        pill.classList.remove('pill-present');
    } else {
        pill.textContent = 'Present';
        pill.classList.remove('pill-absent');
        pill.classList.add('pill-present');
    }
}

function setAttTime(id, iso) {
    var el = byId(id);
    if (!el) return;
    var c = clockParts(iso);
    if (c) el.innerHTML = esc(c.time) + ' <small>' + c.meridiem + '</small>';
    else   el.innerHTML = '--:-- <small>--</small>';
    el.classList.toggle('dim', !c);
}

function setPunchState(state) { // 'none' | 'in' | 'done'
    var inBtn = byId('checkInBtn'), outBtn = byId('checkOutBtn');
    if (!inBtn || !outBtn) return;

    inBtn.disabled  = (state !== 'none');
    outBtn.disabled = (state !== 'in');

    var inLabel = state === 'none' ? 'Check In' :
                  state === 'in'   ? 'Checked In \u2713' : 'Checked In \u2713';
    inBtn.innerHTML =
        '<i data-lucide="log-in"></i><span class="spinner"></span>' +
        '<span class="btn-label">' + inLabel + '</span>';
    if (state !== 'none') inBtn.querySelector('.pulse-dot') &&
        inBtn.removeChild(inBtn.querySelector('.pulse-dot'));

    outBtn.innerHTML =
        '<i data-lucide="log-out"></i><span class="spinner"></span>' +
        '<span class="btn-label">' +
        (state === 'done' ? 'Checked Out \u2713' : 'Check Out') + '</span>';

    refreshIcons();
}

function applyAttendance(rec) {
    todayRec = rec || null;

    setText('attCheckInDate', longDate(rec && rec.check_in));

    if (!rec || !rec.check_in) {
        setAttTime('attCheckIn', null);
        setAttTime('attCheckOut', null);
        setText('attCheckOutSub', 'Not Checked Out');
        setText('attWorkTime', '00h 00m');
        setText('attBreak', '00h 00m');
        setPill('absent');
        setPunchState('none');
        return;
    }

    setAttTime('attCheckIn', rec.check_in);
    setPill('present');

    if (!rec.check_out) {
        setAttTime('attCheckOut', null);
        setText('attCheckOutSub', 'Not Checked Out');
        setPunchState('in');
    } else {
        setAttTime('attCheckOut', rec.check_out);
        setText('attCheckOutSub', 'Checked Out');
        setPunchState('done');
    }

    var breakMin = rec.break_minutes != null ? rec.break_minutes : CONFIG.defaultBreakMinutes;
    setText('attBreak', minutesToHm(breakMin));

    if (rec.check_in && rec.check_out) {
        var mins = (new Date(rec.check_out) - new Date(rec.check_in)) / 60000 - breakMin;
        setText('attWorkTime', minutesToHm(mins));
    } else {
        setText('attWorkTime', '00h 00m');
    }
}

function btnLoading(btn, on) {
    if (btn) btn.classList.toggle('loading', !!on);
}

async function punchIn() {
    var btn = byId('checkInBtn');
    btnLoading(btn, true);

    try {
        var row = {
            employee_id: EMP ? EMP.id : null,
            work_date:   todayISO(),
            check_in:    new Date().toISOString()
        };
        var res = await sb.from(CONFIG.tables.attendance)
            .upsert(row, { onConflict: 'employee_id,work_date' })
            .select()
            .single();

        if (res.error) throw res.error;
        applyAttendance(res.data);
    } catch (e) {
        console.error('[HRMS] Check-in failed:', e.message || e);
        btnLoading(btn, false);
    }
}

async function punchOut() {
    var btn = byId('checkOutBtn');
    btnLoading(btn, true);

    try {
        var res = await sb.from(CONFIG.tables.attendance)
            .update({
                check_out: new Date().toISOString(),
                break_minutes: todayRec && todayRec.break_minutes != null
                    ? todayRec.break_minutes : CONFIG.defaultBreakMinutes
            })
            .eq('employee_id', EMP ? EMP.id : null)
            .eq('work_date', todayISO())
            .select()
            .single();

        if (res.error) throw res.error;
        applyAttendance(res.data);
    } catch (e) {
        console.error('[HRMS] Check-out failed:', e.message || e);
        btnLoading(btn, false);
    }
}

async function loadTodayAttendance() {
    if (DEMO) return;

    var empId = EMP ? EMP.id : null;
    if (!empId) return;

    var res = await sb.from(CONFIG.tables.attendance)
        .select('*')
        .eq('employee_id', empId)
        .eq('work_date', todayISO())
        .maybeSingle();

    if (res.error) { console.error('[HRMS] Attendance:', res.error.message); return; }
    applyAttendance(res.data);
}

/* Demo punch — same UI flow, no network */
function demoPunch(mode) {
    var btn = byId(mode === 'in' ? 'checkInBtn' : 'checkOutBtn');
    btnLoading(btn, true);

    setTimeout(function () {
        if (mode === 'in') {
            todayRec = {
                work_date: todayISO(),
                check_in: new Date().toISOString(),
                check_out: null,
                break_minutes: CONFIG.defaultBreakMinutes
            };
        } else if (todayRec) {
            todayRec.check_out = new Date().toISOString();
        }
        applyAttendance(todayRec);
        console.info('[HRMS] Demo ' + (mode === 'in' ? 'check-in' : 'check-out') +
            ' recorded (demo mode — nothing saved).');
    }, 650);
}

/* ============================================================
   6. KPI STATS (this month)
   ============================================================ */

async function loadStats() {
    if (DEMO) return;
    var r = monthRangeISO();
    var empId = EMP ? EMP.id : null;
    if (!empId) return;
    var T = CONFIG.tables;

    var jobs = [

        /* Present days: attendance rows with a check-in this month */
        sb.from(T.attendance).select('*', { count: 'exact', head: true })
            .eq('employee_id', empId)
            .gte('work_date', r.from).lte('work_date', r.to)
            .not('check_in', 'is', null)
            .then(function (res) {
                if (!res.error) animateNumber(byId('statPresentDays'), res.count || 0);
            }),

        /* Approved leave days this month */
        sb.from(T.leaveRequests).select('*', { count: 'exact', head: true })
            .eq('employee_id', empId)
            .eq('status', 'approved')
            .gte('starts_on', r.from).lte('starts_on', r.to)
            .then(function (res) {
                if (!res.error) animateNumber(byId('statLeaves'), res.count || 0);
            }),

        /* Approved overtime minutes */
        sb.from(T.overtime).select('minutes')
            .eq('employee_id', empId)
            .eq('status', 'approved')
            .gte('created_at', r.from + 'T00:00:00')
            .then(function (res) {
                if (res.error) return;
                var total = 0;
                (res.data || []).forEach(function (row) {
                    total += Number(row.minutes) || 0;
                });
                setText('statOvertime', minutesToHm(total));
            }),

        /* Pending tasks */
        sb.from(T.tasks).select('*', { count: 'exact', head: true })
            .eq('employee_id', empId)
            .neq('status', 'completed')
            .then(function (res) {
                if (!res.error) animateNumber(byId('statTasks'), res.count || 0, 2);
            })
    ];

    var results = await Promise.allSettled(jobs);
    results.forEach(function (p, i) {
        if (p.status === 'rejected') console.error('[HRMS] Stat ' + i + ':', p.reason);
    });
}

/* ============================================================
   7. LEAVE BALANCE — sidebar list + donut + legend
   ============================================================ */

var LEAVE_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899'];

function renderSidebarBalance(items) {
    var wrap = byId('leaveBalanceList');
    if (!wrap) return;
    wrap.innerHTML = items.map(function (it, i) {
        return '<div class="lb-row">' +
            '<span class="lb-dot" style="--c:' + (it.color || LEAVE_COLORS[i % 4]) + '"></span>' +
            '<span class="lb-name">' + esc(it.name) + '</span>' +
            '<b>' + pad2(it.days) + '</b>' +
            '</div>';
    }).join('');
}

function renderLegend(items) {
    var wrap = byId('leaveLegend');
    if (!wrap) return;
    wrap.innerHTML = items.map(function (it, i) {
        return '<div class="lg-row">' +
            '<span class="lg-dot" style="--c:' + (it.color || LEAVE_COLORS[i % 4]) + '"></span>' +
            '<span class="lg-name">' + esc(it.name) + '</span>' +
            '<b>' + pad2(it.days) + ' Days</b>' +
            '</div>';
    }).join('');
}

/* Recompute donut geometry for any set of leave values */
function updateDonut(items) {
    var svg = $('.donut');
    if (!svg) return;

    var segs = svg.querySelectorAll('.donut-seg');
    var C = 2 * Math.PI * 54;   /* r=54 in the SVG viewBox */
    var PAD = 3;                /* visual gap between segments */
    var total = 0, i;

    for (i = 0; i < items.length; i++) total += Number(items[i].days) || 0;
    setText('donutTotal', String(total));

    var acc = 0;
    for (i = 0; i < segs.length; i++) {
        var seg = segs[i];
        var it = items[i];
        if (!it) { seg.style.display = 'none'; continue; }
        seg.style.display = '';

        var frac = total ? (Number(it.days) || 0) / total : 0;
        var dash = Math.max(frac * C - PAD, 0.6);
        var gap = C - dash;

        if (it.color) seg.setAttribute('stroke', it.color);
        seg.style.setProperty('--dash', dash.toFixed(2));
        seg.style.setProperty('--gap', gap.toFixed(2));
        seg.setAttribute('stroke-dasharray', dash.toFixed(2) + ' ' + gap.toFixed(2));
        seg.setAttribute('stroke-dashoffset', (-acc).toFixed(2));

        acc += frac * C;
    }

    /* restart sweep animation */
    svg.classList.remove('animate');
    void svg.getBoundingClientRect(); /* force reflow */
    svg.classList.add('animate');
}

function applyLeaves(items) {
    if (!items || !items.length) return;
    renderSidebarBalance(items);
    renderLegend(items);
    updateDonut(items);
}

async function loadLeaves() {
    if (DEMO) return;
    var empId = EMP ? EMP.id : null;
    if (!empId) return;

    var res = await sb.from(CONFIG.tables.leaveRequests)
        .select('leave_type, days')
        .eq('employee_id', empId);

    if (res.error) { console.error('[HRMS] Leaves:', res.error.message); return; }

    /* Aggregate approved leave per type.
       If you keep balances in a dedicated table, select from that instead. */
    var order = [], map = {};
    (res.data || []).forEach(function (row) {
        var key = row.leave_type || 'Leave';
        if (!(key in map)) { map[key] = 0; order.push(key); }
        map[key] += Number(row.days) || 0;
    });

    if (!order.length) return;
    applyLeaves(order.slice(0, 4).map(function (name, i) {
        return { name: name, days: map[name], color: LEAVE_COLORS[i % 4] };
    }));
}

/* ============================================================
   8. HOLIDAYS
   ============================================================ */

function renderHolidays(list) {
    var wrap = byId('holidayList');
    if (!wrap || !list) return;

    if (!list.length) {
        wrap.innerHTML = '<p style="color:var(--text-3);font-size:13px;padding:8px 2px;">' +
            'No upcoming holidays.</p>';
        return;
    }

    wrap.innerHTML = list.map(function (h) {
        var d = daysUntil(h.date);
        var chip = d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : 'In ' + d + ' days';
        return '<div class="holiday-row">' +
            '<span class="icon-chip c-green"><i data-lucide="calendar-check"></i></span>' +
            '<div class="h-info"><b>' + esc(h.name) + '</b>' +
            '<small>' + esc(humanDate(h.date)) + '</small></div>' +
            '<span class="h-chip">' + esc(chip) + '</span>' +
            '</div>';
    }).join('');

    refreshIcons();
}

async function loadHolidays() {
    if (DEMO) return;

    var res = await sb.from(CONFIG.tables.holidays)
        .select('*')
        .gte('date', todayISO())
        .order('date', { ascending: true })
        .limit(CONFIG.limits.holidays);

    if (res.error) { console.error('[HRMS] Holidays:', res.error.message); return; }
    renderHolidays(res.data || []);
}

/* ============================================================
   9. ANNOUNCEMENTS + ACTIVITY FEEDS
   ============================================================ */

var ANN_ICONS = {
    info:     ['megaphone', 'c-blue'],
    policy:   ['shield-check', 'c-green'],
    birthday: ['gift', 'c-orange'],
    event:    ['calendar-days', 'c-purple']
};

var ACT_ICONS = {
    leave:    ['check', 'c-green'],
    payslip:  ['file-text', 'c-blue'],
    overtime: ['clock', 'c-orange'],
    task:     ['check', 'c-purple']
};

function renderAnnouncements(list) {
    var wrap = byId('announcementList');
    if (!wrap || !list) return;

    if (!list.length) {
        wrap.innerHTML = '<p style="color:var(--text-3);font-size:13px;padding:8px 2px;">' +
            'No announcements yet.</p>';
        return;
    }

    wrap.innerHTML = list.map(function (a) {
        var ic = ANN_ICONS[a.type] || ANN_ICONS.info;
        return '<div class="feed-item">' +
            '<span class="icon-chip ' + ic[1] + '"><i data-lucide="' + ic[0] + '"></i></span>' +
            '<div class="feed-info"><b>' + esc(a.title) + '</b>' +
            '<p>' + esc(a.body || '') + '</p></div>' +
            '<small class="feed-time">' + esc(humanDate(a.created_at)) + '</small>' +
            '</div>';
    }).join('');

    refreshIcons();
}

function renderActivity(list) {
    var wrap = byId('activityList');
    if (!wrap || !list) return;

    if (!list.length) {
        wrap.innerHTML = '<p style="color:var(--text-3);font-size:13px;padding:8px 2px;">' +
            'No recent activity.</p>';
        return;
    }

    wrap.innerHTML = list.map(function (a) {
        var ic = ACT_ICONS[a.type] || ACT_ICONS.leave;
        return '<div class="feed-item">' +
            '<span class="icon-chip ' + ic[1] + '"><i data-lucide="' + ic[0] + '"></i></span>' +
            '<div class="feed-info"><p>' + esc(a.message) + '</p></div>' +
            '<small class="feed-time">' + esc(timeAgo(a.created_at)) + '</small>' +
            '</div>';
    }).join('');

    refreshIcons();
}

async function loadFeeds() {
    if (DEMO) return;
    var T = CONFIG.tables;
    var empId = EMP ? EMP.id : null;

    var ann = sb.from(T.announcements)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(CONFIG.limits.announcements)
        .then(function (res) {
            if (res.error) throw res.error;
            renderAnnouncements(res.data || []);
        });

    var act = sb.from(T.activities)
        .select('*')
        .eq('employee_id', empId)
        .order('created_at', { ascending: false })
        .limit(CONFIG.limits.activity)
        .then(function (res) {
            if (res.error) throw res.error;
            renderActivity(res.data || []);
        });

    var both = await Promise.allSettled([ann, act]);
    both.forEach(function (p, i) {
        if (p.status === 'rejected') {
            console.error('[HRMS] Feed ' + (i ? 'activity' : 'announcements') + ':', p.reason.message || p.reason);
        }
    });
}

/* ============================================================
   10. NOTIFICATION BADGES
   ============================================================ */

async function loadBadges() {
    if (DEMO || !USER) return;
    var T = CONFIG.tables;

    async function count(table) {
        var res = await sb.from(table)
            .select('*', { count: 'exact', head: true })
            .eq('user_id', USER.id)
            .eq('read', false);
        return res.error ? null : (res.count || 0);
    }

    var notif = await count(T.notifications);
    var msgs  = await count(T.messages);

    function paint(id, n) {
        var el = byId(id);
        if (!el) return;
        if (n == null) return;          /* query failed — keep static value */
        el.textContent = n;
        el.classList.toggle('hidden', n === 0);
    }

    paint('notifCount', notif);
    paint('msgCount', msgs);
}

/* ============================================================
   11. UI BINDINGS (search shortcut, punch buttons, logout)
   ============================================================ */

function bindUI() {

    /* Ctrl + / focuses global search */
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            var input = byId('globalSearch');
            if (input) {
                e.preventDefault();
                input.focus();
                input.select();
            }
        }
    });

    /* Punch buttons */
    var inBtn = byId('checkInBtn'), outBtn = byId('checkOutBtn');
    if (inBtn) inBtn.addEventListener('click', function () {
        DEMO ? demoPunch('in') : punchIn();
    });
    if (outBtn) outBtn.addEventListener('click', function () {
        DEMO ? demoPunch('out') : punchOut();
    });

    /* Logout */
    var logoutBtn = byId('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', function () {
        if (DEMO) {
            console.info('[HRMS] Demo mode — logout would redirect to ' + CONFIG.loginUrl);
            return;
        }
        logout();
    });
}

/* ============================================================
   12. BOOT
   ============================================================ */

async function boot() {
    bindUI();

    if (DEMO) {
        console.info(
            '%c[HRMS] Demo mode%c — add your Supabase URL + anon key in dashboard.js CONFIG to go live.',
            'background:#0D6EFD;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700', ''
        );
        return;
    }

    try {
        await requireAuth();
        await loadProfile();
        await Promise.allSettled([
            loadTodayAttendance(),
            loadStats(),
            loadLeaves(),
            loadHolidays(),
            loadFeeds(),
            loadBadges()
        ]);
    } catch (e) {
        if (!/Not signed in/.test(String(e && e.message))) {
            console.error('[HRMS] Boot error:', e);
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}

/* ============================================================
   13. PUBLIC API (debugging / external hooks)
   ============================================================ */

window.HRMS = {
    config: CONFIG,
    demo: DEMO,
    refresh: function () {
        if (DEMO) return Promise.resolve();
        return Promise.allSettled([
            loadProfile(), loadTodayAttendance(), loadStats(),
            loadLeaves(), loadHolidays(), loadFeeds(), loadBadges()
        ]);
    },
    /* Handy for custom integrations: HRMS.applyLeaves([{name:'Casual',days:12},...]) */
    applyLeaves: applyLeaves,
    applyAttendance: applyAttendance
};

})();
