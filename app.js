/**
 * StudyFlow - Smart Study Planner & Time Management Engine
 * Pure Vanilla JavaScript: Task Management, Pomodoro Engine, Web Audio,
 * Analytics & Dual-Mode Storage (Python Server API + LocalStorage fallback)
 */

(() => {
  'use strict';

  // ================= State & Data Model =================
  const DEFAULT_DATA = {
    subjects: [
      { id: 'sub_frontend', name: 'FRONTEND', target_weekly_hours: 8.0, color: '#3b82f6' },
      { id: 'sub_dsa', name: 'DSA', target_weekly_hours: 8.0, color: '#10b981' },
      { id: 'sub_icp', name: 'ICP', target_weekly_hours: 6.0, color: '#f59e0b' },
      { id: 'sub_maths', name: 'MATHS', target_weekly_hours: 6.0, color: '#8b5cf6' }
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
      },
      {
        id: 't_dsa_1',
        title: 'Solve 5 LeetCode Binary Tree & Graph Problems',
        subject: 'DSA',
        due_date: getRelativeDate(3),
        estimated_hours: 3.5,
        actual_hours: 0.0,
        priority: 'High',
        status: 'Pending',
        notes: 'BFS, DFS traversal and lowest common ancestor.'
      },
      {
        id: 't_icp_1',
        title: 'Competitive Programming - DP & Prefix Sums',
        subject: 'ICP',
        due_date: getRelativeDate(4),
        estimated_hours: 2.5,
        actual_hours: 0.0,
        priority: 'Medium',
        status: 'Pending',
        notes: 'Knapsack variants and segment trees.'
      },
      {
        id: 't_maths_1',
        title: 'Review Linear Algebra & Discrete Mathematics',
        subject: 'MATHS',
        due_date: getRelativeDate(1),
        estimated_hours: 2.0,
        actual_hours: 2.0,
        priority: 'High',
        status: 'Completed',
        notes: 'Eigenvalues, determinants, and recurrence relations.'
      }
    ],
    sessions: [
      {
        id: 's_1',
        subject: 'FRONTEND',
        task_id: 't_fe_1',
        duration_minutes: 60,
        date: getTodayDate(),
        focus_score: 5,
        type: 'pomodoro',
        notes: 'Built navigation tabs and timer UI'
      },
      {
        id: 's_2',
        subject: 'MATHS',
        task_id: 't_maths_1',
        duration_minutes: 120,
        date: getRelativeDate(-1),
        focus_score: 4,
        type: 'stopwatch',
        notes: 'Completed discrete math chapter exercises'
      }
    ],
    daily_goals: {
      [getTodayDate()]: { target_hours: 3.0 }
    }
  };

  let store = { ...DEFAULT_DATA };

  // Timer Runtime State
  let timerInterval = null;
  let timerMode = 'pomodoro'; // 'pomodoro', 'deep', 'short-break', 'long-break', 'stopwatch'
  let timerDurationSeconds = 25 * 60;
  let timerSecondsLeft = 25 * 60;
  let stopwatchSeconds = 0;
  let timerRunning = false;
  let selectedFocusRating = 5;
  let timerStartTimestamp = null;

  // View States
  let activeTab = 'tab-dashboard';
  let isEisenhowerView = false;

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

  function generateId(prefix = 'id') {
    return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
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
    // 1. Try fetching from Python server API
    try {
      const res = await fetch('/api/data', { cache: 'no-cache' });
      if (res.ok) {
        const serverData = await res.json();
        if (serverData && serverData.subjects) {
          store = serverData;
          localStorage.setItem('studyflow_data', JSON.stringify(store));
          return;
        }
      }
    } catch (err) {
      // Python server not active or running in offline mode
    }

    // 2. Fallback to localStorage
    const local = localStorage.getItem('studyflow_data');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        // If old subjects were cached, update to new subjects
        const hasNewSubs = parsed.subjects && parsed.subjects.some(s => s.name === 'FRONTEND');
        if (!hasNewSubs) {
          store = { ...DEFAULT_DATA };
          saveData();
        } else {
          store = parsed;
        }
      } catch (e) {
        store = { ...DEFAULT_DATA };
      }
    } else {
      store = { ...DEFAULT_DATA };
      saveData();
    }
  }

  async function saveData() {
    // Save to localStorage immediately
    localStorage.setItem('studyflow_data', JSON.stringify(store));

    // Also push to Python server if available
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store)
      });
    } catch (e) {
      // Silently keep localStorage in sync
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
    const datesWithStudy = new Set(
      (store.sessions || [])
        .filter(s => (Number(s.duration_minutes) || 0) >= 15)
        .map(s => s.date)
    );

    if (datesWithStudy.size === 0) return { current: 0, longest: 0 };

    let current = 0;
    let d = new Date();
    const todayStr = getTodayDate();
    d.setDate(d.getDate() - 1);
    const yesterdayStr = d.toISOString().split('T')[0];

    // Check if streak is active today or yesterday
    let checkDate = datesWithStudy.has(todayStr) ? new Date() : (datesWithStudy.has(yesterdayStr) ? d : null);

    if (checkDate) {
      while (datesWithStudy.has(checkDate.toISOString().split('T')[0])) {
        current++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    return { current, longest: Math.max(current, 3) };
  }

  function calculateEfficiency() {
    const todayHours = calculateHoursToday();
    const todayGoal = (store.daily_goals && store.daily_goals[getTodayDate()]) ? store.daily_goals[getTodayDate()].target_hours : 3.0;
    const goalRatio = Math.min(1.0, todayHours / todayGoal);

    // Focus average
    const sessions = store.sessions || [];
    const avgFocus = sessions.length > 0
      ? sessions.reduce((acc, s) => acc + (Number(s.focus_score) || 5), 0) / sessions.length
      : 5.0;

    const streak = calculateStreak().current;
    const streakBonus = Math.min(20, streak * 5);
    const focusScore = (avgFocus / 5.0) * 40;
    const goalScore = goalRatio * 40;

    const efficiency = Math.round(streakBonus + focusScore + goalScore);
    return {
      score: Math.min(100, Math.max(10, efficiency)),
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

    // 1. Goal Pacing
    if (todayHours < todayGoal) {
      const rem = Math.round((todayGoal - todayHours) * 10) / 10;
      tips.push({
        icon: '⏱️',
        text: `You have <strong>${rem} hours</strong> remaining to achieve your daily target (${todayGoal}h). Try a 25m Pomodoro sprint now!`
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

    document.getElementById('dashTodayHours').innerHTML = `${todayHours}<span class="stat-unit">h</span>`;
    document.getElementById('dashTodayPct').textContent = `${todayPct}%`;
    document.getElementById('dashTodayBar').style.width = `${todayPct}%`;
    document.getElementById('dashTodayTarget').textContent = `Target: ${todayGoal} hours`;

    // Week metrics
    const weekHours = calculateWeekHours();
    const weeklyTarget = (store.subjects || []).reduce((acc, s) => acc + (Number(s.target_weekly_hours) || 0), 0);
    const weekPct = weeklyTarget > 0 ? Math.min(100, Math.round((weekHours / weeklyTarget) * 100)) : 0;

    document.getElementById('dashWeekHours').innerHTML = `${weekHours}<span class="stat-unit">h</span>`;
    document.getElementById('dashWeekPct').textContent = `${weekPct}%`;
    document.getElementById('dashWeekBar').style.width = `${weekPct}%`;
    document.getElementById('dashWeekTarget').textContent = `Weekly Target: ${weeklyTarget} hours`;

    // Efficiency
    const eff = calculateEfficiency();
    document.getElementById('dashEffScore').innerHTML = `${eff.score}<span class="stat-unit">/100</span>`;
    document.getElementById('dashEffBar').style.width = `${eff.score}%`;
    document.getElementById('dashFocusAvg').textContent = `Avg Focus: ${eff.avgFocus} ⭐`;

    const streak = calculateStreak();
    document.getElementById('dashStreakVal').innerHTML = `🔥 ${streak.current}<span class="stat-unit">days</span>`;
    document.getElementById('dashBestStreak').textContent = `Best Record: ${streak.longest} days`;

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
        return `
          <div class="quick-task-row">
            <div>
              <div class="quick-task-title">${escapeHtml(t.title)}</div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(t.subject)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span class="badge ${isOverdue ? 'badge-red' : 'badge-count'}">${t.due_date}</span>
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

    // Populate task select based on selected subject
    const updateTasksForSubject = () => {
      const chosenSub = subSelect.value;
      const relevantTasks = (store.tasks || []).filter(t => t.status !== 'Completed' && t.subject === chosenSub);
      taskSelect.innerHTML = '<option value="">General Review (No specific task)</option>' +
        relevantTasks.map(t => `<option value="${t.id}">${escapeHtml(t.title)} (${t.estimated_hours}h)</option>`).join('');
    };

    subSelect.addEventListener('change', updateTasksForSubject);
    updateTasksForSubject();

    document.getElementById('manualDateInput').value = getTodayDate();
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
    timerStartTimestamp = Date.now();

    document.getElementById('timerStartBtn').disabled = true;
    document.getElementById('timerPauseBtn').disabled = false;
    document.getElementById('timerCompleteBtn').disabled = false;

    const subject = document.getElementById('timerSubjectSelect').value;
    document.getElementById('timerStatusLabel').textContent = `Focus sprint active for ${subject}... Minimize all tabs!`;

    timerInterval = setInterval(() => {
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
          playCompletionChime();
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

    let minutesStudied = 0;
    if (timerMode === 'stopwatch') {
      minutesStudied = Math.round(stopwatchSeconds / 60);
    } else {
      minutesStudied = Math.round((timerDurationSeconds - timerSecondsLeft) / 60);
    }

    if (minutesStudied < 1) {
      minutesStudied = 1; // minimum 1 min
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
        renderSubjectsTable();
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
    renderDashboard();
    renderPlanner();
    renderAnalytics();
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
    // Navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
    });

    document.getElementById('jumpToPlannerBtn').addEventListener('click', () => switchTab('tab-planner'));

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
        renderSubjectsTable();
      }
    });

    // Timer Mode Selectors
    document.querySelectorAll('.timer-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (timerRunning) {
          if (!confirm('A focus sprint is currently running. Switch mode and reset?')) return;
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
    document.getElementById('timerResetBtn').addEventListener('click', resetTimer);
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
      const mins = parseFloat(document.getElementById('manualMinutesInput').value) || 60;
      const logDate = document.getElementById('manualDateInput').value || getTodayDate();
      const notes = document.getElementById('manualNotesInput').value.trim();

      const newSession = {
        id: generateId('s_man'),
        subject: sub,
        task_id: null,
        duration_minutes: mins,
        date: logDate,
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

    document.getElementById('importDataFileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (imported && imported.subjects && imported.tasks) {
            store = imported;
            saveData();
            setupTimerSelects();
            renderAll();
            alert('✓ Study data successfully imported!');
          } else {
            alert('Invalid JSON structure for study planner.');
          }
        } catch (err) {
          alert('Could not parse imported JSON file.');
        }
      };
      reader.readAsText(file);
    });
  }

  // ================= App Initialization =================
  async function init() {
    await loadData();
    setupTimerSelects();
    updateTimerDisplay();
    setupEventListeners();
    renderAll();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
