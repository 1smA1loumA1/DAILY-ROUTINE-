/**
 * Daily Routine Pro - Logic
 */

// State
const state = {
    config: {
        start: "08:00",
        end: "22:00"
    },
    goals: [], // { id, title, duration, priority, type: 'goal' }
    routine: [], // { time, title, duration, completed, type: 'routine' }
    ui: {
        activeView: 'dashboard'
    }
};

// DOM Refs
const els = {
    views: {
        dashboard: document.getElementById('view-dashboard'),
        schedule: document.getElementById('view-schedule')
    },
    nav: {
        dashboard: document.getElementById('nav-dashboard'),
        schedule: document.getElementById('nav-schedule')
    },
    inputs: {
        start: document.getElementById('start-time'),
        end: document.getElementById('end-time')
    },
    stats: {
        goals: document.getElementById('stat-total-goals'),
        duration: document.getElementById('stat-total-duration')
    },
    tables: {
        goals: document.getElementById('goals-table-body'),
        routine: document.getElementById('routine-table-body'),
        emptyState: document.getElementById('empty-state')
    },
    viz: {
        timeline: document.getElementById('timeline-viz'),
        progress: document.getElementById('sidebar-progress')
    },
    modal: {
        overlay: document.getElementById('modal-overlay'),
        content: document.getElementById('modal-content'),
        title: document.getElementById('modal-title'),
        duration: document.getElementById('modal-duration'),
        priority: document.getElementById('modal-priority')
    },
    btns: {
        generate: document.getElementById('generate-btn')
    }
};

// --- Initialization ---

function init() {
    loadState();
    renderConfig();
    renderStats();
    renderGoalsTable();

    // Auto-switch to schedule if routine exists and we want to persist context
    // For now default to dashboard is safer

    // Add Event Listeners
    els.inputs.start.addEventListener('change', (e) => updateConfig('start', e.target.value));
    els.inputs.end.addEventListener('change', (e) => updateConfig('end', e.target.value));
    els.btns.generate.addEventListener('click', generateRoutine);
}

// --- Navigation & UI ---

window.switchView = function (viewName) {
    // Hide all
    Object.values(els.views).forEach(el => {
        el.classList.remove('active');
        setTimeout(() => { if (!el.classList.contains('active')) el.style.display = 'none'; }, 300); // fade out hack
    });

    // Nav active state
    els.nav.dashboard.classList.remove('bg-glass-100', 'text-white');
    els.nav.schedule.classList.remove('bg-glass-100', 'text-white');
    els.nav.dashboard.classList.add('text-slate-300');
    els.nav.schedule.classList.add('text-slate-300');

    // Show Target
    const target = els.views[viewName];
    target.style.display = 'block';
    // Small delay to allow display block to apply before opacity transition
    requestAnimationFrame(() => target.classList.add('active'));

    els.nav[viewName].classList.add('bg-glass-100', 'text-white');
    els.nav[viewName].classList.remove('text-slate-300');

    state.ui.activeView = viewName;

    // If switching to schedule, ensure it's up to date
    if (viewName === 'schedule' && state.routine.length > 0) {
        renderRoutine();
    }
}

// --- Modal System ---

window.openModal = function () {
    els.modal.overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        els.modal.overlay.classList.remove('opacity-0');
        els.modal.content.classList.remove('scale-95');
        els.modal.content.classList.add('scale-100');
    });
    els.modal.title.focus();
};

window.closeModal = function () {
    els.modal.overlay.classList.add('opacity-0');
    els.modal.content.classList.remove('scale-100');
    els.modal.content.classList.add('scale-95');
    setTimeout(() => {
        els.modal.overlay.classList.add('hidden');
        // Reset inputs
        els.modal.title.value = '';
        els.modal.duration.value = '30';
    }, 300);
};

window.submitModal = function () {
    const title = els.modal.title.value.trim();
    const duration = parseInt(els.modal.duration.value);
    const priority = els.modal.priority.value;

    if (!title || isNaN(duration)) return;

    const newGoal = {
        id: Date.now().toString(),
        title,
        duration,
        priority
    };

    state.goals.push(newGoal);
    saveState();
    renderGoalsTable();
    renderStats();
    closeModal();
};


// --- Logic ---

function updateConfig(key, value) {
    state.config[key] = value;
    saveState();
}

window.deleteGoal = function (id) {
    state.goals = state.goals.filter(g => g.id !== id);
    saveState();
    renderGoalsTable();
    renderStats();
};

function generateRoutine() {
    const startMinutes = timeToMinutes(state.config.start);
    const endMinutes = timeToMinutes(state.config.end);

    if (endMinutes <= startMinutes) {
        alert("End time must be after start time");
        return;
    }

    let availableMinutes = endMinutes - startMinutes;
    let currentMinutes = startMinutes;
    let routine = [];

    // Sort goals by Priority (High -> Medium -> Low)
    const priorityMap = { 'High': 3, 'Medium': 2, 'Low': 1 };
    const sortedGoals = [...state.goals].sort((a, b) => priorityMap[b.priority] - priorityMap[a.priority]);

    if (sortedGoals.length === 0) {
        alert("Please add goals via the Dashboard first.");
        return;
    }

    sortedGoals.forEach(goal => {
        if (currentMinutes + goal.duration <= endMinutes) {
            routine.push({
                id: goal.id + '-r',
                title: goal.title,
                startTime: minutesToTime(currentMinutes),
                duration: goal.duration,
                completed: false,
                priority: goal.priority
            });
            currentMinutes += goal.duration;
        }
    });

    // Fill gap at end
    if (currentMinutes < endMinutes) {
        routine.push({
            id: 'free-' + Date.now(),
            title: 'Free Time / Wind Down',
            startTime: minutesToTime(currentMinutes),
            duration: endMinutes - currentMinutes,
            completed: false,
            priority: 'Low',
            isSystem: true
        });
    }

    state.routine = routine;
    saveState();
    renderRoutine();
}

window.toggleComplete = function (id) {
    const item = state.routine.find(i => i.id === id);
    if (item) {
        item.completed = !item.completed;
        saveState();
        renderRoutine();
    }
}


// --- Rendering ---

function renderConfig() {
    els.inputs.start.value = state.config.start;
    els.inputs.end.value = state.config.end;
}

function renderStats() {
    els.stats.goals.textContent = state.goals.length;
    const totalMins = state.goals.reduce((acc, curr) => acc + curr.duration, 0);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    els.stats.duration.textContent = `${hours}h ${mins > 0 ? mins + 'm' : ''}`;
}

function renderGoalsTable() {
    const tbody = els.tables.goals;
    tbody.innerHTML = '';

    if (state.goals.length === 0) {
        els.tables.emptyState.classList.remove('hidden');
    } else {
        els.tables.emptyState.classList.add('hidden');
        state.goals.forEach(goal => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-800/30 transition-colors group";

            // Priority Pill
            const pColors = {
                'High': 'text-rose-400 bg-rose-400/10 border-rose-400/20',
                'Medium': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
                'Low': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
            };
            const pClass = pColors[goal.priority] || pColors['Medium'];

            tr.innerHTML = `
                <td class="px-6 py-4 text-white font-medium">${goal.title}</td>
                <td class="px-6 py-4 text-slate-400">${goal.duration} min</td>
                <td class="px-6 py-4">
                    <span class="text-xs px-2 py-1 rounded border ${pClass}">${goal.priority}</span>
                </td>
                <td class="px-6 py-4 text-right">
                    <button onclick="deleteGoal('${goal.id}')" class="text-slate-500 hover:text-rose-500 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function renderRoutine() {
    const tbody = els.tables.routine;
    const viz = els.viz.timeline;
    tbody.innerHTML = '';
    viz.innerHTML = '';

    let completedCount = 0;

    state.routine.forEach((item, idx) => {
        if (item.completed) completedCount++;

        // 1. Render Table Row
        const tr = document.createElement('tr');
        tr.className = `group border-b border-glass-border hover:bg-slate-800/30 transition-colors ${item.completed ? 'opacity-50' : ''}`;
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-mono">${item.startTime}</td>
            <td class="px-6 py-4 text-white font-medium ${item.completed ? 'line-through text-slate-500' : ''}">
                ${item.title}
                ${item.isSystem ? '<span class="ml-2 text-xs text-slate-500 italic">(Auto-filled)</span>' : ''}
            </td>
            <td class="px-6 py-4 text-slate-400 text-sm">${item.duration}m</td>
            <td class="px-6 py-4 text-right">
                 <button onclick="toggleComplete('${item.id}')" 
                    class="w-6 h-6 rounded border flex items-center justify-center transition-all
                    ${item.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600 hover:border-brand-accent text-transparent'}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                 </button>
            </td>
        `;
        tbody.appendChild(tr);

        // 2. Render Timeline Viz
        const vizItem = document.createElement('div');
        vizItem.className = `relative pl-6 pb-2 ${item.completed ? 'opacity-50' : ''}`;
        vizItem.innerHTML = `
            <div class="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${item.completed ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-900 border-brand-accent'} z-10 transition-colors"></div>
            <div class="glass-panel p-3 rounded-lg border-l-4 ${item.isSystem ? 'border-slate-600' : 'border-brand-accent'}">
                <span class="text-xs text-brand-accent font-mono block mb-1">${item.startTime}</span>
                <span class="text-sm text-white block truncate">${item.title}</span>
            </div>
        `;
        viz.appendChild(vizItem);
    });

    // Update Progress
    const total = state.routine.length;
    const pct = total === 0 ? 0 : (completedCount / total) * 100;
    els.viz.progress.style.width = `${pct}%`;
}


// --- Helpers ---
function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function minutesToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function saveState() {
    localStorage.setItem('dailyRoutinePro', JSON.stringify(state)); // New key for Pro to split envs if needed
}

function loadState() {
    const saved = localStorage.getItem('dailyRoutinePro');
    if (saved) {
        const parsed = JSON.parse(saved);
        state.config = parsed.config || state.config;
        state.goals = parsed.goals || [];
        state.routine = parsed.routine || [];
        // Reset ID on reload 
    }
}

init();
