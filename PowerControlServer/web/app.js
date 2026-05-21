// State Variable
let devices = [];
let schedulesData = [];

async function fetchDevices() {
    try {
        const response = await fetch('/api/devices');
        devices = await response.json();

        // Ensure MAC is optional for projectors when rendering/saving
        devices.forEach(d => {
            if (d.type === 'projector') d.mac = d.mac || 'N/A';
        });

        renderDevices(currentView);
        renderManagementTables();
        updateStats();
    } catch (e) {
        console.error("Failed to fetch devices:", e);
    }
}

// Initialize UI
document.addEventListener('DOMContentLoaded', async () => {
    // Load saved theme
    const savedTheme = localStorage.getItem('powerctrl_theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) themeToggle.checked = true;
    }

    initNavigation();
    await fetchSettings();
    await fetchSchedules();
    await fetchDevices();

    // Start live hardware polling every 5 seconds
    setInterval(pollDeviceStatus, 5000);
});

async function pollDeviceStatus() {
    try {
        const response = await fetch('/api/devices');
        devices = await response.json();

        devices.forEach(d => {
            if (d.type === 'projector') d.mac = d.mac || 'N/A';
        });

        // Re-render UI without resetting modals or scroll position
        renderDevices(currentView);
        renderManagementTables();
        updateStats();
    } catch (e) {
        console.error("Live poll failed", e);
    }
}

async function scanDevices() {
    const btn = document.getElementById('btn-scan');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> 스캔 중...';
    }

    try {
        await fetch('/api/devices/scan', { method: 'POST' });
        await fetchDevices(); // Re-fetch the newly updated devices
    } catch (e) {
        console.error("Manual scan failed", e);
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ri-refresh-line"></i> 현재 상태 스캔';
    }
}

function toggleTheme(isDark) {
    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('powerctrl_theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('powerctrl_theme', 'light');
    }
}

async function fetchSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        
        const globalToggle = document.getElementById('globalSchedulerToggle');
        if (globalToggle) {
            globalToggle.checked = data.schedulerEnabled;
        }

        const apiPortInput = document.getElementById('settingsApiPort');
        if (apiPortInput) {
            // Show the preferred (saved) port, not the active port
            apiPortInput.value = data.preferredPort || data.activePort || 8080;
        }

        const broadcastIpInput = document.getElementById('settingsBroadcastIp');
        if (broadcastIpInput) {
            broadcastIpInput.value = data.broadcastIp || '192.168.1.255';
        }
    } catch (e) {
        console.error("Failed to load settings:", e);
    }
}

async function saveSettings() {
    const globalToggle = document.getElementById('globalSchedulerToggle');
    const apiPortInput = document.getElementById('settingsApiPort');
    const broadcastIpInput = document.getElementById('settingsBroadcastIp');
    
    // Debug: log which elements are missing
    if (!globalToggle) console.error("saveSettings: globalSchedulerToggle not found");
    if (!apiPortInput) console.error("saveSettings: settingsApiPort not found");
    if (!broadcastIpInput) console.error("saveSettings: settingsBroadcastIp not found");
    
    if (!apiPortInput || !broadcastIpInput) {
        alert("설정 UI 요소를 찾을 수 없습니다. 페이지를 새로고침 해주세요.");
        return;
    }
    
    const payload = {
        schedulerEnabled: globalToggle ? globalToggle.checked : true,
        preferredPort: parseInt(apiPortInput.value) || 8080,
        broadcastIp: broadcastIpInput.value.trim() || "192.168.1.255"
    };

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error("Settings save failed: " + res.status);
        
        const data = await res.json();
        if (data.needsRestart) {
            alert("포트 설정이 변경되어 서버를 자동으로 재시작합니다.\n브라우저 주소창의 포트 번호를 새 번호로 변경하여 다시 접속해 주세요.");
        } else {
            alert("환경 설정이 성공적으로 저장되었습니다.");
        }
    } catch (e) {
        console.error("Failed to save settings:", e);
        alert("설정 저장에 실패했습니다: " + e.message);
    }
}

async function toggleGlobalScheduler(enabled) {
    // Save all settings when the scheduler toggle changes
    await saveSettings();
}

function resetSettings() {
    if (confirm('설정값을 기본값으로 되돌리시겠습니까? (저장 버튼을 눌러야 적용됩니다)')) {
        const toggle = document.getElementById('globalSchedulerToggle');
        const port = document.getElementById('settingsApiPort');
        const ip = document.getElementById('settingsBroadcastIp');
        if (toggle) toggle.checked = true;
        if (port) port.value = "8080";
        if (ip) ip.value = "192.168.1.255";
    }
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPageId = item.getAttribute('data-page');

            // Remove active from all nav items globally
            navItems.forEach(nav => nav.classList.remove('active'));

            // Add active to both top and bottom nav items pointing to the same page
            document.querySelectorAll(`.nav-item[data-page="${targetPageId}"]`).forEach(el => {
                el.classList.add('active');
            });

            // Hide all pages
            pages.forEach(page => {
                page.style.display = 'none';
                page.classList.remove('active');
            });

            // Show selected page
            const targetPage = document.getElementById(`page-${targetPageId}`);
            if (targetPage) {
                targetPage.style.display = 'block';
                // Trigger reflow to restart animation
                void targetPage.offsetWidth;
                targetPage.classList.add('active');
            }
        });
    });
}

// Schedule and Settings Handlers
async function fetchSchedules() {
    try {
        const res = await fetch('/api/schedules');
        const schedules = await res.json() || [];
        schedulesData = schedules;

        // Render Schedule Cards
        const grid = document.getElementById('scheduleGrid');
        if (grid) {
            grid.innerHTML = '';
            const dayLabels = {mon:'월', tue:'화', wed:'수', thu:'목', fri:'금', sat:'토', sun:'일'};
            const dayKeys = ['mon','tue','wed','thu','fri','sat','sun'];

            schedules.forEach(s => {
                const numDevices = devices.filter(d => d.room === s.room).length;
                
                // Parse daysConfig or create default from legacy startTime/endTime
                let days = {};
                try { days = s.daysConfig ? JSON.parse(s.daysConfig) : {}; } catch(e) {}
                const hasDays = Object.keys(days).length > 0;

                // Auto-detect isAdvanced mode
                let isAdvanced = false;
                let unifiedStart = null;
                let unifiedEnd = null;

                dayKeys.forEach(dk => {
                    const dc = hasDays ? (days[dk] || {enabled: false, startTime: '', endTime: ''}) 
                                       : {enabled: true, startTime: s.startTime || '09:00', endTime: s.endTime || '18:00'};
                    if (dc.enabled) {
                        if (unifiedStart === null) {
                            unifiedStart = dc.startTime;
                            unifiedEnd = dc.endTime;
                        } else if (unifiedStart !== dc.startTime || unifiedEnd !== dc.endTime) {
                            isAdvanced = true;
                        }
                    }
                });

                if (unifiedStart === null) {
                    unifiedStart = s.startTime || '09:00';
                    unifiedEnd = s.endTime || '18:00';
                }

                // Build Advanced View day rows
                let dayRowsHTML = '';
                dayKeys.forEach(dk => {
                    const dc = hasDays ? (days[dk] || {enabled: false, startTime: '', endTime: ''}) 
                                       : {enabled: true, startTime: s.startTime || '09:00', endTime: s.endTime || '18:00'};
                    const isWeekend = (dk === 'sat' || dk === 'sun');
                    const checked = dc.enabled ? 'checked' : '';
                    const disabled = dc.enabled ? '' : 'disabled';
                    const dimStyle = dc.enabled ? '' : 'opacity: 0.4;';
                    
                    dayRowsHTML += `
                        <div class="day-row" style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; background: ${isWeekend ? 'rgba(255,100,100,0.05)' : 'rgba(255,255,255,0.02)'};">
                            <label style="display: flex; align-items: center; gap: 6px; min-width: 50px; cursor: pointer;">
                                <input type="checkbox" id="sch_adv_day_${s.room}_${dk}" ${checked} 
                                    onchange="toggleDayRow('${s.room}', '${dk}', this.checked)"
                                    style="accent-color: var(--primary);">
                                <span style="font-weight: 600; font-size: 0.85rem; color: ${isWeekend ? '#e74c3c' : 'var(--text-primary)'};">${dayLabels[dk]}</span>
                            </label>
                            <div id="sch_adv_times_${s.room}_${dk}" style="display: flex; align-items: center; gap: 6px; flex: 1; ${dimStyle}">
                                <input type="time" id="sch_adv_start_${s.room}_${dk}" value="${dc.startTime || unifiedStart}" class="time-picker" ${disabled} style="font-size: 0.82rem; padding: 3px 6px;">
                                <span style="color: var(--text-secondary); font-size: 0.8rem;">~</span>
                                <input type="time" id="sch_adv_end_${s.room}_${dk}" value="${dc.endTime || unifiedEnd}" class="time-picker" ${disabled} style="font-size: 0.82rem; padding: 3px 6px;">
                            </div>
                        </div>`;
                });

                // Build Simple View day pickers
                let simpleDayPickerHTML = dayKeys.map(dk => {
                    const dc = hasDays ? (days[dk] || {enabled: false}) : {enabled: true};
                    return `
                        <label title="${dayLabels[dk]}요일">
                            <input type="checkbox" id="sch_simple_day_${s.room}_${dk}" ${dc.enabled ? 'checked' : ''}>
                            <span class="day-badge">${dayLabels[dk]}</span>
                        </label>
                    `;
                }).join('');

                const cardHTML = `
                    <div class="schedule-card">
                        <div class="schedule-header">
                            <div class="schedule-title" style="flex: 1; padding-right: 15px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="ri-building-4-line"></i>
                                    <input type="text" id="sch_name_${s.room}" value="${s.name}" class="form-input" style="background: transparent; border: 1px solid transparent; border-bottom: 1px dashed var(--border-color); font-size: 1.1rem; font-weight: bold; padding: 2px 4px; box-sizing: border-box; width: 100%;">
                                </div>
                            </div>
                            <div class="schedule-toggle" style="display: flex; align-items: center; gap: 10px;">
                                <span class="badge ${s.isActive ? 'badge-active' : ''}">${s.isActive ? '활성' : '비활성'}</span>
                                <label class="switch">
                                    <input type="checkbox" id="sch_active_${s.room}" ${s.isActive ? 'checked' : ''} onchange="saveSchedule('${s.room}', true)">
                                    <span class="slider round"></span>
                                </label>
                            </div>
                        </div>

                        <div class="schedule-settings">
                            <div class="setting-group">
                                <h4 class="setting-label" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem;">
                                    <span>운영 시간 설정</span>
                                    <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; text-transform: none; font-weight: normal; color: var(--text-primary);">
                                        <input type="checkbox" id="sch_mode_${s.room}" ${isAdvanced ? 'checked' : ''} onchange="toggleScheduleMode('${s.room}')" style="accent-color: var(--primary);">
                                        요일별 다르게 설정
                                    </label>
                                </h4>
                                
                                <!-- Simple View -->
                                <div id="sch_view_simple_${s.room}" style="display: ${isAdvanced ? 'none' : 'block'};">
                                    <div class="day-picker">
                                        ${simpleDayPickerHTML}
                                    </div>
                                    <div class="time-inputs" style="margin-top: 1.2rem;">
                                        <div class="time-field">
                                            <span>시작 (ON)</span>
                                            <input type="time" id="sch_simple_start_${s.room}" value="${unifiedStart}" class="time-picker">
                                        </div>
                                        <i class="ri-arrow-right-line time-divider"></i>
                                        <div class="time-field">
                                            <span>종료 (OFF)</span>
                                            <input type="time" id="sch_simple_end_${s.room}" value="${unifiedEnd}" class="time-picker">
                                        </div>
                                    </div>
                                </div>

                                <!-- Advanced View -->
                                <div id="sch_view_adv_${s.room}" style="display: ${isAdvanced ? 'block' : 'none'};">
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        ${dayRowsHTML}
                                    </div>
                                </div>
                            </div>

                            <div class="setting-group">
                                <h4 class="setting-label">전원 켜기(ON) 제어 순서</h4>
                                <div class="sequence-box">
                                    <div class="step-badge projector-step">1. 프로젝터 켜짐</div>
                                    <div class="step-delay">
                                        <span>대기: </span>
                                        <input type="number" id="sch_pj_delay_${s.room}" value="${s.projectorDelay}" min="0" max="30" class="delay-input-sm">
                                        <span>분</span>
                                    </div>
                                    <div class="step-badge pc-step">2. 컴퓨터(PC) 켜짐</div>
                                </div>
                            </div>

                            <div class="setting-group">
                                <h4 class="setting-label">전원 끄기(OFF) 제어 순서</h4>
                                <div class="sequence-box">
                                    <div class="step-badge pc-step">1. 컴퓨터(PC) 꺼짐</div>
                                    <div class="step-delay">
                                        <span>대기: </span>
                                        <input type="number" id="sch_pc_delay_${s.room}" value="${s.pcDelay}" min="0" max="30" class="delay-input-sm">
                                        <span>분</span>
                                    </div>
                                    <div class="step-badge projector-step">2. 프로젝터 꺼짐</div>
                                </div>
                            </div>
                        </div>

                        <div class="schedule-actions" style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="schedule-info"><i class="ri-information-line"></i> 연동 장비: 총 ${numDevices}대</span>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-sm btn-danger" onclick="deleteSchedule('${s.room}')">삭제</button>
                                <button class="btn btn-sm btn-primary" onclick="saveSchedule('${s.room}')">저장</button>
                            </div>
                        </div>
                    </div>
                `;
                grid.innerHTML += cardHTML;
            });
        }

        // Populate room dropdown in device modal
        const roomSelect = document.getElementById('deviceRoom');
        if (roomSelect) {
            const currentVal = roomSelect.value;
            roomSelect.innerHTML = '';
            schedules.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.room;
                opt.textContent = s.name || s.room;
                roomSelect.appendChild(opt);
            });
            if (currentVal) roomSelect.value = currentVal;
        }

    } catch (e) {
        console.error("Failed to load schedules", e);
    }
}

async function saveSchedule(room, isSilent = false) {
    const dayKeys = ['mon','tue','wed','thu','fri','sat','sun'];
    const days = {};
    let firstStartTime = '09:00';
    let firstEndTime = '18:00';

    const isAdvanced = document.getElementById(`sch_mode_${room}`).checked;

    if (isAdvanced) {
        // Advanced Mode
        dayKeys.forEach(dk => {
            const cb = document.getElementById(`sch_adv_day_${room}_${dk}`);
            const st = document.getElementById(`sch_adv_start_${room}_${dk}`);
            const et = document.getElementById(`sch_adv_end_${room}_${dk}`);
            const enabled = cb ? cb.checked : false;
            days[dk] = {
                enabled: enabled,
                startTime: st ? st.value : '',
                endTime: et ? et.value : ''
            };
            if (enabled && st && st.value && firstStartTime === '09:00') firstStartTime = st.value;
            if (enabled && et && et.value && firstEndTime === '18:00') firstEndTime = et.value;
        });
    } else {
        // Simple Mode
        const simpleStart = document.getElementById(`sch_simple_start_${room}`).value;
        const simpleEnd = document.getElementById(`sch_simple_end_${room}`).value;
        firstStartTime = simpleStart;
        firstEndTime = simpleEnd;

        dayKeys.forEach(dk => {
            const cb = document.getElementById(`sch_simple_day_${room}_${dk}`);
            const enabled = cb ? cb.checked : false;
            days[dk] = {
                enabled: enabled,
                startTime: simpleStart,
                endTime: simpleEnd
            };
        });
    }

    const payload = {
        room: room,
        name: document.getElementById(`sch_name_${room}`).value,
        isActive: document.getElementById(`sch_active_${room}`).checked,
        startTime: firstStartTime,
        endTime: firstEndTime,
        projectorDelay: parseInt(document.getElementById(`sch_pj_delay_${room}`).value) || 0,
        pcDelay: parseInt(document.getElementById(`sch_pc_delay_${room}`).value) || 0,
        daysConfig: JSON.stringify(days)
    };

    try {
        const res = await fetch(`/api/schedules/${room}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());

        if (!isSilent) {
            alert("스케줄 설정이 저장되었습니다.");
        }

        // Refresh UI
        await fetchSchedules();
        renderDevices(currentView);
    } catch (e) {
        if (!isSilent) alert("저장 실패");
        console.error(e);
    }
}

// Toggle day row enable/disable in advanced view
function toggleDayRow(room, dayKey, enabled) {
    const timesDiv = document.getElementById(`sch_adv_times_${room}_${dayKey}`);
    const startInput = document.getElementById(`sch_adv_start_${room}_${dayKey}`);
    const endInput = document.getElementById(`sch_adv_end_${room}_${dayKey}`);
    if (timesDiv) timesDiv.style.opacity = enabled ? '1' : '0.4';
    if (startInput) startInput.disabled = !enabled;
    if (endInput) endInput.disabled = !enabled;
}

// Switch between simple and advanced mode
function toggleScheduleMode(room) {
    const isAdvanced = document.getElementById(`sch_mode_${room}`).checked;
    const simpleView = document.getElementById(`sch_view_simple_${room}`);
    const advView = document.getElementById(`sch_view_adv_${room}`);
    const dayKeys = ['mon','tue','wed','thu','fri','sat','sun'];

    if (isAdvanced) {
        simpleView.style.display = 'none';
        advView.style.display = 'block';
        
        // Sync Simple -> Advanced
        const simpleStart = document.getElementById(`sch_simple_start_${room}`).value;
        const simpleEnd = document.getElementById(`sch_simple_end_${room}`).value;
        
        dayKeys.forEach(dk => {
            const simpleCb = document.getElementById(`sch_simple_day_${room}_${dk}`);
            const advCb = document.getElementById(`sch_adv_day_${room}_${dk}`);
            const advStart = document.getElementById(`sch_adv_start_${room}_${dk}`);
            const advEnd = document.getElementById(`sch_adv_end_${room}_${dk}`);
            
            if (simpleCb && advCb) {
                advCb.checked = simpleCb.checked;
                toggleDayRow(room, dk, simpleCb.checked);
            }
            if (advStart) advStart.value = simpleStart;
            if (advEnd) advEnd.value = simpleEnd;
        });
    } else {
        advView.style.display = 'none';
        simpleView.style.display = 'block';

        // Sync Advanced -> Simple (use first enabled day)
        let foundFirst = false;
        dayKeys.forEach(dk => {
            const simpleCb = document.getElementById(`sch_simple_day_${room}_${dk}`);
            const advCb = document.getElementById(`sch_adv_day_${room}_${dk}`);
            const advStart = document.getElementById(`sch_adv_start_${room}_${dk}`);
            const advEnd = document.getElementById(`sch_adv_end_${room}_${dk}`);

            if (simpleCb && advCb) {
                simpleCb.checked = advCb.checked;
            }
            if (advCb && advCb.checked && !foundFirst) {
                foundFirst = true;
                const simpleStart = document.getElementById(`sch_simple_start_${room}`);
                const simpleEnd = document.getElementById(`sch_simple_end_${room}`);
                if (simpleStart && advStart) simpleStart.value = advStart.value;
                if (simpleEnd && advEnd) simpleEnd.value = advEnd.value;
            }
        });
    }
}

async function deleteSchedule(room) {
    if (!confirm("이 빈 스케줄/콘텐츠를 삭제하시겠습니까? (연결된 장비가 있다면 '등록되지 않은 콘텐츠'로 나타날 수 있습니다)")) return;

    try {
        const response = await fetch(`/api/schedules/${room}`, { method: 'DELETE' });
        if (response.ok) {
            await fetchSchedules();
            renderDevices(currentView);
        } else {
            const err = await response.text();
            alert("삭제 실패: " + err);
        }
    } catch (e) {
        alert("통신 오류: " + e);
    }
}

// Schedule Modal Handlers
function openScheduleModal() {
    document.getElementById('scheduleForm').reset();
    document.getElementById('scheduleModal').style.display = 'block';
}

function closeScheduleModal() {
    document.getElementById('scheduleModal').style.display = 'none';
}

async function createSchedule(event) {
    event.preventDefault();
    const name = document.getElementById('newScheduleName').value.trim();
    if (!name) return;

    // Auto-generate a unique room ID since users don't need to see it
    const room = 'room_' + Date.now();

    // Default days config: weekdays enabled, weekends disabled
    const defaultDays = {};
    ['mon','tue','wed','thu','fri'].forEach(d => { defaultDays[d] = {enabled: true, startTime: '09:00', endTime: '18:00'}; });
    ['sat','sun'].forEach(d => { defaultDays[d] = {enabled: false, startTime: '', endTime: ''}; });

    // Default schedule payload
    const payload = {
        room: room,
        name: name,
        isActive: true,
        startTime: "09:00",
        endTime: "18:00",
        projectorDelay: 5,
        pcDelay: 5,
        daysConfig: JSON.stringify(defaultDays)
    };

    try {
        const res = await fetch(`/api/schedules/${room}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());

        closeScheduleModal();
        alert("새 콘텐츠 스케줄이 추가되었습니다.");
        await fetchSchedules();
    } catch (e) {
        alert("스케줄 추가 실패");
        console.error(e);
    }
}

function saveSettings() {
    // Save settings logic via API
    alert("환경 설정이 성공적으로 저장되었습니다.");
}

function resetSettings() {
    if (confirm('모든 사용자 설정을 초기화하시겠습니까?')) {
        alert('설정이 초기화 되었습니다.');
        // Reset form values to default
        document.querySelector('#page-settings .form-input[value="192.168.1.255"]').value = "192.168.1.255";
        document.querySelector('#page-settings .form-input[type="password"]').value = "12345678";
    }
}

function renderDevices(viewMode = 'room') {
    const container = document.getElementById('dashboard-content');
    container.innerHTML = '';

    if (viewMode === 'room') {
        const rooms = [...new Set(devices.map(d => d.room))];

        rooms.forEach(room => {
            const roomDevices = devices.filter(d => d.room === room).sort((a, b) => {
                if (a.isOn !== b.isOn) return a.isOn ? -1 : 1;
                return a.name.localeCompare(b.name, 'ko-KR', { numeric: true });
            });

            // Search name from schedule
            let roomName = room;
            const sch = schedulesData.find(s => s.room === room);
            if (sch && sch.name) roomName = sch.name;

            const roomIcon = 'ri-building-4-line';

            let scheduleInfo = '';
            if (sch && sch.isActive) {
                // Get today's day key
                const dayKeyMap = ['sun','mon','tue','wed','thu','fri','sat'];
                const todayKey = dayKeyMap[new Date().getDay()];
                let todayStart = sch.startTime;
                let todayEnd = sch.endTime;
                let todayEnabled = true;

                if (sch.daysConfig) {
                    try {
                        const days = JSON.parse(sch.daysConfig);
                        if (days[todayKey]) {
                            todayEnabled = days[todayKey].enabled;
                            if (todayEnabled) {
                                todayStart = days[todayKey].startTime || todayStart;
                                todayEnd = days[todayKey].endTime || todayEnd;
                            }
                        }
                    } catch(e) {}
                }

                if (todayEnabled) {
                    scheduleInfo = `<span class="room-schedule-badge"><i class="ri-time-line"></i> ${todayStart} ~ ${todayEnd}</span>`;
                } else {
                    scheduleInfo = `<span class="room-schedule-badge" style="opacity: 0.5;"><i class="ri-moon-line"></i> 오늘 휴무</span>`;
                }
            }

            let sectionHTML = `
                <section class="device-section">
                    <div class="section-header">
                        <h2>
                            <i class="${roomIcon}"></i> ${roomName} 장비
                            ${scheduleInfo}
                        </h2>
                        <div class="room-actions">
                            <button class="btn btn-sm" onclick="toggleGroup('room', '${room}', true)">전체 켜기</button>
                            <button class="btn btn-sm btn-outline" onclick="toggleGroup('room', '${room}', false)">전체 끄기</button>
                        </div>
                    </div>
                    <div class="device-grid">
            `;

            roomDevices.forEach(device => {
                sectionHTML += generateCardHTML(device);
            });

            sectionHTML += `</div></section>`;
            container.innerHTML += sectionHTML;
        });

    } else if (viewMode === 'type') {
        // Group by Type
        const types = [...new Set(devices.map(d => d.type))];

        types.forEach(type => {
            const typeDevices = devices.filter(d => d.type === type).sort((a, b) => {
                if (a.isOn !== b.isOn) return a.isOn ? -1 : 1;
                return a.name.localeCompare(b.name, 'ko-KR', { numeric: true });
            });
            const typeName = type === 'pc' ? '컴퓨터 (PC)' : '프로젝터';
            const typeIcon = type === 'pc' ? 'ri-computer-line' : 'ri-projector-line';

            let sectionHTML = `
                <section class="device-section">
                    <div class="section-header">
                        <h2><i class="${typeIcon}"></i> ${typeName} 전체</h2>
                        <div class="room-actions">
                            <button class="btn btn-sm" onclick="toggleGroup('type', '${type}', true)">전체 켜기</button>
                            <button class="btn btn-sm btn-outline" onclick="toggleGroup('type', '${type}', false)">전체 끄기</button>
                        </div>
                    </div>
                    <div class="device-grid">
            `;

            typeDevices.forEach(device => {
                sectionHTML += generateCardHTML(device);
            });

            sectionHTML += `</div></section>`;
            container.innerHTML += sectionHTML;
        });
    }
}

function generateCardHTML(device) {
    const iconClass = device.type === 'pc' ? 'ri-computer-line' : 'ri-projector-line';
    const typeClass = device.type === 'projector' ? 'projector-type' : '';
    const onClass = device.isOn ? 'is-on' : '';
    const sch = schedulesData.find(s => s.room === device.room);

    return `
        <div class="device-card ${onClass}" id="card-${device.id}">
            <div class="status-dot"></div>
            <div class="device-header">
                <div class="device-icon ${typeClass}"><i class="${iconClass}"></i></div>
                <div class="device-title">
                    <h4>${device.name}</h4>
                    <span>${device.type.toUpperCase()} / ${sch ? sch.name : device.room}</span>
                </div>
            </div>
            <div class="device-info">
                <div class="info-row">
                    <span>IP</span>
                    <span class="info-val">${device.ip}</span>
                </div>
                <div class="info-row">
                    <span>MAC</span>
                    <span class="info-val">${device.mac}</span>
                </div>
            </div>
            <div class="device-controls" style="justify-content: flex-end; align-items: center; width: 100%; border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 0.5rem;">
                <label class="switch">
                    <input type="checkbox" id="toggle-${device.id}" onchange="toggleDeviceSwitch('${device.id}', this.checked)" ${device.isOn ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            </div>
        </div>
    `;
}

let currentView = 'room';

function switchView(viewType) {
    currentView = viewType;

    // Update tab classes
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const clickedTab = document.querySelector(`.view-tab[onclick="switchView('${viewType}')"]`);
    if (clickedTab) clickedTab.classList.add('active');

    renderDevices(currentView);
}

async function toggleDeviceSwitch(id, forceState) {
    const card = document.getElementById(`card-${id}`);
    const toggle = document.getElementById(`toggle-${id}`);

    if (toggle) toggle.disabled = true; // prevent multi-clicks
    if (card) card.style.opacity = '0.7';

    try {
        await fetch(`/api/devices/${id}/power`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isOn: forceState })
        });
        await fetchDevices();
    } catch (e) {
        console.error("Failed to toggle device:", e);
        // revert toggle on failure
        if (toggle) toggle.checked = !forceState;
    } finally {
        if (toggle) toggle.disabled = false;
        if (card) card.style.opacity = '1';
    }
}

async function toggleDevice(id, forceState) {
    const card = document.getElementById(`card-${id}`);
    if (card) card.style.opacity = '0.7';

    try {
        await fetch(`/api/devices/${id}/power`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isOn: forceState })
        });
        await fetchDevices();
    } catch (e) {
        console.error("Failed to toggle device:", e);
    }

    if (card) card.style.opacity = '1';
}

async function toggleGroup(groupType, groupValue, powerState) {
    try {
        await fetch(`/api/group/power`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupType: groupType, groupValue: groupValue, isOn: powerState })
        });
        await fetchDevices();
    } catch (e) {
        console.error("Failed to toggle group:", e);
    }
}

async function toggleAllPower(powerState) {
    try {
        await fetch(`/api/all/power`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isOn: powerState })
        });
        await fetchDevices();
    } catch (e) {
        console.error("Failed to toggle all devices:", e);
    }
}

function updateStats() {
    const pcCount = devices.filter(d => d.type === 'pc' && d.isOn).length;
    const totalPc = devices.filter(d => d.type === 'pc').length;

    const pjCount = devices.filter(d => d.type === 'projector' && d.isOn).length;
    const totalPj = devices.filter(d => d.type === 'projector').length;

    document.querySelector('.stat-card:nth-child(1) .stat-value').innerHTML = `${pcCount} <span class="stat-total">/ ${totalPc}</span>`;
    document.querySelector('.stat-card:nth-child(2) .stat-value').innerHTML = `${pjCount} <span class="stat-total">/ ${totalPj}</span>`;
}

// Device CRUD Functions

function openDeviceModal(type, id = null) {
    const modal = document.getElementById('deviceModal');
    const title = document.getElementById('modalTitle');
    const macGroup = document.getElementById('macInputGroup');

    document.getElementById('deviceType').value = type;
    document.getElementById('deviceId').value = id || '';

    // Only show MAC input for PCs
    if (type === 'projector') {
        macGroup.style.display = 'none';
        document.getElementById('deviceMac').required = false;
    } else {
        macGroup.style.display = 'block';
        document.getElementById('deviceMac').required = true;
    }

    if (id) {
        title.innerText = type === 'pc' ? 'PC 장비 수정' : '프로젝터 수정';
        const d = devices.find(x => x.id === id);
        if (d) {
            document.getElementById('deviceName').value = d.name;
            document.getElementById('deviceRoom').value = d.room;
            document.getElementById('deviceIp').value = d.ip;
            document.getElementById('deviceMac').value = d.mac !== 'N/A' ? d.mac : '';
        }
    } else {
        title.innerText = type === 'pc' ? 'PC 장비 추가' : '프로젝터 장비 추가';
        document.getElementById('deviceForm').reset();
    }

    modal.style.display = 'block';
}

function closeDeviceModal() {
    document.getElementById('deviceModal').style.display = 'none';
}

// Auto Fetch MAC on IP blur for PC
document.getElementById('deviceIp').addEventListener('blur', async function () {
    const type = document.getElementById('deviceType').value;
    const ip = this.value.trim();
    const macInput = document.getElementById('deviceMac');

    if (type === 'pc' && ip && !macInput.value) {
        // Automatically try to resolve MAC
        try {
            macInput.placeholder = "ARP 검색 중...";
            const res = await fetch(`/api/arp?ip=${ip}`);
            const data = await res.json();
            if (data.success && data.mac) {
                macInput.value = data.mac;
            } else {
                macInput.placeholder = "자동 검색 실패. 수동 입력 필요";
            }
        } catch (e) {
            macInput.placeholder = "검색 오류";
        }
    }
});

async function findMac() {
    const ip = document.getElementById('deviceIp').value;
    if (!ip) {
        alert("먼저 IP 주소를 입력해주세요.");
        return;
    }

    try {
        const res = await fetch(`/api/arp?ip=${ip}`);
        const data = await res.json();
        if (data.success && data.mac) {
            document.getElementById('deviceMac').value = data.mac;
        } else {
            alert("네트워크에서 해당 IP의 MAC 주소를 찾을 수 없습니다. (장비가 켜져있는 상태에서 검색해야 ARP 테이블에 남습니다)");
        }
    } catch (e) {
        alert("MAC 검색 중 오류가 발생했습니다.");
    }
}

async function saveDevice(event) {
    event.preventDefault();

    const id = document.getElementById('deviceId').value;
    const isNew = !id;

    const payload = {
        id: isNew ? 'dev_' + Date.now() : id,
        type: document.getElementById('deviceType').value,
        name: document.getElementById('deviceName').value,
        room: document.getElementById('deviceRoom').value,
        ip: document.getElementById('deviceIp').value,
        mac: document.getElementById('deviceMac').value,
        isOn: false
    };

    try {
        const url = isNew ? '/api/devices' : `/api/devices/${id}`;
        const method = isNew ? 'POST' : 'PUT';

        await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        closeDeviceModal();
        await fetchDevices();
        // optionally refresh tables if we are on the computer or projector page
        renderManagementTables();
    } catch (e) {
        alert("장비 저장에 실패했습니다.");
        console.error(e);
    }
}

async function deleteDevice(id) {
    if (!confirm("정말 이 장비를 삭제하시겠습니까?")) return;

    try {
        const response = await fetch(`/api/devices/${id}`, { method: 'DELETE' });
        if (response.ok) {
            await fetchDevices();
            renderManagementTables();
            renderDevices(currentView);
        } else {
            const err = await response.text();
            alert("삭제 실패: " + err);
        }
    } catch (e) {
        alert("통신 오류: " + e);
    }
}

async function deleteAllDevices(type) {
    try {
        const response = await fetch(`/api/devices?type=${type}`, { method: 'DELETE' });
        if (response.ok) {
            await fetchDevices();
            renderManagementTables();
            renderDevices(currentView);
        } else {
            const err = await response.text();
            alert("전체 삭제 실패: " + err);
        }
    } catch (e) {
        alert("통신 오류: " + e);
    }
}

// Re-render PC/Projector Management tables dynamically
function renderManagementTables() {
    const pcTbody = document.querySelector('#page-computers tbody');
    if (pcTbody) {
        const pcList = devices.filter(d => d.type === 'pc').map(d => {
            const sch = schedulesData.find(s => s.room === d.room);
            const roomName = sch ? sch.name : d.room;
            return { ...d, roomName };
        }).sort((a, b) => {
            if (a.isOn !== b.isOn) return a.isOn ? -1 : 1;
            if (a.roomName !== b.roomName) return a.roomName.localeCompare(b.roomName, 'ko-KR');
            return a.name.localeCompare(b.name, 'ko-KR', { numeric: true });
        });

        pcTbody.innerHTML = pcList.map(d => `
            <tr>
                <td><span class="status-indicator ${d.isOn ? 'status-on' : 'status-off'}"></span></td>
                <td>${d.name}</td>
                <td>${d.roomName}</td>
                <td class="mono-text">${d.ip}</td>
                <td class="mono-text">${d.mac}</td>
                <td><span class="badge badge-success">지원</span></td>
                <td>
                    <button class="btn-icon" onclick="openDeviceModal('pc', '${d.id}')"><i class="ri-edit-line"></i></button>
                    <button class="btn-icon text-danger" onclick="deleteDevice('${d.id}')"><i class="ri-delete-bin-line"></i></button>
                </td>
            </tr>
        `).join('');
    }

    const pjTbody = document.querySelector('#page-projectors tbody');
    if (pjTbody) {
        const pjList = devices.filter(d => d.type === 'projector').map(d => {
            const sch = schedulesData.find(s => s.room === d.room);
            const roomName = sch ? sch.name : d.room;
            return { ...d, roomName };
        }).sort((a, b) => {
            if (a.isOn !== b.isOn) return a.isOn ? -1 : 1;
            if (a.roomName !== b.roomName) return a.roomName.localeCompare(b.roomName, 'ko-KR');
            return a.name.localeCompare(b.name, 'ko-KR', { numeric: true });
        });

        pjTbody.innerHTML = pjList.map(d => `
            <tr>
                <td><span class="status-indicator ${d.isOn ? 'status-on' : 'status-off'}"></span></td>
                <td>${d.name}</td>
                <td>${d.roomName}</td>
                <td class="mono-text">${d.ip}</td>
                <td class="mono-text">${d.mac}</td>
                <td><span class="badge ${d.isOn ? 'badge-success' : 'badge-warning'}">${d.isOn ? '정상' : '대기'}</span></td>
                <td>
                    <button class="btn-icon" onclick="openDeviceModal('projector', '${d.id}')"><i class="ri-edit-line"></i></button>
                    <button class="btn-icon text-danger" onclick="deleteDevice('${d.id}')"><i class="ri-delete-bin-line"></i></button>
                </td>
            </tr>
        `).join('');
    }
}

function updateStats() {
    const pcs = devices.filter(d => d.type === 'pc');
    const pjs = devices.filter(d => d.type === 'projector');

    const pcOn = pcs.filter(d => d.isOn).length;
    const pjOn = pjs.filter(d => d.isOn).length;

    const elPcVal = document.getElementById('stat-pc-val');
    if (elPcVal) elPcVal.innerHTML = `${pcOn} <span class="stat-total" id="stat-pc-total">/ ${pcs.length}</span>`;

    const elPjVal = document.getElementById('stat-pj-val');
    if (elPjVal) elPjVal.innerHTML = `${pjOn} <span class="stat-total" id="stat-pj-total">/ ${pjs.length}</span>`;

    const activeSchedules = schedulesData.filter(s => s.isActive);
    const elSchActive = document.getElementById('stat-sch-active');
    if (elSchActive) {
        if (activeSchedules.length > 0) {
            elSchActive.style.display = 'inline-block';
            elSchActive.innerText = `${activeSchedules.length}개 활성`;
        } else {
            elSchActive.style.display = 'none';
        }
    }

    // Find next schedule — check today first, then look ahead up to 7 days
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let nextEvent = null;
    let minDiff = Infinity;

    const dayKeyMap = ['sun','mon','tue','wed','thu','fri','sat'];
    const dayLabelMap = ['일','월','화','수','목','금','토'];

    // Helper: get day config for a schedule on a given day key
    function getDayTimes(s, dayKey) {
        let startTime = s.startTime, endTime = s.endTime, enabled = true;
        if (s.daysConfig) {
            try {
                const days = JSON.parse(s.daysConfig);
                if (days[dayKey]) {
                    enabled = days[dayKey].enabled;
                    if (enabled) {
                        startTime = days[dayKey].startTime || startTime;
                        endTime = days[dayKey].endTime || endTime;
                    }
                }
            } catch(e) {}
        }
        return { enabled, startTime, endTime };
    }

    // 1) Check remaining events TODAY
    const todayKey = dayKeyMap[now.getDay()];
    activeSchedules.forEach(s => {
        const dt = getDayTimes(s, todayKey);
        if (!dt.enabled) return;

        const [sh, sm] = dt.startTime.split(':').map(Number);
        const startTotal = sh * 60 + sm;
        if (startTotal > currentMinutes && (startTotal - currentMinutes) < minDiff) {
            minDiff = startTotal - currentMinutes;
            nextEvent = { name: s.name || s.room, type: '켜기(ON)', time: dt.startTime, isStart: true, dayLabel: '' };
        }

        const [eh, em] = dt.endTime.split(':').map(Number);
        const endTotal = eh * 60 + em;
        if (endTotal > currentMinutes && (endTotal - currentMinutes) < minDiff) {
            minDiff = endTotal - currentMinutes;
            nextEvent = { name: s.name || s.room, type: '종료(OFF)', time: dt.endTime, isStart: false, dayLabel: '' };
        }
    });

    // 2) If nothing left today, search next 7 days
    if (!nextEvent) {
        for (let offset = 1; offset <= 7; offset++) {
            const futureDay = (now.getDay() + offset) % 7;
            const futureKey = dayKeyMap[futureDay];
            const futureDayLabel = offset === 1 ? '내일' : `${dayLabelMap[futureDay]}요일`;

            let earliestTime = null;
            let earliestName = '';

            activeSchedules.forEach(s => {
                const dt = getDayTimes(s, futureKey);
                if (!dt.enabled) return;
                if (!earliestTime || dt.startTime < earliestTime) {
                    earliestTime = dt.startTime;
                    earliestName = s.name || s.room;
                }
            });

            if (earliestTime) {
                nextEvent = { name: earliestName, type: '켜기(ON)', time: earliestTime, isStart: true, dayLabel: futureDayLabel };
                break;
            }
        }
    }

    const elNextLabel = document.getElementById('stat-sch-next-label');
    const elNextName = document.getElementById('stat-sch-next-name');
    const elNextTime = document.getElementById('stat-sch-next-time');

    if (nextEvent) {
        const prefix = nextEvent.dayLabel ? `${nextEvent.dayLabel} ` : '';
        if (elNextLabel) elNextLabel.innerText = `다가오는 예약 (${prefix}${nextEvent.type})`;
        if (elNextName) elNextName.innerText = nextEvent.name;
        if (elNextTime) {
            elNextTime.innerText = `${nextEvent.dayLabel ? nextEvent.dayLabel + ' ' : ''}${nextEvent.time}`;
            elNextTime.style.color = nextEvent.isStart ? 'var(--primary-color)' : 'var(--danger-color)';
        }
    } else {
        if (elNextLabel) elNextLabel.innerText = '다가오는 일정 없음';
        if (elNextName) elNextName.innerText = '-';
        if (elNextTime) {
            elNextTime.innerText = '-';
            elNextTime.style.color = 'var(--text-secondary)';
        }
    }
}

function navigateToType(type) {
    // Navigate to dashboard
    document.querySelector('.nav-item[data-page="dashboard"]').click();

    // Switch to 'type' view
    switchView('type');

    // Smooth scroll to target section
    setTimeout(() => {
        const headerText = type === 'pc' ? '컴퓨터 (PC) 전체' : '프로젝터 전체';
        const headers = document.querySelectorAll('.section-header h2');
        for (const h of headers) {
            if (h.innerText.includes(headerText)) {
                h.closest('.device-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
                break;
            }
        }
    }, 150);
}
