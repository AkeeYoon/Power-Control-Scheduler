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
        if (apiPortInput && data.activePort) {
            apiPortInput.value = data.activePort;
        }

        const broadcastIpInput = document.getElementById('settingsBroadcastIp');
        if (broadcastIpInput && data.broadcastIp) {
            broadcastIpInput.value = data.broadcastIp;
        }
    } catch (e) {
        console.error("Failed to load settings:", e);
    }
}

async function saveSettings() {
    const globalToggle = document.getElementById('globalSchedulerToggle');
    const apiPortInput = document.getElementById('settingsApiPort');
    const broadcastIpInput = document.getElementById('settingsBroadcastIp');
    
    if (!globalToggle || !apiPortInput || !broadcastIpInput) return;
    
    const payload = {
        schedulerEnabled: globalToggle.checked,
        preferredPort: parseInt(apiPortInput.value) || 8080,
        broadcastIp: broadcastIpInput.value.trim() || "192.168.1.255"
    };

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error("Settings save failed");
        
        const data = await res.json();
        if (data.needsRestart) {
            alert("포트 설정이 변경되어 서버를 자동으로 재시작합니다.\n브라우저 주소창의 포트 번호를 새 번호로 변경하여 다시 접속해 주세요.");
            // UI could redirect, but since we don't know the exact new IP if it runs remotely, user has to change URL
        } else {
            alert("환경 설정이 성공적으로 저장되었습니다.");
        }
    } catch (e) {
        console.error("Failed to save settings:", e);
        alert("설정 저장에 실패했습니다.");
    }
}

async function toggleGlobalScheduler(enabled) {
    // Keep this function working for the direct toggle button, just trigger saveSettings indirectly
    await saveSettings();
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
            schedules.forEach(s => {
                const numDevices = devices.filter(d => d.room === s.room).length;
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
                                <h4 class="setting-label">운영 시간 설정</h4>
                                <div class="time-inputs">
                                    <div class="time-field">
                                        <span>시작 (ON)</span>
                                        <input type="time" id="sch_start_${s.room}" value="${s.startTime}" class="time-picker">
                                    </div>
                                    <i class="ri-arrow-right-line time-divider"></i>
                                    <div class="time-field">
                                        <span>종료 (OFF)</span>
                                        <input type="time" id="sch_end_${s.room}" value="${s.endTime}" class="time-picker">
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
    const payload = {
        room: room,
        name: document.getElementById(`sch_name_${room}`).value,
        isActive: document.getElementById(`sch_active_${room}`).checked,
        startTime: document.getElementById(`sch_start_${room}`).value,
        endTime: document.getElementById(`sch_end_${room}`).value,
        projectorDelay: parseInt(document.getElementById(`sch_pj_delay_${room}`).value) || 0,
        pcDelay: parseInt(document.getElementById(`sch_pc_delay_${room}`).value) || 0
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

    // Default schedule payload
    const payload = {
        room: room,
        name: name,
        isActive: true,
        startTime: "09:00",
        endTime: "18:00",
        projectorDelay: 5,
        pcDelay: 5
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
                scheduleInfo = `<span class="room-schedule-badge"><i class="ri-time-line"></i> ${sch.startTime} ~ ${sch.endTime}</span>`;
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

    // Find next schedule
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let nextEvent = null;
    let minDiff = 24 * 60; // Max possible diff is 24 hours

    activeSchedules.forEach(s => {
        // Parse Start Time
        const [startH, startM] = s.startTime.split(':').map(Number);
        const startTotal = startH * 60 + startM;
        let diffStart = startTotal - currentMinutes;
        if (diffStart < 0) diffStart += 24 * 60; // Next day
        if (diffStart < minDiff && diffStart !== 0) {
            minDiff = diffStart;
            nextEvent = { name: s.name || s.room, type: '켜기(ON)', time: s.startTime, isStart: true };
        }

        // Parse End Time
        const [endH, endM] = s.endTime.split(':').map(Number);
        const endTotal = endH * 60 + endM;
        let diffEnd = endTotal - currentMinutes;
        if (diffEnd < 0) diffEnd += 24 * 60;
        if (diffEnd < minDiff && diffEnd !== 0) {
            minDiff = diffEnd;
            nextEvent = { name: s.name || s.room, type: '종료(OFF)', time: s.endTime, isStart: false };
        }
    });

    const elNextLabel = document.getElementById('stat-sch-next-label');
    const elNextName = document.getElementById('stat-sch-next-name');
    const elNextTime = document.getElementById('stat-sch-next-time');

    if (nextEvent) {
        if (elNextLabel) elNextLabel.innerText = `다가오는 예약 (${nextEvent.type})`;
        if (elNextName) elNextName.innerText = nextEvent.name;
        if (elNextTime) {
            elNextTime.innerText = nextEvent.time;
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
