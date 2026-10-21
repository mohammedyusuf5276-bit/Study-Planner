/**
 * StudyFlow - Smart Study Planner & Time Management Engine
 * Pure Vanilla JavaScript: Task Management, Pomodoro Engine, Web Audio,
 * Analytics & per-user Neon Postgres storage
 */

(() => {
  'use strict';

  // ================= State & Data Model =================
  const DEFAULT_DATA = {
    subjects: [
      { id: 'sub_frontend', name: 'FRONTEND', target_weekly_hours: 8.0, color: '#3b82f6' }
    ],
    tasks: [
      {
        id: 't_fe_1',
        title: 'Build Responsive CSS Flexbox & Grid Dashboard',
        subject: 'FRONTEND',
        due_date: getRelativeDate(2),
        estimated_hours: 3.0,
        actual_hours: 1.0,
        priority: 'High',
        status: 'In Progress',
        notes: 'Modern responsive layout, CSS variables, and clean components.'
      }
    ],
    sessions: [],
    daily_goals: {
      [getTodayDate()]: { target_hours: 3.0 }
    }
  };

  let store = { ...DEFAULT_DATA };
  let activeUser = null;

  // Timer Runtime State
  let timerInterval = null;
  let timerMode = 'focus-60'; // focus blocks are at least 60 minutes; break modes are separate
  let timerDurationSeconds = 60 * 60;
  let timerSecondsLeft = 60 * 60;
  let stopwatchSeconds = 0;
  let timerRunning = false;
  let selectedFocusRating = 5;
  let timerStudiedSeconds = 0;
  let timerSessionStarted = false;
  let tabSwitchCount = 0;

  // View States
  let activeTab = 'tab-dashboard';
  let isEisenhowerView = false;
  let attendanceMonth = new Date();

  // ================= Utility Functions =================
  function getTodayDate() {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  function getRelativeDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }

  function getLocalDateTimeValue(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function getLocalDateValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function shiftDate(dateString, days) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    return getLocalDateValue(date);
  }

  function getDeadlineDaysRemaining(dateString) {
    const due = new Date(`${dateString}T00:00:00`);
    const today = new Date(`${getTodayDate()}T00:00:00`);
    return Math.round((due - today) / 86400000);
  }

  const attendanceTimerTypes = new Set(['focus-60', 'focus-90', 'focus-120', 'stopwatch', 'pomodoro', 'deep']);

  function getQualifiedAttendanceMinutes(date) {
    return (store.sessions || []).reduce((total, session) => {
      const minutes = Number(session.duration_minutes) || 0;
      return session.date === date && attendanceTimerTypes.has(session.type) && minutes >= 60 ? total + minutes : total;
    }, 0);
  }

  function getAttendanceDates() {
    const minutesByDate = new Map();
    (store.sessions || []).forEach(session => {
      const minutes = Number(session.duration_minutes) || 0;
      if (attendanceTimerTypes.has(session.type) && session.date && minutes >= 60) minutesByDate.set(session.date, (minutesByDate.get(session.date) || 0) + minutes);
    });
    return new Set([...minutesByDate.entries()].filter(([, minutes]) => minutes >= 60).map(([date]) => date));
  }

  function generateId(prefix = 'id') {
    return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
  }

  function decodeCalendarText(value) {
    return value.replace(/\\[nN]/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
  }

  function parseLmsCalendar(text) {
    const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
    const entries = [];
    let entry = null;
    lines.forEach(line => {
      if (/^BEGIN:(VEVENT|VTODO)$/i.test(line)) entry = {};
      else if (/^END:(VEVENT|VTODO)$/i.test(line)) {
        if (entry) entries.push(entry);
        entry = null;
      } else if (entry) {
        const match = line.match(/^([A-Z-]+)(?:;[^:]*)?:(.*)$/i);
        if (match) entry[match[1].toUpperCase()] = match[2];
      }
    });
    return entries.map(entry => ({
      id: decodeCalendarText(entry.UID || ''),
      title: decodeCalendarText(entry.SUMMARY || entry.DESCRIPTION || ''),
      subject: decodeCalendarText(entry.CATEGORIES || ''),
      dueDate: (entry.DUE || entry.DTSTART || '').match(/^\d{4}-?\d{2}-?\d{2}/)?.[0].replace(/-/g, '')
    })).map(item => ({ ...item, dueDate: item.dueDate ? `${item.dueDate.slice(0, 4)}-${item.dueDate.slice(4, 6)}-${item.dueDate.slice(6, 8)}` : '' }));
  }

  function parseLmsCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
      else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); if (row.some(value => value.trim())) rows.push(row);
        row = []; cell = '';
      } else cell += ch;
    }
    row.push(cell); if (row.some(value => value.trim())) rows.push(row);
    if (rows.length < 2) return [];
    const headers = rows.shift().map(value => value.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const get = (values, names) => {
      const index = headers.findIndex(header => names.includes(header));
      return index < 0 ? '' : (values[index] || '').trim();
    };
    return rows.map(values => {
      const rawDate = get(values, ['duedate', 'due', 'deadline', 'date', 'duedatetime']);
      let dueDate = rawDate.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';
      if (!dueDate && rawDate) {
        const parsedDate = new Date(rawDate);
        if (!Number.isNaN(parsedDate.getTime())) dueDate = getLocalDateValue(parsedDate);
      }
      return {
        id: get(values, ['id', 'uid', 'assignmentid']),
        title: get(values, ['title', 'name', 'assignment', 'assignmentname', 'summary']),
        subject: get(values, ['subject', 'course', 'classname', 'category']),
        dueDate
      };
    });
  }

  async function importLmsDeadlineFile(file) {
    const text = await file.text();
    const imported = file.name.toLowerCase().endsWith('.ics') || /BEGIN:VCALENDAR/i.test(text)
      ? parseLmsCalendar(text)
      : parseLmsCsv(text);
    const subjectNames = (store.subjects || []).map(subject => subject.name);
    let added = 0;
    let updated = 0;
    store.tasks = store.tasks || [];
    imported.forEach(item => {
      if (!item.title || !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) return;
      const sourceId = item.id || `${item.title.toLowerCase()}|${item.subject.toLowerCase()}`;
      const subject = subjectNames.find(name => name.toLowerCase() === item.subject.toLowerCase()) || subjectNames[0] || 'General';
      const existing = store.tasks.find(task => ['lms', 'polaris'].includes(task.source) && task.external_id === sourceId);
      if (existing) {
        if (existing.title !== item.title || existing.due_date !== item.dueDate || existing.subject !== subject) {
          existing.title = item.title;
          existing.due_date = item.dueDate;
          existing.subject = subject;
          updated++;
        }
        return;
      }
      store.tasks.push({
        id: generateId('polaris'), title: item.title, subject, due_date: item.dueDate,
        estimated_hours: 1.0, actual_hours: 0, priority: 'Medium', status: 'Pending',
        notes: `Imported from ${store.lms_connection?.platform || 'college LMS'}${item.subject ? ` · ${item.subject}` : ''}`,
        source: 'lms', external_id: sourceId
      });
      added++;
    });
    if (added || updated) {
      await saveData();
      renderAll();
    }
    return { added, updated, read: imported.length };
  }

  // ================= Web Audio API Chime =================
  function playCompletionChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const playTone = (freq, start, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      // Two-tone soothing chime
      playTone(587.33, 0, 0.4);      // D5
      playTone(880.00, 0.25, 0.8);   // A5
    } catch (e) {
      console.warn('Web Audio not accessible:', e);
    }
  }

  // ================= Storage Synchronization =================
  async function loadData() {
    const response = await fetch('/api/data', { credentials: 'same-origin' });
    if (!response.ok) throw new Error((await response.json()).error || 'Could not load saved progress.');
    const result = await response.json();
    if (result.data && Array.isArray(result.data.subjects)) {
      store = { ...DEFAULT_DATA, ...result.data };
      // Remove legacy starter examples from saved accounts while preserving user-created data.
      const legacyDemoSessionIds = new Set(['s_1', 's_2']);
      const legacyDemoSubjectIds = new Set(['sub_dsa', 'sub_icp', 'sub_maths']);
      const legacyDemoTaskIds = new Set(['t_dsa_1', 't_icp_1', 't_maths_1']);
      const savedSessions = store.sessions || [];
      const savedSubjects = store.subjects || [];
      const savedTasks = store.tasks || [];
      store.sessions = savedSessions.filter(session => !legacyDemoSessionIds.has(session.id));
      store.subjects = savedSubjects.filter(subject => !legacyDemoSubjectIds.has(subject.id));
      store.tasks = savedTasks.filter(task => !legacyDemoTaskIds.has(task.id));
      if (store.sessions.length !== savedSessions.length || store.subjects.length !== savedSubjects.length || store.tasks.length !== savedTasks.length) {
        await saveData();
      }
    } else {
      store = structuredClone(DEFAULT_DATA);
      await saveData();
    }
  }

  async function saveData() {
    if (!activeUser) return;
    try {
      const response = await fetch('/api/data', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store)
      });
      if (!response.ok) console.error('Could not sync StudyFlow data:', (await response.json()).error);
    } catch (error) {
      console.error('Could not sync StudyFlow data:', error.message);
    }
  }

  // ================= Metrics & Time Calculations =================
  function calculateHoursToday() {
    const today = getTodayDate();
    const todaySessions = (store.sessions || []).filter(s => s.date === today);
    const mins = todaySessions.reduce((acc, cur) => acc + (Number(cur.duration_minutes) || 0), 0);
    return Math.round((mins / 60) * 10) / 10;
  }

  function calculateWeekHours() {
    const now = new Date();
    // Monday of current week
    const dayOfWeek = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const weekSessions = (store.sessions || []).filter(s => {
      const sDate = new Date(s.date + 'T00:00:00');
      return sDate >= monday;
    });

    const mins = weekSessions.reduce((acc, cur) => acc + (Number(cur.duration_minutes) || 0), 0);
    return Math.round((mins / 60) * 10) / 10;
  }

  function calculateStreak() {
    const attended = getAttendanceDates();
    const ordered = [...attended].sort();
    let longest = 0;
    let run = 0;
    let previous = null;
    ordered.forEach(date => {
      run = previous && shiftDate(previous, 1) === date ? run + 1 : 1;
      longest = Math.max(longest, run);
      previous = date;
    });
    const today = getTodayDate();
    let cursor = attended.has(today) ? today : (attended.has(shiftDate(today, -1)) ? shiftDate(today, -1) : null);
    let current = 0;
    while (cursor && attended.has(cursor)) {
      current++;
      cursor = shiftDate(cursor, -1);
    }
    return { current, longest };
  }

  function calculateEfficiency() {
    const sessions = store.sessions || [];
    if (sessions.length === 0) return { score: 0, avgFocus: 0 };

    const todayHours = calculateHoursToday();
    const todayGoal = (store.daily_goals && store.daily_goals[getTodayDate()]) ? store.daily_goals[getTodayDate()].target_hours : 3.0;
    const goalRatio = Math.min(1.0, todayHours / todayGoal);

    // Focus average
    const avgFocus = sessions.reduce((acc, s) => acc + (Number(s.focus_score) || 5), 0) / sessions.length;

    const streak = calculateStreak().current;
    const streakBonus = Math.min(20, streak * 5);
    const focusScore = (avgFocus / 5.0) * 40;
    const goalScore = goalRatio * 40;

    const efficiency = Math.round(streakBonus + focusScore + goalScore);
    return {
      score: Math.min(100, Math.max(0, efficiency)),
      avgFocus: Math.round(avgFocus * 10) / 10
    };
  }

  // ================= Smart Coaching Tips =================
  function generateRecommendations() {
    const tips = [];
    const todayHours = calculateHoursToday();
    const todayGoal = (store.daily_goals && store.daily_goals[getTodayDate()]) ? store.daily_goals[getTodayDate()].target_hours : 3.0;
    const overdueTasks = (store.tasks || []).filter(t => t.status !== 'Completed' && t.due_date < getTodayDate());
    const upcomingTasks = (store.tasks || []).filter(t => t.status !== 'Completed' && t.due_date >= getTodayDate()).sort((a,b) => a.due_date.localeCompare(b.due_date));
    const closeDeadline = upcomingTasks.find(task => getDeadlineDaysRemaining(task.due_date) <= 3);

    // 1. Goal Pacing
    if (todayHours < todayGoal) {
      const rem = Math.round((todayGoal - todayHours) * 10) / 10;
      tips.push({
        icon: '⏱️',
        text: `You have <strong>${rem} hours</strong> remaining to achieve your daily target (${todayGoal}h). Try a 60m focus session now!`
      });
    } else {
      tips.push({
        icon: '🎯',
        text: `Fantastic discipline! You met today's study target (<strong>${todayHours}h / ${todayGoal}h</strong>). Take time to recharge.`
      });
    }

    // 2. Urgent / Overdue Tasks
    if (overdueTasks.length > 0) {
      tips.push({
        icon: '⚠️',
        text: `Overdue alert: "<strong>${escapeHtml(overdueTasks[0].title)}</strong>" in ${escapeHtml(overdueTasks[0].subject)} is past due. Prioritize this today!`
      });
    } else if (closeDeadline) {
      const daysLeft = getDeadlineDaysRemaining(closeDeadline.due_date);
      tips.push({
        icon: '⚠️',
        text: `Deadline warning: "<strong>${escapeHtml(closeDeadline.title)}</strong>" in ${escapeHtml(closeDeadline.subject)} is ${daysLeft === 0 ? 'due today' : `due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}. Plan time for it now.`
      });
    } else if (upcomingTasks.length > 0) {
      tips.push({
        icon: '⚡',
        text: `Next priority: "<strong>${escapeHtml(upcomingTasks[0].title)}</strong>" is due on ${upcomingTasks[0].due_date}. Estimated time: ${upcomingTasks[0].estimated_hours}h.`
      });
    }

    // 3. Subject Distribution Balance
    const weekHours = calculateWeekHours();
    const subTotals = {};
    (store.subjects || []).forEach(s => { subTotals[s.name] = 0; });
    (store.sessions || []).forEach(s => {
      if (subTotals[s.subject] !== undefined) {
        subTotals[s.subject] += (Number(s.duration_minutes) || 0) / 60;
      }
    });

    const neglected = (store.subjects || []).filter(s => {
      const spent = subTotals[s.name] || 0;
      return (spent / s.target_weekly_hours) < 0.3;
    });

    if (neglected.length > 0) {
      tips.push({
        icon: '📚',
        text: `Subject balance: <strong>${escapeHtml(neglected[0].name)}</strong> is under 30% of its weekly target. Consider booking your next study block here.`
      });
    } else {
      tips.push({
        icon: '✨',
        text: `Balanced study spread! Consistent small sessions beat last-minute cramming every single time.`
      });
    }

    return tips;
  }

  // ================= UI Renderers =================

  function renderHeaderMetrics() {
    const streak = calculateStreak();
    const todayHours = calculateHoursToday();
    const todayGoal = (store.daily_goals && store.daily_goals[getTodayDate()]) ? store.daily_goals[getTodayDate()].target_hours : 3.0;
    const eff = calculateEfficiency();

    document.getElementById('headerStreak').textContent = `${streak.current} Days`;
    document.getElementById('headerTodayHours').textContent = `${todayHours}h / ${todayGoal}h`;
    document.getElementById('headerEfficiency').textContent = `${eff.score}/100`;
  }

  function renderDashboard() {
    const todayHours = calculateHoursToday();
    const todayGoal = (store.daily_goals && store.daily_goals[getTodayDate()]) ? store.daily_goals[getTodayDate()].target_hours : 3.0;
    const todayPct = Math.min(100, Math.round((todayHours / todayGoal) * 100));

    document.getElementById('dashTodayHours').innerHTML = `${todayHours}<span class="stat-unit stat-unit-light">h</span>`;
    document.getElementById('dashTodayPct').textContent = `${todayPct}%`;
    document.getElementById('dashTodayBar').style.width = `${todayPct}%`;
    document.getElementById('dashTodayTarget').textContent = `Target: ${todayGoal} hours`;

    // Week metrics
    const weekHours = calculateWeekHours();
    const weeklyTarget = (store.subjects || []).reduce((acc, s) => acc + (Number(s.target_weekly_hours) || 0), 0);
    const weekPct = weeklyTarget > 0 ? Math.min(100, Math.round((weekHours / weeklyTarget) * 100)) : 0;

    document.getElementById('dashWeekHours').innerHTML = `${weekHours}<span class="stat-unit stat-unit-light">h</span>`;
    document.getElementById('dashWeekPct').textContent = `${weekPct}%`;
    document.getElementById('dashWeekBar').style.width = `${weekPct}%`;
    document.getElementById('dashWeekTarget').textContent = `Weekly Target: ${weeklyTarget} hours`;

    // Efficiency
    const eff = calculateEfficiency();
    document.getElementById('dashEffScore').innerHTML = `${eff.score}<span class="stat-unit stat-unit-light">/100</span>`;
    document.getElementById('dashEffBar').style.width = `${eff.score}%`;

    // Helper: Dynamic Color Theme (Bright Red if <50%, Rich Green if >=50%)
    function applyDynamicCardTheme(cardId, percentage) {
      const card = document.getElementById(cardId);
      if (!card) return;
      if (percentage < 50) {
        card.classList.remove('theme-card-green');
        card.classList.add('theme-card-red');
      } else {
        card.classList.remove('theme-card-red');
        card.classList.add('theme-card-green');
      }
    }

    // Apply color logic to Today's Study, Weekly Target, and Efficiency
    applyDynamicCardTheme('cardTodayStudy', todayPct);
    applyDynamicCardTheme('cardWeekTarget', weekPct);
    applyDynamicCardTheme('cardEfficiency', eff.score);

    const effRatingEl = document.getElementById('dashEffRating');
    if (effRatingEl) {
      effRatingEl.textContent = eff.score >= 50 ? 'HIGH' : 'LOW';
    }

    const streak = calculateStreak();
    document.getElementById('dashStreakVal').innerHTML = `🔥 ${streak.current}<span class="stat-unit stat-unit-light">days</span>`;
    document.getElementById('dashBestStreak').textContent = `Best Record: ${streak.longest} days`;
    const streakBadge = document.getElementById('dashStreakBadge');
    if (streakBadge) {
      streakBadge.textContent = getAttendanceDates().has(getTodayDate()) ? 'ATTENDED' : 'CHECK IN';
    }

    // Recommendations list
    const recContainer = document.getElementById('recommendationsList');
    const recs = generateRecommendations();
    recContainer.innerHTML = recs.map(r => `
      <div class="recommendation-item">
        <span class="rec-icon">${r.icon}</span>
        <div>${r.text}</div>
      </div>
    `).join('');

    // Upcoming quick tasks list
    const quickContainer = document.getElementById('quickUpcomingTasks');
    const upcoming = (store.tasks || [])
      .filter(t => t.status !== 'Completed')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5);

    if (upcoming.length === 0) {
      quickContainer.innerHTML = `<div class="empty-state" style="padding: 1rem;"><p>No pending deadlines! You're all caught up. 🎉</p></div>`;
    } else {
      quickContainer.innerHTML = upcoming.map(t => {
        const isOverdue = t.due_date < getTodayDate();
        const daysLeft = getDeadlineDaysRemaining(t.due_date);
        const isClose = !isOverdue && daysLeft <= 3;
        const deadlineLabel = isOverdue ? 'OVERDUE' : daysLeft === 0 ? 'DUE TODAY' : isClose ? `DUE IN ${daysLeft}D` : t.due_date;
        return `
          <div class="quick-task-row">
            <div>
              <div class="quick-task-title">${escapeHtml(t.title)}</div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(t.subject)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span class="badge ${isOverdue || isClose ? 'badge-red' : 'badge-count'}" title="Deadline: ${t.due_date}">${deadlineLabel}</span>
              <button class="btn btn-sm btn-outline quick-start-btn" data-sub="${escapeHtml(t.subject)}" data-task="${t.id}" title="Study now">⏱️</button>
            </div>
          </div>
        `;
      }).join('');

      // Wire quick timer launch buttons
      quickContainer.querySelectorAll('.quick-start-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const sub = btn.getAttribute('data-sub');
          const taskId = btn.getAttribute('data-task');
          switchTab('tab-timer');
          document.getElementById('timerSubjectSelect').value = sub;
          document.getElementById('timerTaskSelect').value = taskId;
        });
      });
    }
  }

  // ================= Study Planner & Tasks Renderer =================
  function renderPlanner() {
    // Populate subject filter
    const subFilter = document.getElementById('filterSubjectSelect');
    const currentSub = subFilter.value;
    subFilter.innerHTML = '<option value="ALL">All Subjects</option>' +
      (store.subjects || []).map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
    subFilter.value = currentSub || 'ALL';

    // Filters
    const query = (document.getElementById('taskSearchInput').value || '').toLowerCase();
    const filterSub = subFilter.value;
    const filterStatus = document.getElementById('filterStatusSelect').value;
    const filterPriority = document.getElementById('filterPrioritySelect').value;

    let filtered = (store.tasks || []).filter(t => {
      if (filterSub !== 'ALL' && t.subject !== filterSub) return false;
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
      if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
      if (query && !t.title.toLowerCase().includes(query) && !t.notes.toLowerCase().includes(query)) return false;
      return true;
    });

    const tbody = document.getElementById('tasksTableBody');
    const emptyState = document.getElementById('tasksEmptyState');

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      tbody.innerHTML = filtered.map(t => {
        const isDone = t.status === 'Completed';
        const isOverdue = !isDone && t.due_date < getTodayDate();
        const daysLeft = getDeadlineDaysRemaining(t.due_date);
        const isClose = !isDone && !isOverdue && daysLeft <= 3;
        const prioBadge = t.priority === 'High' ? 'badge-red' : (t.priority === 'Medium' ? 'badge-orange' : 'badge-primary');
        const statusClass = isDone ? 'status-completed' : (t.status === 'In Progress' ? 'status-in-progress' : 'status-pending');

        return `
          <tr>
            <td>
              <input type="checkbox" class="task-check" data-id="${t.id}" ${isDone ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
            </td>
            <td>
              <div class="task-title-cell ${isDone ? 'line-through' : ''}">${escapeHtml(t.title)}</div>
              ${t.notes ? `<span class="task-notes-hint">${escapeHtml(t.notes)}</span>` : ''}
            </td>
            <td><span class="badge badge-count">${escapeHtml(t.subject)}</span></td>
            <td>
              ${t.due_date}
              ${isOverdue ? '<span class="overdue-flag">OVERDUE</span>' : ''}
              ${isClose ? `<span class="overdue-flag">${daysLeft === 0 ? 'DUE TODAY' : `DUE IN ${daysLeft}D`}</span>` : ''}
            </td>
            <td><span class="badge ${prioBadge}">${t.priority}</span></td>
            <td><span class="status-badge ${statusClass}">${t.status}</span></td>
            <td><strong>${t.actual_hours}h</strong> / ${t.estimated_hours}h</td>
            <td>
              <div style="display: flex; gap: 0.3rem;">
                <button class="btn btn-sm btn-outline edit-task-btn" data-id="${t.id}" title="Edit">✏️</button>
                <button class="btn btn-sm btn-danger-outline delete-task-btn" data-id="${t.id}" title="Delete">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Wire checkboxes
      tbody.querySelectorAll('.task-check').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const id = e.target.getAttribute('data-id');
          toggleTaskCompleted(id, e.target.checked);
        });
      });

      // Wire edit and delete
      tbody.querySelectorAll('.edit-task-btn').forEach(btn => {
        btn.addEventListener('click', () => openTaskModal(btn.getAttribute('data-id')));
      });
      tbody.querySelectorAll('.delete-task-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteTask(btn.getAttribute('data-id')));
      });
    }

    // Render Eisenhower Matrix
    renderEisenhowerMatrix();
  }

  function renderEisenhowerMatrix() {
    const today = getTodayDate();
    const urgentThreshold = getRelativeDate(3);

    const q1 = [];
    const q2 = [];
    const q3 = [];
    const q4 = [];

    (store.tasks || []).filter(t => t.status !== 'Completed').forEach(t => {
      const isUrgent = t.due_date <= urgentThreshold;
      const isImportant = t.priority === 'High' || t.priority === 'Medium';

      if (isUrgent && isImportant) q1.push(t);
      else if (!isUrgent && isImportant) q2.push(t);
      else if (isUrgent && !isImportant) q3.push(t);
      else q4.push(t);
    });

    document.getElementById('q1Count').textContent = q1.length;
    document.getElementById('q2Count').textContent = q2.length;
    document.getElementById('q3Count').textContent = q3.length;
    document.getElementById('q4Count').textContent = q4.length;

    const renderCardList = (list) => {
      if (list.length === 0) return '<div style="color: var(--text-muted); font-size: 0.8rem; padding: 0.5rem 0;">No tasks</div>';
      return list.map(t => `
        <div class="matrix-task-item">
          <div>
            <strong>${escapeHtml(t.title)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(t.subject)} • Due: ${t.due_date}</div>
          </div>
          <button class="btn btn-sm btn-outline matrix-start-btn" data-sub="${escapeHtml(t.subject)}" data-task="${t.id}" title="Focus now">⏱️</button>
        </div>
      `).join('');
    };

    document.getElementById('q1TaskList').innerHTML = renderCardList(q1);
    document.getElementById('q2TaskList').innerHTML = renderCardList(q2);
    document.getElementById('q3TaskList').innerHTML = renderCardList(q3);
    document.getElementById('q4TaskList').innerHTML = renderCardList(q4);

    document.querySelectorAll('.matrix-start-btn').forEach(b => {
      b.addEventListener('click', () => {
        const sub = b.getAttribute('data-sub');
        const taskId = b.getAttribute('data-task');
        switchTab('tab-timer');
        document.getElementById('timerSubjectSelect').value = sub;
        document.getElementById('timerTaskSelect').value = taskId;
      });
    });
  }

  // ================= Timer View & Controller =================
  function setupTimerSelects() {
    const subSelect = document.getElementById('timerSubjectSelect');
    const taskSelect = document.getElementById('timerTaskSelect');
    const manualSubSelect = document.getElementById('manualSubSelect');

    const subOptions = (store.subjects || []).map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
    subSelect.innerHTML = subOptions;
    manualSubSelect.innerHTML = subOptions;
    document.getElementById('materialSubject').innerHTML = subOptions;
    document.getElementById('studyNoteSubject').innerHTML = '<option value="">General</option>' + subOptions;
    document.getElementById('notesSubjectFilter').innerHTML = '<option value="ALL">All Subjects</option><option value="">General</option>' + subOptions;

    // Populate task select based on selected subject
    const updateTasksForSubject = () => {
      const chosenSub = subSelect.value;
      const relevantTasks = (store.tasks || []).filter(t => t.status !== 'Completed' && t.subject === chosenSub);
      taskSelect.innerHTML = '<option value="">General Review (No specific task)</option>' +
        relevantTasks.map(t => `<option value="${t.id}">${escapeHtml(t.title)} (${t.estimated_hours}h)</option>`).join('');
    };

    subSelect.onchange = updateTasksForSubject;
    updateTasksForSubject();

    const endTimeInput = document.getElementById('manualEndTimeInput');
    const endTime = new Date();
    endTimeInput.value = getLocalDateTimeValue(endTime);
    document.getElementById('manualStartTimeInput').value = getLocalDateTimeValue(new Date(endTime.getTime() - 60 * 60000));
  }

  function updateTimerDisplay() {
    const clock = document.getElementById('timerClock');
    if (timerMode === 'stopwatch') {
      const hrs = Math.floor(stopwatchSeconds / 3600);
      const mins = Math.floor((stopwatchSeconds % 3600) / 60);
      const secs = stopwatchSeconds % 60;
      clock.textContent = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      const mins = Math.floor(timerSecondsLeft / 60);
      const secs = timerSecondsLeft % 60;
      clock.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    timerSessionStarted = true;

    document.getElementById('timerStartBtn').disabled = true;
    document.getElementById('timerPauseBtn').disabled = false;
    document.getElementById('timerCompleteBtn').disabled = false;

    const subject = document.getElementById('timerSubjectSelect').value;
    document.getElementById('timerStatusLabel').textContent = `Focus sprint active for ${subject}... Minimize all tabs!`;

    timerInterval = setInterval(() => {
      if (timerMode === 'stopwatch' || ((timerMode !== 'short-break' && timerMode !== 'long-break') && timerSecondsLeft > 0)) {
        timerStudiedSeconds++;
      }
      if (timerMode === 'stopwatch') {
        stopwatchSeconds++;
        updateTimerDisplay();
      } else {
        if (timerSecondsLeft > 0) {
          timerSecondsLeft--;
          updateTimerDisplay();
        } else {
          // Timer reached 00:00
          pauseTimer();
          if (localStorage.getItem('studyflow_completion_sound') !== 'false') playCompletionChime();
          document.getElementById('timerStatusLabel').textContent = `🔔 Time's up! Exceptional focus sprint!`;
          alert('🔔 Focus session complete! Take a well-deserved hydration break.');
          finishTimerSession();
        }
      }
    }, 1000);
  }

  function pauseTimer() {
    if (!timerRunning) return;
    timerRunning = false;
    clearInterval(timerInterval);
    document.getElementById('timerStartBtn').disabled = false;
    document.getElementById('timerStartBtnText').textContent = 'Resume Focus';
    document.getElementById('timerPauseBtn').disabled = true;
    document.getElementById('timerStatusLabel').textContent = 'Timer paused.';
  }

  function resetTimer() {
    pauseTimer();
    timerStudiedSeconds = 0;
    timerSessionStarted = false;
    tabSwitchCount = 0;
    document.getElementById('timerStartBtnText').textContent = 'Start Focus';
    document.getElementById('timerCompleteBtn').disabled = true;

    if (timerMode === 'stopwatch') {
      stopwatchSeconds = 0;
      document.getElementById('timerStatusLabel').textContent = 'Stopwatch ready.';
    } else {
      timerSecondsLeft = timerDurationSeconds;
      document.getElementById('timerStatusLabel').textContent = 'Ready to focus. Eliminate distractions!';
    }
    updateTimerDisplay();
  }

  function finishTimerSession() {
    pauseTimer();

    const minutesStudied = Math.round((timerStudiedSeconds / 60) * 100) / 100;
    if (minutesStudied <= 0) {
      document.getElementById('timerStatusLabel').textContent = 'No active study time to save yet.';
      return;
    }
    if (timerMode !== 'short-break' && timerMode !== 'long-break' && timerStudiedSeconds < 60 * 60) {
      document.getElementById('timerStatusLabel').textContent = 'Study for at least 60 active minutes before saving this focus session.';
      return;
    }

    const subject = document.getElementById('timerSubjectSelect').value;
    const taskId = document.getElementById('timerTaskSelect').value || null;

    // Create session record
    const newSession = {
      id: generateId('s'),
      subject,
      task_id: taskId,
      duration_minutes: minutesStudied,
      date: getTodayDate(),
      focus_score: selectedFocusRating,
      type: timerMode,
      notes: `Focus session via StudyFlow timer`
    };

    store.sessions = store.sessions || [];
    store.sessions.unshift(newSession);

    // Update actual hours on linked task
    if (taskId) {
      const task = (store.tasks || []).find(t => t.id === taskId);
      if (task) {
        task.actual_hours = Math.round((task.actual_hours + (minutesStudied / 60)) * 10) / 10;
        if (task.status === 'Pending') task.status = 'In Progress';
      }
    }

    saveData();
    resetTimer();
    renderAll();
    alert(`🎉 Awesome! Logged ${minutesStudied} minutes to ${subject}.`);
  }

  function renderMaterials() {
    const list = document.getElementById('materialsList');
    if (!list) return;
    const materials = store.study_materials || [];
    if (!materials.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📖</div><h4>No study material yet</h4><p>Add a useful link or note above to build your library.</p></div>';
      return;
    }
    list.innerHTML = materials.map(item => `<article class="material-item"><div><span class="tag tag-accent">${escapeHtml(item.subject)}</span><h4>${escapeHtml(item.title)}</h4>${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ''}</div><div class="material-actions">${item.url ? `<a class="btn btn-sm btn-outline" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}<button class="btn btn-sm btn-danger-outline" data-delete-material="${escapeHtml(item.id)}">Remove</button></div></article>`).join('');
    list.querySelectorAll('[data-delete-material]').forEach(button => button.addEventListener('click', () => {
      store.study_materials = materials.filter(item => item.id !== button.dataset.deleteMaterial);
      saveData(); renderMaterials();
    }));
  }

  function renderStudyNotes() {
    const list = document.getElementById('studyNotesList');
    if (!list) return;
    const notes = store.study_notes || [];
    const selectedSubject = document.getElementById('notesSubjectFilter').value;
    const visibleNotes = selectedSubject === 'ALL' ? notes : notes.filter(note => (note.subject || '') === selectedSubject);
    if (!visibleNotes.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><h4>${notes.length ? 'No notes for this subject yet' : 'No saved notes yet'}</h4><p>Write a note above and select Save Note.</p></div>`;
      return;
    }
    list.innerHTML = visibleNotes.map(note => `<article class="study-note-item"><div class="study-note-content"><div class="study-note-meta"><h4>${escapeHtml(note.title)}</h4><span class="tag tag-accent">${escapeHtml(note.subject || 'General')}</span></div><p>${escapeHtml(note.body).replace(/\n/g, '<br>')}</p></div><div class="material-actions"><button type="button" class="btn btn-sm btn-outline" data-edit-note="${escapeHtml(note.id)}">Edit</button><button type="button" class="btn btn-sm btn-danger-outline" data-delete-note="${escapeHtml(note.id)}">Delete</button></div></article>`).join('');
    list.querySelectorAll('[data-edit-note]').forEach(button => button.addEventListener('click', () => {
      const note = notes.find(item => item.id === button.dataset.editNote);
      if (!note) return;
      document.getElementById('notesSubjectFilter').value = note.subject || '';
      renderStudyNotes();
      document.getElementById('studyNoteId').value = note.id;
      document.getElementById('studyNoteTitle').value = note.title;
      document.getElementById('studyNoteSubject').value = note.subject || '';
      document.getElementById('studyNoteBody').value = note.body;
      document.getElementById('saveStudyNoteBtn').textContent = 'Save Changes';
      document.getElementById('cancelStudyNoteEditBtn').classList.remove('hidden');
      document.getElementById('studyNoteTitle').focus();
    }));
    list.querySelectorAll('[data-delete-note]').forEach(button => button.addEventListener('click', () => {
      store.study_notes = notes.filter(item => item.id !== button.dataset.deleteNote);
      saveData(); renderStudyNotes();
    }));
  }

  function renderAttendance() {
    const calendar = document.getElementById('attendanceCalendar');
    if (!calendar) return;
    const year = attendanceMonth.getFullYear();
    const month = attendanceMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = (firstDay.getDay() + 6) % 7;
    const attended = getAttendanceDates();
    const today = getTodayDate();
    document.getElementById('attendanceMonthLabel').textContent = attendanceMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    calendar.innerHTML = Array.from({ length: leadingBlanks + daysInMonth }, (_, index) => {
      if (index < leadingBlanks) return '<span class="attendance-day empty" aria-hidden="true"></span>';
      const day = index - leadingBlanks + 1;
      const date = getLocalDateValue(new Date(year, month, day));
      const classes = ['attendance-day', attended.has(date) ? 'attended' : '', date === today ? 'today' : ''].filter(Boolean).join(' ');
      return `<span class="${classes}" aria-label="${date}${attended.has(date) ? ', attended' : ''}">${day}${attended.has(date) ? '<span aria-hidden="true">✓</span>' : ''}</span>`;
    }).join('');
    const attendedThisMonth = [...attended].filter(date => date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}-`)).length;
    const todayMinutes = getQualifiedAttendanceMinutes(today);
    const remainingMinutes = Math.max(0, 60 - todayMinutes);
    document.getElementById('attendanceStatus').textContent = `${attendedThisMonth} day${attendedThisMonth === 1 ? '' : 's'} attended this month. Today: ${Math.min(60, Math.floor(todayMinutes))}/60 minutes studied${remainingMinutes ? `; ${remainingMinutes} more to count attendance` : '; attendance counted'}.`;
    const checkedIn = attended.has(today);
    document.getElementById('attendanceThreshold').textContent = checkedIn ? 'Attendance marked for today' : 'Study 1 hour to mark attendance';
  }

  function renderOfflineLogs() {
    const tbody = document.getElementById('offlineLogsBody');
    if (!tbody) return;
    const logs = (store.sessions || []).filter(session => session.type === 'manual').slice(0, 10);
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty">No offline sessions logged yet.</td></tr>';
      return;
    }
    tbody.innerHTML = logs.map(session => {
      const start = session.started_at ? new Date(session.started_at).toLocaleString() : 'Time not recorded';
      const end = session.ended_at ? new Date(session.ended_at).toLocaleString() : 'Time not recorded';
      return `<tr><td>${escapeHtml(session.subject)}</td><td>${escapeHtml(start)}</td><td>${escapeHtml(end)}</td><td>${(Number(session.duration_minutes || 0) / 60).toFixed(2)} hrs</td></tr>`;
    }).join('');
  }

  // ================= Analytics & Charts Renderer =================
  function renderAnalytics() {
    // 1. 7-Day Visual Bar Chart
    const barChart = document.getElementById('weeklyBarChart');
    const today = new Date();
    const daysData = [];
    let maxHours = 1.0;
    let totalWeekSum = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

      const dayMins = (store.sessions || [])
        .filter(s => s.date === dateStr)
        .reduce((acc, cur) => acc + (Number(cur.duration_minutes) || 0), 0);

      const hours = Math.round((dayMins / 60) * 10) / 10;
      totalWeekSum += hours;
      if (hours > maxHours) maxHours = hours;

      daysData.push({ dayName, dateStr, hours });
    }

    document.getElementById('chartTotalHours').textContent = `Total: ${Math.round(totalWeekSum * 10) / 10} hrs`;

    barChart.innerHTML = daysData.map(d => {
      const heightPct = Math.round((d.hours / maxHours) * 85);
      return `
        <div class="bar-column">
          <span class="bar-val-label">${d.hours > 0 ? `${d.hours}h` : ''}</span>
          <div class="bar-fill ${d.hours === 0 ? 'bar-zero' : ''}" style="height: ${Math.max(6, heightPct)}%;"></div>
          <span class="bar-day-label">${d.dayName}</span>
        </div>
      `;
    }).join('');

    // 2. Subject target progress bars
    const subContainer = document.getElementById('subjectProgressList');
    const subHours = {};
    (store.subjects || []).forEach(s => { subHours[s.name] = 0; });
    (store.sessions || []).forEach(s => {
      if (subHours[s.subject] !== undefined) {
        subHours[s.subject] += (Number(s.duration_minutes) || 0) / 60;
      }
    });

    subContainer.innerHTML = (store.subjects || []).map(s => {
      const spent = Math.round((subHours[s.name] || 0) * 10) / 10;
      const target = s.target_weekly_hours;
      const pct = target > 0 ? Math.min(100, Math.round((spent / target) * 100)) : 0;
      return `
        <div class="subject-item-row">
          <div class="subject-item-header">
            <span>${escapeHtml(s.name)}</span>
            <span class="subject-spent-text">${spent}h / ${target}h (${pct}%)</span>
          </div>
          <div class="subject-track">
            <div class="subject-fill" style="width: ${pct}%; background-color: ${s.color || 'var(--primary)'};"></div>
          </div>
        </div>
      `;
    }).join('');

    const dailyEfficiencyContainer = document.getElementById('dailySubjectEfficiency');
    const todayDate = getTodayDate();
    const dailyEfficiencyRows = (store.subjects || []).map(subject => {
      const sessionsToday = (store.sessions || []).filter(session => session.date === todayDate && session.subject === subject.name);
      const hoursToday = sessionsToday.reduce((total, session) => total + (Number(session.duration_minutes) || 0) / 60, 0);
      const averageFocus = sessionsToday.length
        ? sessionsToday.reduce((total, session) => total + (Number(session.focus_score) || 0), 0) / sessionsToday.length
        : 0;
      const dailyTarget = (Number(subject.target_weekly_hours) || 0) / 7;
      const targetProgress = dailyTarget > 0 ? Math.min(100, (hoursToday / dailyTarget) * 100) : 0;
      const focusPercent = sessionsToday.length ? (averageFocus / 5) * 100 : 0;
      const efficiency = sessionsToday.length ? Math.round((targetProgress + focusPercent) / 2) : 0;
      return `<div class="daily-efficiency-bar-column" title="${escapeHtml(subject.name)}: ${efficiency}% efficiency · ${hoursToday.toFixed(1)}h studied · Focus ${sessionsToday.length ? averageFocus.toFixed(1) : '—'}/5" aria-label="${escapeHtml(subject.name)}, ${efficiency}% efficiency">
        <span class="daily-efficiency-value">${efficiency}%</span>
        <div class="daily-efficiency-bar-stage"><div class="daily-efficiency-bar" style="height:${Math.max(efficiency, 2)}%;background:${subject.color || 'var(--primary)'}"></div></div>
        <span class="daily-efficiency-subject">${escapeHtml(subject.name)}</span>
      </div>`;
    });
    dailyEfficiencyContainer.innerHTML = dailyEfficiencyRows.length
      ? dailyEfficiencyRows.join('')
      : '<div class="empty-state"><p>Add subjects to see daily efficiency.</p></div>';

    // 3. Recent Sessions Table
    const sessionsBody = document.getElementById('sessionsTableBody');
    const recent = (store.sessions || []).slice(0, 10);

    if (recent.length === 0) {
      sessionsBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No study sessions recorded yet. Start a timer or log offline hours!</td></tr>`;
    } else {
      sessionsBody.innerHTML = recent.map(s => {
        const starIcons = '⭐'.repeat(s.focus_score || 5);
        const hoursFormatted = (s.duration_minutes / 60).toFixed(1);
        return `
          <tr>
            <td><strong>${s.date}</strong></td>
            <td><span class="badge badge-count">${escapeHtml(s.subject)}</span></td>
            <td><span class="tag tag-accent">${s.type}</span></td>
            <td>${hoursFormatted}h (${s.duration_minutes}m)</td>
            <td>${starIcons}</td>
            <td>${s.notes ? escapeHtml(s.notes) : '<em style="color: var(--text-muted)">—</em>'}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // ================= Task CRUD Modal =================
  function openTaskModal(taskId = null) {
    const modal = document.getElementById('taskModalOverlay');
    const title = document.getElementById('modalTitle');
    const subSelect = document.getElementById('taskFormSubject');

    subSelect.innerHTML = (store.subjects || []).map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');

    if (taskId) {
      const task = (store.tasks || []).find(t => t.id === taskId);
      if (!task) return;
      title.textContent = '✏️ Edit Academic Task';
      document.getElementById('taskFormId').value = task.id;
      document.getElementById('taskFormTitle').value = task.title;
      subSelect.value = task.subject;
      document.getElementById('taskFormDueDate').value = task.due_date;
      document.getElementById('taskFormEstHours').value = task.estimated_hours;
      document.getElementById('taskFormPriority').value = task.priority;
      document.getElementById('taskFormNotes').value = task.notes || '';
    } else {
      title.textContent = '➕ Add Academic Task';
      document.getElementById('taskFormId').value = '';
      document.getElementById('taskFormTitle').value = '';
      document.getElementById('taskFormDueDate').value = getRelativeDate(2);
      document.getElementById('taskFormEstHours').value = '2.0';
      document.getElementById('taskFormPriority').value = 'Medium';
      document.getElementById('taskFormNotes').value = '';
    }

    modal.classList.remove('hidden');
  }

  function closeTaskModal() {
    document.getElementById('taskModalOverlay').classList.add('hidden');
  }

  function handleSaveTask(e) {
    e.preventDefault();
    const id = document.getElementById('taskFormId').value;
    const title = document.getElementById('taskFormTitle').value.trim();
    const subject = document.getElementById('taskFormSubject').value;
    const dueDate = document.getElementById('taskFormDueDate').value;
    const estHours = parseFloat(document.getElementById('taskFormEstHours').value) || 1.5;
    const priority = document.getElementById('taskFormPriority').value;
    const notes = document.getElementById('taskFormNotes').value.trim();

    if (!title) {
      alert('Please enter a task title.');
      return;
    }

    store.tasks = store.tasks || [];

    if (id) {
      const task = store.tasks.find(t => t.id === id);
      if (task) {
        task.title = title;
        task.subject = subject;
        task.due_date = dueDate;
        task.estimated_hours = estHours;
        task.priority = priority;
        task.notes = notes;
      }
    } else {
      const newTask = {
        id: generateId('t'),
        title,
        subject,
        due_date: dueDate,
        estimated_hours: estHours,
        actual_hours: 0.0,
        priority,
        status: 'Pending',
        notes
      };
      store.tasks.push(newTask);
    }

    saveData();
    closeTaskModal();
    renderAll();
  }

  function toggleTaskCompleted(taskId, completed) {
    const task = (store.tasks || []).find(t => t.id === taskId);
    if (task) {
      task.status = completed ? 'Completed' : 'Pending';
      saveData();
      renderAll();
    }
  }

  function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
      store.tasks = (store.tasks || []).filter(t => t.id !== taskId);
      saveData();
      renderAll();
    }
  }

  // ================= Subject Management Modal =================
  function openSubjectModal() {
    renderSubjectsTable();
    document.getElementById('subjectModalOverlay').classList.remove('hidden');
  }

  function closeSubjectModal() {
    document.getElementById('subjectModalOverlay').classList.add('hidden');
    setupTimerSelects();
    renderAll();
  }

  function renderSubjectsTable() {
    const tbody = document.getElementById('subjectsTableBody');
    tbody.innerHTML = (store.subjects || []).map(s => `
      <tr>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${s.target_weekly_hours} hrs/week</td>
        <td>
          <button class="btn btn-sm btn-danger-outline delete-sub-btn" data-id="${s.id}">Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.delete-sub-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        store.subjects = store.subjects.filter(s => s.id !== id);
        saveData();
        setupTimerSelects();
        renderSubjectsTable();
        renderAll();
      });
    });
  }

  // ================= Navigation & Tabs =================
  function switchTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === tabId);
    });
  }

  function renderAll() {
    renderHeaderMetrics();
    renderDeadlineAnnouncement();
    renderDashboard();
    renderPlanner();
    renderAnalytics();
    renderMaterials();
    renderStudyNotes();
    renderOfflineLogs();
    renderAttendance();
  }

  function renderDeadlineAnnouncement() {
    const announcement = document.getElementById('deadlineAnnouncementBtn');
    if (!announcement) return;
    const dueSoon = (store.tasks || [])
      .filter(task => task.status !== 'Completed' && getDeadlineDaysRemaining(task.due_date) === 2)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    if (!dueSoon.length) {
      announcement.classList.add('hidden');
      announcement.classList.remove('has-announcement');
      announcement.textContent = '';
      announcement.removeAttribute('title');
      announcement.removeAttribute('aria-label');
      return;
    }
    const firstTitle = dueSoon[0].title;
    announcement.textContent = '🔔';
    const details = dueSoon.length === 1
      ? `Assignment due in 2 days: ${firstTitle}`
      : `${dueSoon.length} assignments due in 2 days. First: ${firstTitle}`;
    announcement.title = details;
    announcement.setAttribute('aria-label', `Announcements. ${details}. Open planner.`);
    announcement.classList.add('has-announcement');
    announcement.classList.remove('hidden');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ================= Event Listeners Initialization =================
  function setupEventListeners() {
    const attendanceOverlay = document.getElementById('attendanceModalOverlay');
    const closeAttendance = () => attendanceOverlay.classList.add('hidden');
    const openAttendance = () => {
      attendanceMonth = new Date();
      renderAttendance();
      attendanceOverlay.classList.remove('hidden');
    };
    const streakCard = document.getElementById('streakAttendanceCard');
    streakCard.addEventListener('click', openAttendance);
    streakCard.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openAttendance(); }
    });
    document.getElementById('closeAttendanceBtn').addEventListener('click', closeAttendance);
    attendanceOverlay.addEventListener('click', event => { if (event.target === attendanceOverlay) closeAttendance(); });
    document.getElementById('attendancePrevMonth').addEventListener('click', () => {
      attendanceMonth = new Date(attendanceMonth.getFullYear(), attendanceMonth.getMonth() - 1, 1);
      renderAttendance();
    });
    document.getElementById('attendanceNextMonth').addEventListener('click', () => {
      attendanceMonth = new Date(attendanceMonth.getFullYear(), attendanceMonth.getMonth() + 1, 1);
      renderAttendance();
    });
    const settingsOverlay = document.getElementById('settingsModalOverlay');
    const closeSettings = () => settingsOverlay.classList.add('hidden');
    document.getElementById('openSettingsBtn').addEventListener('click', () => settingsOverlay.classList.remove('hidden'));
    document.getElementById('deadlineAnnouncementBtn').addEventListener('click', () => switchTab('tab-planner'));
    document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
    document.getElementById('doneSettingsBtn').addEventListener('click', closeSettings);
    settingsOverlay.addEventListener('click', event => { if (event.target === settingsOverlay) closeSettings(); });

    const pauseOnLeaveToggle = document.getElementById('pauseOnLeaveToggle');
    pauseOnLeaveToggle.checked = true;
    pauseOnLeaveToggle.disabled = true;
    const readToggle = (id, key) => {
      const control = document.getElementById(id);
      control.checked = localStorage.getItem(key) !== 'false';
      control.addEventListener('change', () => localStorage.setItem(key, String(control.checked)));
      return control;
    };
    const focusWarningToggle = readToggle('focusWarningToggle', 'studyflow_focus_warning');
    readToggle('completionSoundToggle', 'studyflow_completion_sound');
    readToggle('confirmResetToggle', 'studyflow_confirm_reset');
    let focusTabHiddenAt = null;
    let focusAway = false;
    let tabSwitchLimitExceeded = false;
    const returnWarning = document.getElementById('focusReturnWarning');
    document.getElementById('dismissFocusReturnWarning').addEventListener('click', () => returnWarning.classList.add('hidden'));
    const markFocusAway = () => {
      if (focusAway || !timerSessionStarted || timerMode === 'short-break' || timerMode === 'long-break') return;
      focusAway = true;
      focusTabHiddenAt = Date.now();
      tabSwitchCount++;
      if (timerRunning) pauseTimer();
      if (tabSwitchCount > 3) {
        resetTimer();
        tabSwitchLimitExceeded = true;
      }
    };
    const returnToFocus = () => {
      if (focusTabHiddenAt !== null) {
        const awaySeconds = Math.floor((Date.now() - focusTabHiddenAt) / 1000);
        const message = tabSwitchLimitExceeded
          ? 'You switched tabs more than 3 times. The focus timer has been reset; start a new session when you are ready.'
          : awaySeconds >= 60
          ? 'You were away for over a minute. This session would normally be at risk, but your progress is safe and has not been deleted. Resume when you are ready.'
          : 'You switched tabs. Stay focused and return to your study. Your session progress is safe.';
        if (focusWarningToggle.checked) {
          document.getElementById('focusReturnWarningText').textContent = message;
          returnWarning.classList.remove('hidden');
        }
        focusTabHiddenAt = null;
        focusAway = false;
        tabSwitchLimitExceeded = false;
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) markFocusAway();
      else returnToFocus();
    });
    window.addEventListener('blur', markFocusAway);
    window.addEventListener('focus', () => { if (document.visibilityState === 'visible') returnToFocus(); });

    // Navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');
        switchTab(tabId);
        if (tabId === 'tab-admin') loadAdminUsers();
      });
    });
    document.getElementById('refreshAdminUsersBtn')?.addEventListener('click', loadAdminUsers);
    document.getElementById('adminCreateUserForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const name = document.getElementById('adminNewUserName');
      const email = document.getElementById('adminNewUserEmail');
      const status = document.getElementById('adminUsersStatus');
      const notice = document.getElementById('adminPasswordNotice');
      const submit = form.querySelector('button[type="submit"]');
      status.textContent = '';
      notice.classList.add('hidden');
      submit.disabled = true;
      try {
        const response = await fetch('/api/admin', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', displayName: name.value.trim(), email: email.value.trim() })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Account creation failed.');
        form.reset();
        await loadAdminUsers();
        notice.textContent = `Account created for ${result.email}. Generated password: ${result.temporaryPassword} — copy it now and share it securely. It will not be shown again.`;
        notice.classList.remove('hidden');
      } catch (error) {
        status.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });
    document.getElementById('adminUsersTableBody')?.addEventListener('click', async event => {
      const button = event.target.closest('[data-reset-email]');
      if (!button) return;
      const email = button.getAttribute('data-reset-email');
      if (!window.confirm(`Reset the password for ${email}? A new temporary password will be shown once.`)) return;
      button.disabled = true;
      const status = document.getElementById('adminUsersStatus');
      const notice = document.getElementById('adminPasswordNotice');
      notice.classList.add('hidden');
      try {
        const response = await fetch('/api/admin', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset', email })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Password reset failed.');
        notice.textContent = `Temporary password for ${result.email}: ${result.temporaryPassword} — copy it now and share it securely. It will not be shown again.`;
        notice.classList.remove('hidden');
        status.textContent = '';
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });

    document.getElementById('jumpToPlannerBtn').addEventListener('click', () => switchTab('tab-planner'));
    document.getElementById('addAssignmentBtn').addEventListener('click', () => openTaskModal());
    const lmsModal = document.getElementById('lmsModalOverlay');
    const lmsForm = document.getElementById('lmsForm');
    const lmsPlatform = document.getElementById('lmsPlatform');
    const lmsPortalUrl = document.getElementById('lmsPortalUrl');
    const openPortalLink = document.getElementById('openLmsPortalLink');
    const showLmsModal = () => {
      lmsPlatform.value = store.lms_connection?.platform || 'Polaris LMS';
      lmsPortalUrl.value = store.lms_connection?.url || '';
      openPortalLink.classList.toggle('hidden', !store.lms_connection?.url);
      if (store.lms_connection?.url) openPortalLink.href = store.lms_connection.url;
      lmsModal.classList.remove('hidden');
    };
    const hideLmsModal = () => lmsModal.classList.add('hidden');
    document.getElementById('connectLmsBtn').addEventListener('click', showLmsModal);
    document.getElementById('closeLmsModalBtn').addEventListener('click', hideLmsModal);
    document.getElementById('cancelLmsModalBtn').addEventListener('click', hideLmsModal);
    lmsModal.addEventListener('click', event => { if (event.target === lmsModal) hideLmsModal(); });
    lmsForm.addEventListener('submit', async event => {
      event.preventDefault();
      let url;
      try { url = new URL(lmsPortalUrl.value.trim()); } catch { alert('Enter a valid college portal URL.'); return; }
      if (!['https:', 'http:'].includes(url.protocol)) { alert('Use a portal URL that starts with http:// or https://.'); return; }
      store.lms_connection = { platform: lmsPlatform.value, url: url.href };
      await saveData();
      hideLmsModal();
      alert(`${store.lms_connection.platform} portal saved. Sign in there and import an .ics or .csv assignment export.`);
    });
    const lmsFileInput = document.getElementById('lmsDeadlineFile');
    document.getElementById('importLmsDeadlinesBtn').addEventListener('click', () => lmsFileInput.click());
    lmsFileInput.addEventListener('change', async () => {
      const file = lmsFileInput.files && lmsFileInput.files[0];
      if (!file) return;
      try {
        const result = await importLmsDeadlineFile(file);
        alert(result.added || result.updated
          ? `LMS deadlines: ${result.added} added, ${result.updated} updated.`
          : `No new deadlines imported. ${result.read ? 'The file may contain unsupported rows or already imported deadlines.' : 'Check that the file is a college portal calendar (.ics) or assignment CSV export.'}`);
      } catch (error) {
        alert('Could not read that file. Export a college portal calendar (.ics) or assignment list (.csv), then try again.');
      } finally {
        lmsFileInput.value = '';
      }
    });
    const efficiencyChartDetails = document.getElementById('efficiencyChartDetails');
    const efficiencyChartToggle = document.getElementById('toggleEfficiencyChartBtn');
    efficiencyChartToggle.addEventListener('click', () => {
      const expanded = efficiencyChartToggle.getAttribute('aria-expanded') === 'true';
      efficiencyChartToggle.setAttribute('aria-expanded', String(!expanded));
      efficiencyChartToggle.textContent = expanded ? 'Show subject charts' : 'Hide subject charts';
      efficiencyChartDetails.classList.toggle('hidden', expanded);
    });

    // Dark/Light Theme Toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    const themeIcon = document.getElementById('themeIcon');
    const savedTheme = localStorage.getItem('studyflow_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

    themeBtn.addEventListener('click', () => {
      const current = document.body.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', next);
      themeIcon.textContent = next === 'dark' ? '☀️' : '🌙';
      localStorage.setItem('studyflow_theme', next);
    });

    // Task Search & Filters
    document.getElementById('taskSearchInput').addEventListener('input', renderPlanner);
    document.getElementById('filterSubjectSelect').addEventListener('change', renderPlanner);
    document.getElementById('filterStatusSelect').addEventListener('change', renderPlanner);
    document.getElementById('filterPrioritySelect').addEventListener('change', renderPlanner);

    // Eisenhower Matrix Toggle
    const toggleEisenBtn = document.getElementById('toggleEisenhowerBtn');
    toggleEisenBtn.addEventListener('click', () => {
      isEisenhowerView = !isEisenhowerView;
      document.getElementById('standardTasksContainer').classList.toggle('hidden', isEisenhowerView);
      document.getElementById('eisenhowerContainer').classList.toggle('hidden', !isEisenhowerView);
      document.getElementById('eisenhowerBtnText').textContent = isEisenhowerView ? 'Standard List View' : 'Eisenhower Matrix';
    });

    // Task Modals
    document.getElementById('openNewTaskModalBtn').addEventListener('click', () => openTaskModal());
    document.getElementById('plannerAddTaskBtn').addEventListener('click', () => openTaskModal());
    document.getElementById('emptyAddTaskBtn').addEventListener('click', () => openTaskModal());
    document.getElementById('closeTaskModalBtn').addEventListener('click', closeTaskModal);
    document.getElementById('cancelTaskModalBtn').addEventListener('click', closeTaskModal);
    document.getElementById('taskForm').addEventListener('submit', handleSaveTask);

    // Subject Management Modal
    document.getElementById('manageSubjectsBtn').addEventListener('click', openSubjectModal);
    document.getElementById('closeSubjectModalBtn').addEventListener('click', closeSubjectModal);
    document.getElementById('closeSubjectModalFooterBtn').addEventListener('click', closeSubjectModal);

    document.getElementById('addSubjectForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('newSubName').value.trim();
      const target = parseFloat(document.getElementById('newSubTarget').value) || 5.0;
      if (name) {
        store.subjects = store.subjects || [];
        store.subjects.push({
          id: generateId('sub'),
          name,
          target_weekly_hours: target,
          color: '#3b82f6'
        });
        saveData();
        document.getElementById('newSubName').value = '';
        setupTimerSelects();
        renderSubjectsTable();
        renderAll();
      }
    });

    // Timer Mode Selectors
    document.querySelectorAll('.timer-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (timerRunning || timerStudiedSeconds > 0) {
          if (!confirm('Switch timer mode and clear the current unsaved progress?')) return;
        }
        document.querySelectorAll('.timer-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = btn.getAttribute('data-mode');
        const dur = parseInt(btn.getAttribute('data-duration'), 10);
        timerMode = mode;

        if (mode === 'stopwatch') {
          timerDurationSeconds = 0;
          stopwatchSeconds = 0;
        } else {
          timerDurationSeconds = dur * 60;
          timerSecondsLeft = dur * 60;
        }
        resetTimer();
      });
    });

    // Timer Controls
    document.getElementById('timerStartBtn').addEventListener('click', startTimer);
    document.getElementById('timerPauseBtn').addEventListener('click', pauseTimer);
    document.getElementById('timerResetBtn').addEventListener('click', () => {
      if (timerStudiedSeconds > 0 && localStorage.getItem('studyflow_confirm_reset') !== 'false' && !confirm('Reset this timer and clear its unsaved progress?')) return;
      resetTimer();
    });
    document.getElementById('timerCompleteBtn').addEventListener('click', finishTimerSession);

    // Star Rating
    const stars = document.querySelectorAll('#starRating .star');
    const ratingLabels = ['', 'Distracted (1/5)', 'Somewhat Focused (2/5)', 'Moderate Focus (3/5)', 'Great Focus (4/5)', 'Laser Focused (5/5)'];
    stars.forEach(star => {
      star.addEventListener('click', () => {
        const rating = parseInt(star.getAttribute('data-rating'), 10);
        selectedFocusRating = rating;
        stars.forEach((s, idx) => {
          s.classList.toggle('active', idx < rating);
        });
        document.getElementById('ratingText').textContent = ratingLabels[rating];
      });
    });

    // Quick Manual Offline Study Log
    document.getElementById('quickLogForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const sub = document.getElementById('manualSubSelect').value;
      const startedAt = new Date(document.getElementById('manualStartTimeInput').value);
      const endedAt = new Date(document.getElementById('manualEndTimeInput').value);
      const mins = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
      if (!Number.isFinite(mins) || mins <= 0) {
        alert('Log out time must be later than log in time.');
        return;
      }
      const notes = document.getElementById('manualNotesInput').value.trim();

      const newSession = {
        id: generateId('s_man'),
        subject: sub,
        task_id: null,
        duration_minutes: mins,
        date: getLocalDateValue(startedAt),
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        focus_score: 4,
        type: 'manual',
        notes: notes || 'Offline study session'
      };

      store.sessions = store.sessions || [];
      store.sessions.unshift(newSession);
      saveData();
      renderAll();

      document.getElementById('manualNotesInput').value = '';
      alert(`✓ Recorded ${(mins / 60).toFixed(1)} hours for ${sub}!`);
    });

    document.getElementById('studyNoteForm').addEventListener('submit', e => {
      e.preventDefault();
      const id = document.getElementById('studyNoteId').value;
      const note = {
        id: id || generateId('note'),
        title: document.getElementById('studyNoteTitle').value.trim(),
        subject: document.getElementById('studyNoteSubject').value,
        body: document.getElementById('studyNoteBody').value.trim(),
        updated_at: new Date().toISOString()
      };
      store.study_notes = store.study_notes || [];
      if (id) {
        const index = store.study_notes.findIndex(item => item.id === id);
        if (index >= 0) store.study_notes[index] = note;
      } else {
        store.study_notes.unshift(note);
      }
      document.getElementById('notesSubjectFilter').value = note.subject || '';
      saveData();
      e.target.reset();
      document.getElementById('studyNoteId').value = '';
      document.getElementById('saveStudyNoteBtn').textContent = 'Save Note';
      document.getElementById('cancelStudyNoteEditBtn').classList.add('hidden');
      renderStudyNotes();
    });
    document.getElementById('notesSubjectFilter').addEventListener('change', event => {
      document.getElementById('studyNoteSubject').value = event.target.value === 'ALL' ? '' : event.target.value;
      renderStudyNotes();
    });
    document.getElementById('cancelStudyNoteEditBtn').addEventListener('click', () => {
      document.getElementById('studyNoteForm').reset();
      document.getElementById('studyNoteId').value = '';
      document.getElementById('saveStudyNoteBtn').textContent = 'Save Note';
      document.getElementById('cancelStudyNoteEditBtn').classList.add('hidden');
    });

    document.getElementById('materialForm').addEventListener('submit', e => {
      e.preventDefault();
      const url = document.getElementById('materialUrl').value.trim();
      if (url && !/^https?:\/\//i.test(url)) return;
      store.study_materials = store.study_materials || [];
      store.study_materials.unshift({
        id: generateId('material'),
        title: document.getElementById('materialTitle').value.trim(),
        subject: document.getElementById('materialSubject').value,
        url,
        notes: document.getElementById('materialNotes').value.trim()
      });
      saveData();
      e.target.reset();
      renderMaterials();
    });

    // Export / Import JSON
    document.getElementById('exportDataBtn').addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(store, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `studyflow_backup_${getTodayDate()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });

    // ================= Opening Celebration Effects =================
    initOpeningFX();

    // ================= Zen Dodge Game =================
    initFidgetPod();
  }

  // ================= Opening Effects Logic =================
  function initOpeningFX() {
    // 1. Welcome banner controls
    const welcomeBanner = document.getElementById('welcomeBanner');
    const closeWelcomeBtn = document.getElementById('closeWelcomeBtn');
    const quickStartBtn = document.getElementById('quickStartSessionBtn');

    if (closeWelcomeBtn && welcomeBanner) {
      closeWelcomeBtn.addEventListener('click', () => {
        welcomeBanner.style.transition = 'all 0.3s ease';
        welcomeBanner.style.opacity = '0';
        welcomeBanner.style.transform = 'translateY(-15px) scale(0.96)';
        setTimeout(() => welcomeBanner.classList.add('hidden'), 300);
      });
    }

    if (quickStartBtn) {
      quickStartBtn.addEventListener('click', () => {
        switchTab('tab-timer');
        // Ensure the 60-minute focus mode is selected and active
        timerMode = 'focus-60';
        timerDurationSeconds = 60 * 60;
        timerSecondsLeft = 60 * 60;
        updateTimerDisplay();
        document.querySelectorAll('.timer-mode-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-mode') === 'focus-60');
        });
        startTimer();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // 2. Celebratory Canvas Particle Sparkles
    const canvas = document.getElementById('fxCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#67e8f9'];
    const particles = [];
    const particleCount = 65;

    // Launch particles from center top
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      particles.push({
        x: width / 2 + (Math.random() - 0.5) * 150,
        y: height * 0.25 + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        decay: Math.random() * 0.012 + 0.008,
        gravity: 0.18,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.2
      });
    }

    let animationFrameId = null;
    let startTime = Date.now();

    function renderFX() {
      const elapsed = Date.now() - startTime;
      ctx.clearRect(0, 0, width, height);

      let alive = false;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.alpha <= 0) continue;
        alive = true;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.98;
        p.alpha -= p.decay;
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        // Draw sparkle diamond/star
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.7, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.7, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      if (alive && elapsed < 4000) {
        animationFrameId = requestAnimationFrame(renderFX);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    }

    renderFX();
  }

  // ================= Zen Dodge Game Logic =================
  function initFidgetPod() {
    const toggleBtn = document.getElementById('fidgetToggleBtn');
    const closeBtn = document.getElementById('fidgetCloseBtn');
    const pod = document.getElementById('fidgetPod');
    const lockOverlay = document.getElementById('fidgetLockOverlay');
    const tabsContainer = document.getElementById('fidgetTabsContainer');
    const lockCountdown = document.getElementById('fidgetLockCountdown');
    const lockBadge = document.getElementById('fidgetLockBadge');
    const lockText = document.getElementById('fidgetLockText');
    const emergencyUnlockBtn = document.getElementById('emergencyUnlockBtn');
    const fidgetGoStudyBtn = document.getElementById('fidgetGoStudyBtn');

    if (!toggleBtn || !pod) return;

    // Zen Dodge uses a fixed focus lock; there is no user-adjustable duration setting.
    const lockMinutesPerHour = 50;

    let emergencyUnlockTimestamp = 0;

    // Hourly lock calculation
    function getLockStatus() {
      // If user disabled lock (0)
      if (lockMinutesPerHour === 0) {
        return { locked: false, remainingSeconds: 0 };
      }

      // Check emergency unlock override
      const nowMs = Date.now();
      if (nowMs < emergencyUnlockTimestamp) {
        const rem = Math.ceil((emergencyUnlockTimestamp - nowMs) / 1000);
        return { locked: false, remainingSeconds: rem, isEmergency: true };
      }

      // If active study focus timer is running, always lock!
      if (timerRunning && timerMode !== 'short-break' && timerMode !== 'long-break') {
        return { locked: true, remainingSeconds: timerSecondsLeft || 1200, reason: 'Focus Sprint Active' };
      }

      // If timer is on break mode, unlock!
      if (timerRunning && (timerMode === 'short-break' || timerMode === 'long-break')) {
        return { locked: false, remainingSeconds: timerSecondsLeft, isBreak: true };
      }

      // Calculate minute in the current hour (0-59)
      const d = new Date();
      const currentMin = d.getMinutes();
      const currentSec = d.getSeconds();

      if (currentMin < lockMinutesPerHour) {
        // In the locked portion of the hour
        const minsLeft = (lockMinutesPerHour - 1) - currentMin;
        const secsLeft = 60 - currentSec;
        return { locked: true, remainingSeconds: minsLeft * 60 + secsLeft, reason: `Hourly Lock (${lockMinutesPerHour}m/hr)` };
      }

      // In the unlocked break portion (last 60 - lockMinutesPerHour minutes)
      const minsLeft = 59 - currentMin;
      const secsLeft = 60 - currentSec;
      return { locked: false, remainingSeconds: minsLeft * 60 + secsLeft, isBreak: true };
    }

    function formatTime(totalSecs) {
      const m = Math.floor(totalSecs / 60);
      const s = totalSecs % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function updateLockState() {
      const status = getLockStatus();

      if (status.locked) {
        stopCarGame();
        if (lockOverlay) lockOverlay.classList.remove('hidden');
        if (tabsContainer) tabsContainer.classList.add('hidden');
        Object.values(panels).forEach(p => { if (p) p.classList.remove('active'); });

        if (lockCountdown) {
          lockCountdown.textContent = formatTime(status.remainingSeconds);
        }
        if (lockBadge) lockBadge.classList.add('active-lock');
        if (lockText) lockText.textContent = `Locked (${formatTime(status.remainingSeconds)})`;
      } else {
        if (lockOverlay) lockOverlay.classList.add('hidden');
        if (tabsContainer) tabsContainer.classList.remove('hidden');

        // Restore the car game panel after the hourly lock clears.
        if (panels.car) panels.car.classList.add('active');

        if (lockBadge) lockBadge.classList.remove('active-lock');
        if (lockText) {
          if (status.isEmergency) {
            lockText.textContent = `🔓 Override (${formatTime(status.remainingSeconds)})`;
          } else if (status.isBreak) {
            lockText.textContent = `🔓 Break (${formatTime(status.remainingSeconds)})`;
          } else {
            lockText.textContent = `🔓 Unlocked`;
          }
        }
      }
    }

    // Ticking lock timer every second
    setInterval(() => {
      updateLockState();
    }, 1000);

    if (emergencyUnlockBtn) {
      emergencyUnlockBtn.addEventListener('click', () => {
        emergencyUnlockTimestamp = Date.now() + 2 * 60 * 1000; // 2 min temporary unlock
        updateLockState();
        playFidgetSound('whoosh');
      });
    }

    if (fidgetGoStudyBtn) {
      fidgetGoStudyBtn.addEventListener('click', () => {
        pod.classList.add('hidden');
        switchTab('tab-timer');
      });
    }

    // Toggle Open/Close
    toggleBtn.addEventListener('click', () => {
      const isHidden = pod.classList.contains('hidden');
      if (isHidden) {
        if (timerRunning) pauseTimer();
        pod.classList.remove('hidden');
        updateLockState();
        drawCarScene();
      } else {
        stopCarGame();
        pod.classList.add('hidden');
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        stopCarGame();
        pod.classList.add('hidden');
      });
    }

    // Fidget Tab Switching
    const tabs = document.querySelectorAll('.fidget-tab');
    const panels = {
      car: document.getElementById('fidgetPanelCar')
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.getAttribute('data-fidget');

        Object.values(panels).forEach(p => {
          if (p) p.classList.remove('active');
        });

        if (panels[target]) {
          panels[target].classList.add('active');
        }

        if (target === 'spinner') {
          startSpinnerPhysics();
        }
      });
    });

    // Web Audio Synthesizer for Fidget Sounds
    function playFidgetSound(type) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        if (type === 'pop') {
          // Bubble wrap pop sound
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const freq = 380 + Math.random() * 240;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);

          gain.gain.setValueAtTime(0.35, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.08);
        } else if (type === 'click') {
          // Mechanical switch click sound
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1200, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.04);

          gain.gain.setValueAtTime(0.4, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.04);
        } else if (type === 'whoosh') {
          // Reset whoosh sound
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(200, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);

          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        }
      } catch (e) {
        // Sound unavailable in browser policy
      }
    }

    // ---------------- Compact Car Dodge Game ----------------
    const carCanvas = document.getElementById('carGameCanvas');
    const carCtx = carCanvas ? carCanvas.getContext('2d') : null;
    const carStartBtn = document.getElementById('carGameStartBtn');
    const carScoreLabel = document.getElementById('carGameScore');
    const carLanes = [90, 150, 210];
    let carLane = 1;
    let carObstacles = [];
    let carScore = 0;
    let carFrame = 0;
    let carRunning = false;
    let carAnimationId = null;

    function drawCar(lane, y, color) {
      if (!carCtx) return;
      const x = carLanes[lane];
      carCtx.fillStyle = '#111827';
      carCtx.fillRect(x - 15, y - 12, 5, 12);
      carCtx.fillRect(x + 10, y - 12, 5, 12);
      carCtx.fillRect(x - 15, y + 8, 5, 12);
      carCtx.fillRect(x + 10, y + 8, 5, 12);
      carCtx.fillStyle = color;
      carCtx.beginPath();
      carCtx.roundRect(x - 11, y - 18, 22, 38, 6);
      carCtx.fill();
      carCtx.fillStyle = 'rgba(219, 234, 254, 0.92)';
      carCtx.beginPath();
      carCtx.roundRect(x - 7, y - 11, 14, 10, 3);
      carCtx.fill();
      carCtx.fillStyle = '#fde68a';
      carCtx.fillRect(x - 8, y + 15, 5, 2);
      carCtx.fillRect(x + 3, y + 15, 5, 2);
    }

    function drawCarScene(message = '') {
      if (!carCtx || !carCanvas) return;
      const { width, height } = carCanvas;
      carCtx.fillStyle = '#8ecf8b';
      carCtx.fillRect(0, 0, width, height);
      carCtx.fillStyle = '#374151';
      carCtx.fillRect(54, 0, 192, height);
      carCtx.fillStyle = '#f8fafc';
      carCtx.fillRect(50, 0, 4, height);
      carCtx.fillRect(246, 0, 4, height);
      carCtx.strokeStyle = 'rgba(255,255,255,0.72)';
      carCtx.lineWidth = 3;
      carCtx.setLineDash([15, 13]);
      carCtx.lineDashOffset = -(carFrame % 28);
      [120, 180].forEach(x => {
        carCtx.beginPath(); carCtx.moveTo(x, 0); carCtx.lineTo(x, height); carCtx.stroke();
      });
      carCtx.setLineDash([]);
      carObstacles.forEach(obstacle => drawCar(obstacle.lane, obstacle.y, '#ef4444'));
      drawCar(carLane, 146, '#3b82f6');
      if (message) {
        carCtx.fillStyle = 'rgba(15, 23, 42, 0.72)';
        carCtx.fillRect(54, 65, 192, 42);
        carCtx.fillStyle = '#fff';
        carCtx.font = 'bold 14px sans-serif';
        carCtx.textAlign = 'center';
        carCtx.fillText(message, width / 2, 91);
      }
    }

    function stopCarGame() {
      carRunning = false;
      if (carAnimationId) cancelAnimationFrame(carAnimationId);
      carAnimationId = null;
    }

    function endCarGame() {
      stopCarGame();
      if (carStartBtn) carStartBtn.textContent = 'Race Again';
      drawCarScene('Traffic hit!');
    }

    function stepCarGame() {
      if (!carRunning) return;
      carFrame++;
      const speed = 2.7 + Math.min(carScore * 0.04, 2.5);
      if (carFrame % 48 === 0) {
        carObstacles.push({ lane: Math.floor(Math.random() * 3), y: -24 });
      }
      carObstacles.forEach(obstacle => { obstacle.y += speed; });
      if (carObstacles.some(obstacle => obstacle.lane === carLane && obstacle.y > 118 && obstacle.y < 164)) {
        endCarGame();
        return;
      }
      const passed = carObstacles.filter(obstacle => obstacle.y > 198).length;
      if (passed) carScore += passed;
      carObstacles = carObstacles.filter(obstacle => obstacle.y <= 198);
      if (carScoreLabel) carScoreLabel.textContent = `Score: ${carScore}`;
      drawCarScene();
      carAnimationId = requestAnimationFrame(stepCarGame);
    }

    function startCarGame() {
      stopCarGame();
      carLane = 1;
      carObstacles = [];
      carScore = 0;
      carFrame = 0;
      carRunning = true;
      if (carScoreLabel) carScoreLabel.textContent = 'Score: 0';
      if (carStartBtn) carStartBtn.textContent = 'Restart';
      stepCarGame();
    }

    function steerCar(direction) {
      if (!carRunning) return;
      carLane = Math.max(0, Math.min(2, carLane + direction));
      drawCarScene();
    }

    if (carStartBtn) carStartBtn.addEventListener('click', startCarGame);
    const carLeftBtn = document.getElementById('carGameLeftBtn');
    const carRightBtn = document.getElementById('carGameRightBtn');
    if (carLeftBtn) carLeftBtn.addEventListener('click', () => steerCar(-1));
    if (carRightBtn) carRightBtn.addEventListener('click', () => steerCar(1));
    document.addEventListener('keydown', event => {
      if (!carRunning || pod.classList.contains('hidden')) return;
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault(); steerCar(-1);
      } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault(); steerCar(1);
      }
    });
    drawCarScene('Ready to drive?');

    // ---------------- 1. Fidget Spinner Engine ----------------
    const rotor = document.getElementById('fidgetRotor');
    const hitArea = document.getElementById('spinnerHitArea');
    const flickBtn = document.getElementById('spinFlickBtn');
    const rpmLabel = document.getElementById('spinnerRpm');

    let currentAngle = 0;
    let angularVelocity = 0;
    let isDragging = false;
    let lastPointerAngle = 0;
    let spinnerAnimationId = null;

    function getPointerAngle(e, rect) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const px = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const py = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      return Math.atan2(py - cy, px - cx);
    }

    if (hitArea && rotor) {
      hitArea.addEventListener('pointerdown', (e) => {
        isDragging = true;
        hitArea.setPointerCapture(e.pointerId);
        const rect = hitArea.getBoundingClientRect();
        lastPointerAngle = getPointerAngle(e, rect);
      });

      hitArea.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const rect = hitArea.getBoundingClientRect();
        const newAngle = getPointerAngle(e, rect);
        let delta = newAngle - lastPointerAngle;

        // Wrap around -PI to PI
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;

        currentAngle += delta;
        angularVelocity = delta * 1.5;
        lastPointerAngle = newAngle;
        rotor.style.transform = `rotate(${currentAngle}rad)`;
      });

      const endDrag = () => {
        if (isDragging) {
          isDragging = false;
          // Cap maximum velocity
          angularVelocity = Math.max(-1.5, Math.min(1.5, angularVelocity));
        }
      };

      hitArea.addEventListener('pointerup', endDrag);
      hitArea.addEventListener('pointercancel', endDrag);
    }

    if (flickBtn) {
      flickBtn.addEventListener('click', () => {
        angularVelocity += (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.7);
        playFidgetSound('whoosh');
      });
    }

    function startSpinnerPhysics() {
      if (spinnerAnimationId) return;

      function step() {
        if (!isDragging) {
          currentAngle += angularVelocity;
          angularVelocity *= 0.985; // smooth friction deceleration

          if (Math.abs(angularVelocity) < 0.001) {
            angularVelocity = 0;
          }

          if (rotor) {
            rotor.style.transform = `rotate(${currentAngle}rad)`;
          }
        }

        // Calculate RPM: (rad/sec) * (60 / 2pi)
        if (rpmLabel) {
          const rpm = Math.round(Math.abs(angularVelocity) * 60 * 60 / (2 * Math.PI));
          rpmLabel.textContent = `${rpm} RPM`;
        }

        spinnerAnimationId = requestAnimationFrame(step);
      }

      step();
    }

    // ---------------- 2. Bubble Wrap Poppers ----------------
    const poppersGrid = document.getElementById('poppersGrid');
    const poppedCountLabel = document.getElementById('poppedCount');
    const resetPoppersBtn = document.getElementById('resetPoppersBtn');
    let totalPopped = 0;

    function buildPoppers() {
      if (!poppersGrid) return;
      poppersGrid.innerHTML = '';
      totalPopped = 0;
      if (poppedCountLabel) poppedCountLabel.textContent = 'Popped: 0 / 16';

      for (let i = 0; i < 16; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble-pop';
        bubble.setAttribute('role', 'button');
        bubble.setAttribute('aria-label', `Bubble ${i + 1}`);

        bubble.addEventListener('click', () => {
          if (!bubble.classList.contains('popped')) {
            bubble.classList.add('popped');
            totalPopped++;
            playFidgetSound('pop');
            if (poppedCountLabel) {
              poppedCountLabel.textContent = `Popped: ${totalPopped} / 16`;
            }
          }
        });

        poppersGrid.appendChild(bubble);
      }
    }

    buildPoppers();

    if (resetPoppersBtn) {
      resetPoppersBtn.addEventListener('click', () => {
        buildPoppers();
        playFidgetSound('whoosh');
      });
    }

    // ---------------- 3. Mechanical Clicker Switch ----------------
    const clickerBtn = document.getElementById('fidgetClickerBtn');
    const clickerCountLabel = document.getElementById('fidgetClickCount');
    let clickCount = 0;

    if (clickerBtn) {
      clickerBtn.addEventListener('pointerdown', () => {
        clickerBtn.classList.add('pressed');
        clickCount++;
        playFidgetSound('click');
        if (clickerCountLabel) {
          clickerCountLabel.textContent = clickCount;
        }
      });

      clickerBtn.addEventListener('pointerup', () => {
        clickerBtn.classList.remove('pressed');
      });

      clickerBtn.addEventListener('pointerleave', () => {
        clickerBtn.classList.remove('pressed');
      });
    }

    // ---------------- 4. 4-7-8 Breathing Guide ----------------
    const breatheText = document.getElementById('breatheText');
    if (breatheText) {
      const phases = ['Inhale...', 'Hold...', 'Exhale...', 'Rest & Repeat'];
      let phaseIdx = 0;

      setInterval(() => {
        phaseIdx = (phaseIdx + 1) % phases.length;
        breatheText.textContent = phases[phaseIdx];
      }, 4000);
    }
  }

  // ================= App Authentication Gate =================
  async function authenticateBeforeOpening() {
    const gate = document.getElementById('authGate');
    const form = document.getElementById('authGateForm');
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    const nameInput = document.getElementById('authName');
    const confirmInput = document.getElementById('authConfirmPassword');
    const nameGroup = document.getElementById('authNameGroup');
    const confirmGroup = document.getElementById('authConfirmGroup');
    const title = document.getElementById('authGateTitle');
    const copy = document.getElementById('authGateCopy');
    const showSignIn = document.getElementById('showSignIn');
    const showSignUp = document.getElementById('showSignUp');
    const passwordToggles = [
      [document.getElementById('toggleAuthPassword'), passwordInput, 'Show password', 'Hide password'],
      [document.getElementById('toggleConfirmPassword'), confirmInput, 'Show password confirmation', 'Hide password confirmation']
    ];
    const rememberEmail = document.getElementById('rememberEmail');
    const submit = document.getElementById('authGateSubmit');
    const error = document.getElementById('authGateError');
    let authMode = 'signin';
    const appLayout = document.querySelector('.app-layout');
    passwordToggles.forEach(([button, input, showLabel, hideLabel]) => {
      button.addEventListener('click', () => {
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        button.textContent = reveal ? 'Hide' : 'Show';
        button.setAttribute('aria-label', reveal ? hideLabel : showLabel);
        button.setAttribute('aria-pressed', String(reveal));
      });
    });
    const fidgetWrapper = document.getElementById('fidgetWrapper');
    if (appLayout) appLayout.inert = true;
    if (fidgetWrapper) fidgetWrapper.inert = true;

    try {
      const sessionResponse = await fetch('/api/auth', { credentials: 'same-origin' });
      const sessionResult = await sessionResponse.json();
      if (sessionResponse.ok && sessionResult.user) {
        activeUser = sessionResult.user;
        updateAccountName();
        gate.classList.add('hidden');
        if (appLayout) appLayout.inert = false;
        if (fidgetWrapper) fidgetWrapper.inert = false;
        return;
      }
    } catch {
      error.textContent = 'Could not reach the account service. Check deployment configuration and refresh.';
      error.classList.remove('hidden');
    }

    gate.classList.remove('hidden');

    const rememberedEmail = localStorage.getItem('studyflow_remembered_email') || '';
    if (rememberedEmail) {
      emailInput.value = rememberedEmail;
      rememberEmail.checked = true;
    }
    const storeRememberedEmail = () => {
      if (rememberEmail.checked && emailInput.value.trim()) {
        localStorage.setItem('studyflow_remembered_email', emailInput.value.trim());
      } else {
        localStorage.removeItem('studyflow_remembered_email');
      }
    };
    const setAuthMode = mode => {
      authMode = mode;
      const signingUp = mode === 'signup';
      nameGroup.classList.toggle('hidden', !signingUp);
      confirmGroup.classList.toggle('hidden', !signingUp);
      nameInput.required = signingUp;
      confirmInput.required = signingUp;
      passwordInput.autocomplete = signingUp ? 'new-password' : 'current-password';
      title.textContent = signingUp ? 'Create your StudyFlow account' : 'Sign in to StudyFlow';
      copy.textContent = signingUp ? 'Create an account to save your study progress privately.' : 'Sign in to continue to your personal study planner.';
      submit.textContent = signingUp ? 'Create account' : 'Sign In';
      showSignIn.classList.toggle('active', !signingUp);
      showSignUp.classList.toggle('active', signingUp);
      error.classList.add('hidden');
    };
    showSignIn.addEventListener('click', () => setAuthMode('signin'));
    showSignUp.addEventListener('click', () => setAuthMode('signup'));
    rememberEmail.addEventListener('change', storeRememberedEmail);
    emailInput.addEventListener('change', storeRememberedEmail);
    (rememberedEmail ? passwordInput : emailInput).focus();

    await new Promise(resolve => {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        error.classList.add('hidden');
        storeRememberedEmail();
        submit.disabled = true;
          submit.textContent = authMode === 'signup' ? 'Creating account…' : 'Signing in…';
        try {
            if (authMode === 'signup' && passwordInput.value !== confirmInput.value) {
              throw new Error('The passwords do not match.');
            }
          const response = await fetch('/api/auth', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: authMode,
              email: emailInput.value.trim(),
                password: passwordInput.value,
                displayName: nameInput.value.trim()
            })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Authentication failed.');
          activeUser = result.user;
          updateAccountName();
          passwordInput.value = '';
            confirmInput.value = '';
          gate.classList.add('hidden');
          if (appLayout) appLayout.inert = false;
          if (fidgetWrapper) fidgetWrapper.inert = false;
          resolve();
        } catch (authError) {
          error.textContent = authError.message;
          error.classList.remove('hidden');
          submit.disabled = false;
            submit.textContent = authMode === 'signup' ? 'Create account' : 'Sign In';
        }
      });
    });
  }

  function updateAccountName() {
    const accountName = document.getElementById('accountName');
    if (accountName && activeUser) {
      accountName.textContent = activeUser.displayName || activeUser.email.split('@')[0];
      accountName.title = activeUser.email;
    }
    document.getElementById('adminNavTab')?.classList.toggle('hidden', !canSeeAdminPanel());
  }

  function canSeeAdminPanel() {
    return activeUser?.role === 'admin' || activeUser?.email?.toLowerCase() === 'mohammed.yusuf5276@gmail.com';
  }

  async function loadAdminUsers() {
    const status = document.getElementById('adminUsersStatus');
    const body = document.getElementById('adminUsersTableBody');
    const notice = document.getElementById('adminPasswordNotice');
    if (!status || !body || !canSeeAdminPanel()) return;
    status.textContent = 'Loading accounts…';
    body.replaceChildren();
    notice.classList.add('hidden');
    try {
      const response = await fetch('/api/admin', { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load accounts.');
      for (const user of result.users) {
        const row = document.createElement('tr');
        const created = user.created_at ? new Date(user.created_at).toLocaleDateString() : '—';
        [user.display_name, user.email, user.role, created].forEach(value => {
          const cell = document.createElement('td');
          cell.textContent = value || '—';
          row.appendChild(cell);
        });
        const actionCell = document.createElement('td');
        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.className = 'btn btn-sm btn-outline';
        resetButton.textContent = 'Reset password';
        resetButton.setAttribute('data-reset-email', user.email);
        actionCell.appendChild(resetButton);
        row.appendChild(actionCell);
        body.appendChild(row);
      }
      status.textContent = result.users.length ? `${result.users.length} account(s)` : 'No accounts found.';
    } catch (error) {
      status.textContent = error.message;
    }
  }

  // ================= App Initialization =================
  async function init() {
    await authenticateBeforeOpening();
    await loadData();
    setupTimerSelects();
    updateTimerDisplay();
    setupEventListeners();
    document.getElementById('signOutBtn').addEventListener('click', async () => {
      await fetch('/api/auth', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
      window.location.reload();
    });
    renderAll();
    if ((store.tasks || []).some(task => task.status !== 'Completed' && getDeadlineDaysRemaining(task.due_date) === 2)) {
      switchTab('tab-planner');
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
