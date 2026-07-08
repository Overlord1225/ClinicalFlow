import { getCurrentUser, requireAuth } from './auth.js';
import {
  getStudent, getProgress, getSchedules, getNotifications,
  getAvailableSlots, markRead, getAllSchedules, logout,
  claimSlot, sendAnnouncement, markAbsent,
  getStudentProgressSummary, getHospitalUtilization,
  getUpcomingSchedule, verifyGPS, recordAttendance, updateAttendance, getAttendanceForSchedule,
  getStudents, getCIs, getHospitals, getDepartmentsByHospital,
  createSchedule, updateSchedule, deleteSchedule,
  markAttendanceManually,
  ensureAdminAccount,
  signIn,
  createUserByAdmin,
  getRecommendationsForSlot,
  getCaseLibrary,
  getAllUsers,
  supabase
} from './data.js';
import { showToast, showLoading, hideLoading } from './utils.js';

let notifSubscription = null;

export function renderSidebar(activePage) {
  const user = getCurrentUser();
  if (!user) return '';
  const role = user.role;
  let navItems = [];

  if (role === 'student') {
    navItems = [
      { label: 'Dashboard', icon: 'fa-house', page: 'student-dashboard.html' },
      { label: 'Case Passport', icon: 'fa-passport', page: 'case-passport.html' },
      { label: 'Opportunity Board', icon: 'fa-bullhorn', page: 'opportunity-board.html' },
      { label: 'Attendance', icon: 'fa-fingerprint', page: 'attendance.html' },
      { label: 'Notifications', icon: 'fa-bell', page: 'notifications.html' },
    ];
  } else if (role === 'scheduler' || role === 'admin') {
    navItems = [
      { label: 'Dashboard', icon: 'fa-gauge-high', page: role === 'scheduler' ? 'scheduler-dashboard.html' : 'admin.html' },
      { label: 'Schedule Management', icon: 'fa-calendar-plus', page: 'schedule-management.html' },
      { label: 'AI Matchmaker', icon: 'fa-robot', page: 'ai-matchmaker.html' },
      { label: 'Attendance', icon: 'fa-fingerprint', page: 'attendance.html' },
      { label: 'Notifications', icon: 'fa-bell', page: 'notifications.html' },
    ];
  } else if (role === 'ci') {
    navItems = [
      { label: 'Dashboard', icon: 'fa-house', page: 'ci-dashboard.html' },
      { label: 'Attendance', icon: 'fa-fingerprint', page: 'attendance.html' },
      { label: 'Notifications', icon: 'fa-bell', page: 'notifications.html' },
    ];
  }

  let html = `<div class="sidebar">
    <div class="brand">Clinical<span>Flow</span></div>`;
  navItems.forEach(item => {
    const active = item.page === activePage ? 'active' : '';
    html += `<a href="${item.page}" class="nav-item ${active}"><i class="fas ${item.icon}"></i><span>${item.label}</span>`;
    if (item.page === 'notifications.html') {
      html += `<span id="sidebarNotifBadge" class="badge-count" style="display:none;">0</span>`;
    }
    html += `</a>`;
  });
  html += `<div class="nav-item logout" onclick="window.logoutUser()"><i class="fas fa-sign-out-alt"></i><span>Logout</span></div>`;
  html += `</div>`;
  return html;
}

export function updateNotifBadge(count) {
  const badge = document.getElementById('sidebarNotifBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

export function subscribeToNotifications(userId) {
  if (notifSubscription) {
    notifSubscription.unsubscribe();
    notifSubscription = null;
  }

  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const newNotif = payload.new;
        const container = document.getElementById('notifList');
        if (container) {
          const notifItem = document.createElement('div');
          notifItem.className = `notif-item unread`;
          notifItem.dataset.id = newNotif.id;
          notifItem.innerHTML = `
            <span class="notif-text">${newNotif.message}</span>
            <span class="notif-time">${new Date(newNotif.created_at).toLocaleString()}</span>
          `;
          notifItem.onclick = () => markNotifRead(newNotif.id);
          container.prepend(notifItem);
          const emptyMsg = container.querySelector('p');
          if (emptyMsg) emptyMsg.remove();
        }

        const currentCount = parseInt(document.getElementById('sidebarNotifBadge')?.textContent || '0');
        updateNotifBadge(currentCount + 1);

        if (newNotif.type === 'absence' || newNotif.type === 'schedule_change') {
          showToast('🔔 ' + newNotif.message, 'info', 5000);
        }
      }
    )
    .subscribe();

  notifSubscription = channel;
}

export async function markNotifRead(notifId) {
  try {
    await markRead(notifId);
    const item = document.querySelector(`.notif-item[data-id="${notifId}"]`);
    if (item) item.classList.remove('unread');
    const badge = document.getElementById('sidebarNotifBadge');
    if (badge) {
      const current = parseInt(badge.textContent) || 0;
      if (current > 0) updateNotifBadge(current - 1);
    }
  } catch (err) {
    showToast('Error marking as read: ' + err.message, 'error');
  }
}

// ============================================================
// ATTENDANCE (BIOMETRIC)
// ============================================================

let faceMesh = null;
let camera = null;
let videoElement = null;
let blinkDetected = false;
let attendanceState = { timeIn: null, timeOut: null, schedule: null, attendanceId: null };

export async function initAttendance() {
  const user = requireAuth();
  if (!user) return;

  const container = document.getElementById('attendanceContainer');
  if (!container) return;

  try {
    showLoading('attendanceContainer', 'Loading your duty...');

    const schedule = await getUpcomingSchedule(user.id);
    if (!schedule) {
      container.innerHTML = '<p>No upcoming duty. Please check your schedule.</p>';
      return;
    }

    attendanceState.schedule = schedule;

    document.getElementById('dutyTitle').textContent = `${schedule.case_type || 'Duty'} – ${schedule.hospital?.name || 'N/A'}`;
    document.getElementById('dutyDetails').innerHTML = `
      <strong>Date:</strong> ${schedule.date} &nbsp;|&nbsp; 
      <strong>Time:</strong> ${schedule.start_time} – ${schedule.end_time} &nbsp;|&nbsp; 
      <strong>CI:</strong> ${schedule.ciName}
    `;

    const existing = await getAttendanceForSchedule(schedule.id, user.id);
    if (existing) {
      attendanceState.attendanceId = existing.id;
      if (existing.time_in) {
        attendanceState.timeIn = existing.time_in;
        document.getElementById('timeInBtn').disabled = true;
        document.getElementById('timeOutBtn').disabled = false;
        document.getElementById('gpsStatus').classList.add('verified');
        document.getElementById('gpsText').textContent = '✔ Verified (Time In)';
        document.getElementById('faceStatus').classList.add('verified');
        document.getElementById('faceText').textContent = '✔ Verified (Time In)';
        const timeInDate = new Date(existing.time_in);
        document.getElementById('timerDisplay').textContent = timeInDate.toLocaleTimeString();
        if (existing.time_out) {
          attendanceState.timeOut = existing.time_out;
          document.getElementById('timeOutBtn').disabled = true;
          document.getElementById('timerDisplay').textContent = 
            `${new Date(existing.time_in).toLocaleTimeString()} → ${new Date(existing.time_out).toLocaleTimeString()}`;
        }
      }
    }

    await setupCamera();

    hideLoading('attendanceContainer');
    showToast('Ready for biometric verification', 'success', 2000);

  } catch (err) {
    console.error('Attendance init error:', err);
    hideLoading('attendanceContainer');
    container.innerHTML = `<p>Error loading duty: ${err.message}</p>`;
  }
}

async function setupCamera() {
  videoElement = document.getElementById('video');
  if (!videoElement) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    videoElement.srcObject = stream;
    await videoElement.play();

    faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    faceMesh.onResults(onFaceResults);

    const cameraUtils = new Camera(videoElement, {
      onFrame: async () => {
        await faceMesh.send({ image: videoElement });
      },
      width: 640,
      height: 480
    });
    await cameraUtils.start();

    document.getElementById('cameraOverlay').style.display = 'none';
  } catch (err) {
    console.error('Camera error:', err);
    showToast('Could not access camera: ' + err.message, 'error');
  }
}

let eyeOpen = true;
let blinkCount = 0;
let lastBlinkTime = 0;

function onFaceResults(results) {
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    document.getElementById('faceText').textContent = 'No face detected';
    document.getElementById('faceStatus').className = 'face-status failed';
    return;
  }

  const landmarks = results.multiFaceLandmarks[0];
  const leftEye = [33, 133, 160, 159, 158, 144];
  const rightEye = [362, 263, 387, 386, 385, 380];
  const earLeft = getEAR(landmarks, leftEye);
  const earRight = getEAR(landmarks, rightEye);
  const ear = (earLeft + earRight) / 2;

  const threshold = 0.2;
  const currentTime = Date.now();

  if (ear < threshold && eyeOpen) {
    eyeOpen = false;
  } else if (ear >= threshold && !eyeOpen) {
    eyeOpen = true;
    if (currentTime - lastBlinkTime > 300) {
      blinkCount++;
      lastBlinkTime = currentTime;
      document.getElementById('faceText').textContent = `Blink detected (${blinkCount})`;
      if (blinkCount >= 1) {
        blinkDetected = true;
        document.getElementById('faceStatus').className = 'face-status verified';
        document.getElementById('faceText').textContent = '✔ Liveness passed';
        showToast('Liveness verified!', 'success', 2000);
      }
    }
  }
}

function getEAR(landmarks, indices) {
  const p1 = landmarks[indices[0]];
  const p2 = landmarks[indices[1]];
  const p3 = landmarks[indices[2]];
  const p4 = landmarks[indices[3]];
  const p5 = landmarks[indices[4]];
  const p6 = landmarks[indices[5]];
  const dist1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const dist2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  const dist3 = Math.hypot(p1.x - p4.x, p1.y - p4.y);
  return (dist1 + dist2) / (2 * dist3);
}

// ---- Attendance actions ----
export async function performTimeIn() {
  const user = getCurrentUser();
  if (!user) return;
  const schedule = attendanceState.schedule;
  if (!schedule) { showToast('No duty loaded', 'error'); return; }

  const btn = document.getElementById('timeInBtn');
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    document.getElementById('gpsText').textContent = 'Checking location...';
    const gpsResult = await verifyGPS(user.id, schedule.id);
    if (!gpsResult.within) {
      showToast(`You are ${Math.round(gpsResult.distance)}m away. Must be within ${gpsResult.radius}m.`, 'error');
      btn.disabled = false;
      btn.textContent = 'Time In';
      return;
    }
    document.getElementById('gpsStatus').className = 'gps-status verified';
    document.getElementById('gpsText').textContent = `✔ Verified (${Math.round(gpsResult.distance)}m within ${gpsResult.radius}m)`;

    document.getElementById('faceText').textContent = 'Looking for face & blink...';
    let attempts = 0;
    while (!blinkDetected && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }
    if (!blinkDetected) {
      showToast('No blink detected. Please blink to verify liveness.', 'error');
      btn.disabled = false;
      btn.textContent = 'Time In';
      return;
    }

    const now = new Date().toISOString();
    const scheduleStart = new Date(`${schedule.date}T${schedule.start_time}`).getTime();
    const nowTime = new Date(now).getTime();
    const status = (nowTime - scheduleStart) <= 15 * 60 * 1000 ? 'on_time' : 'late';

    await recordAttendance(
      schedule.id,
      user.id,
      now,
      null,
      { in: { lat: gpsResult.position.lat, lng: gpsResult.position.lng, accuracy: gpsResult.position.accuracy } },
      true,
      true,
      'biometric',
      status
    );

    attendanceState.timeIn = now;
    document.getElementById('timeInBtn').disabled = true;
    document.getElementById('timeOutBtn').disabled = false;
    document.getElementById('timerDisplay').textContent = new Date(now).toLocaleTimeString();

    showToast(`Time In recorded (${status})`, 'success', 3000);
  } catch (err) {
    console.error('Time In error:', err);
    showToast('Time In failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Time In';
  }
}

export async function performTimeOut() {
  const user = getCurrentUser();
  if (!user) return;
  const schedule = attendanceState.schedule;
  if (!schedule) { showToast('No duty loaded', 'error'); return; }

  const btn = document.getElementById('timeOutBtn');
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    document.getElementById('gpsText').textContent = 'Checking location for Time Out...';
    const gpsResult = await verifyGPS(user.id, schedule.id);
    if (!gpsResult.within) {
      showToast(`You are ${Math.round(gpsResult.distance)}m away. Must be within ${gpsResult.radius}m.`, 'error');
      btn.disabled = false;
      btn.textContent = 'Time Out';
      return;
    }
    document.getElementById('gpsStatus').className = 'gps-status verified';
    document.getElementById('gpsText').textContent = `✔ Verified (${Math.round(gpsResult.distance)}m within ${gpsResult.radius}m)`;

    blinkDetected = false;
    blinkCount = 0;
    document.getElementById('faceText').textContent = 'Look at camera and blink...';
    let attempts = 0;
    while (!blinkDetected && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }
    if (!blinkDetected) {
      showToast('No blink detected. Please blink to verify liveness.', 'error');
      btn.disabled = false;
      btn.textContent = 'Time Out';
      return;
    }

    const now = new Date().toISOString();
    await updateAttendance(schedule.id, user.id, {
      time_out: now,
      gps_out: { lat: gpsResult.position.lat, lng: gpsResult.position.lng, accuracy: gpsResult.position.accuracy }
    });

    attendanceState.timeOut = now;
    document.getElementById('timeOutBtn').disabled = true;
    document.getElementById('timerDisplay').textContent = 
      `${new Date(attendanceState.timeIn).toLocaleTimeString()} → ${new Date(now).toLocaleTimeString()}`;

    showToast('Time Out recorded. Duty complete!', 'success', 3000);
  } catch (err) {
    console.error('Time Out error:', err);
    showToast('Time Out failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Time Out';
  }
}

// ---- Attach event listeners ----
document.addEventListener('DOMContentLoaded', () => {
  const timeInBtn = document.getElementById('timeInBtn');
  if (timeInBtn) timeInBtn.addEventListener('click', performTimeIn);

  const timeOutBtn = document.getElementById('timeOutBtn');
  if (timeOutBtn) timeOutBtn.addEventListener('click', performTimeOut);

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    window.location.reload();
  });
});

window.performTimeIn = performTimeIn;
window.performTimeOut = performTimeOut;

// ============================================================
// DASHBOARD INITIALIZATION FUNCTIONS
// ============================================================

export async function initStudentDashboard() {
  const user = requireAuth();
  if (!user || user.role !== 'student') return;
  showLoading('recentNotifs', 'Loading your dashboard...');

  try {
    const student = await getStudent(user.id);
    const progress = await getProgress(user.id);
    const schedules = await getSchedules(user.id);
    const notifs = await getNotifications(user.id);
    const unread = notifs.filter(n => !n.read).length;
    updateNotifBadge(unread);
    subscribeToNotifications(user.id);

    document.getElementById('studentName').textContent = student.name;
    document.getElementById('studentProgram').textContent = student.program;

    const total = progress.cases.length;
    const completed = progress.cases.filter(c => c.status === 'complete').length;
    document.getElementById('totalCases').textContent = total;
    document.getElementById('completedCases').textContent = completed;
    document.getElementById('pendingCases').textContent = total - completed;
    document.getElementById('unreadBadge').textContent = unread;

    const upcoming = schedules.filter(s => s.status === 'scheduled');
    const tbody = document.getElementById('upcomingTable');
    tbody.innerHTML = upcoming.map(s => `
      <tr><td>${s.date}</td><td>${s.hospital}</td><td>${s.case_type}</td><td><span class="status-badge scheduled">Scheduled</span></td></tr>
    `).join('') || '<tr><td colspan="4">No upcoming duties</td></tr>';

    const notifList = document.getElementById('recentNotifs');
    notifList.innerHTML = notifs.slice(0, 3).map(n => `
      <div class="notif-item ${n.read?'':'unread'}">
        <span class="notif-text">${n.message}</span>
        <span class="notif-time">${new Date(n.created_at).toLocaleString()}</span>
      </div>
    `).join('') || '<p>No notifications</p>';

    hideLoading('recentNotifs');
    showToast('Dashboard loaded successfully', 'success', 2000);
  } catch (err) {
    console.error('Student dashboard error:', err);
    hideLoading('recentNotifs');
    showToast('Failed to load dashboard: ' + err.message, 'error');
  }
}

export async function initSchedulerDashboard() {
  try {
    const user = requireAuth();
    if (!user || (user.role !== 'scheduler' && user.role !== 'admin')) return;
    showLoading('allSchedTable', 'Loading schedules...');

    document.getElementById('schName').textContent = user.name;

    const allSched = await getAllSchedules();
    const slots = await getAvailableSlots();
    const completed = allSched.filter(s => s.status === 'completed').length;

    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'student');
    if (error) throw error;
    const totalStudents = count || 0;

    document.getElementById('statStudents').textContent = totalStudents;
    document.getElementById('statSlots').textContent = slots.length;
    document.getElementById('statSched').textContent = allSched.length;
    document.getElementById('statCompleted').textContent = completed;

    const tbody = document.getElementById('allSchedTable');
    tbody.innerHTML = allSched.map(s => `
      <tr><td>${s.studentName}</td><td>${s.date}</td><td>${s.hospital}</td><td>${s.case_type}</td><td><span class="status-badge ${s.status}">${s.status}</span></td></tr>
    `).join('');

    hideLoading('allSchedTable');
    showToast('Scheduler data loaded', 'success', 2000);
  } catch (err) {
    console.error('Scheduler dashboard error:', err);
    hideLoading('allSchedTable');
    showToast('Error loading scheduler data: ' + err.message, 'error');
  }
}

export async function initCIDashboard() {
  try {
    const user = requireAuth();
    if (!user || user.role !== 'ci') return;
    showLoading('ciStudentsTable', 'Loading students...');

    document.getElementById('ciName').textContent = user.name;

    const { data: students, error } = await supabase
      .from('users')
      .select('name, program, students(year)')
      .eq('role', 'student');
    if (error) throw error;

    const tbody = document.getElementById('ciStudentsTable');
    tbody.innerHTML = (students && students.length > 0)
      ? students.map(s => `
        <tr><td>${s.name}</td><td>${s.program || 'BSN'}</td><td>${s.students?.[0]?.year || 'N/A'}</td><td><span class="status-badge scheduled">Active</span></td></tr>
      `).join('')
      : '<tr><td colspan="4">No students assigned</td></tr>';

    hideLoading('ciStudentsTable');
    showToast('CI dashboard loaded', 'success', 2000);
  } catch (err) {
    console.error('CI dashboard error:', err);
    hideLoading('ciStudentsTable');
    showToast('Error loading CI data: ' + err.message, 'error');
  }
}

export async function initAdminAnalytics() {
  const user = requireAuth();
  if (!user || user.role !== 'admin') return;

  document.getElementById('adminName').textContent = user.name;

  const firstContainer = document.getElementById('lackingCases');
  try {
    showLoading('lackingCases', 'Loading analytics...');

    const students = await getStudentProgressSummary();
    document.getElementById('statStudents').textContent = students.length;
    const slots = await getAvailableSlots();
    document.getElementById('statSlots').textContent = slots.length;
    const allSched = await getAllSchedules();
    document.getElementById('statSched').textContent = allSched.length;
    document.getElementById('statCompleted').textContent = allSched.filter(s => s.status === 'completed').length;

    const lacking = students.filter(s => s.percentage < 100);
    const lackingContainer = document.getElementById('lackingCases');
    lackingContainer.innerHTML = lacking.map(s => `
      <tr><td>${s.name}</td><td>${s.program}</td><td>${s.completed}/${s.total}</td><td>${s.percentage}%</td></tr>
    `).join('') || '<tr><td colspan="4">All students have completed all cases.</td></tr>';

    const nearing = students.filter(s => s.percentage >= 80 && s.percentage < 100);
    const nearingContainer = document.getElementById('nearingCompletion');
    nearingContainer.innerHTML = nearing.map(s => `
      <tr><td>${s.name}</td><td>${s.program}</td><td>${s.completed}/${s.total}</td><td>${s.percentage}%</td></tr>
    `).join('') || '<tr><td colspan="4">No students nearing completion.</td></tr>';

    const excessive = students.filter(s => s.absences > 2);
    const absContainer = document.getElementById('excessiveAbsences');
    absContainer.innerHTML = excessive.map(s => `
      <tr><td>${s.name}</td><td>${s.program}</td><td>${s.absences}</td></tr>
    `).join('') || '<tr><td colspan="3">No students with excessive absences.</td></tr>';

    const hospitalCount = {};
    slots.forEach(s => { hospitalCount[s.hospital] = (hospitalCount[s.hospital] || 0) + 1; });
    const sortedHospitals = Object.entries(hospitalCount).sort((a,b) => b[1] - a[1]);
    const hospContainer = document.getElementById('openOpportunities');
    hospContainer.innerHTML = sortedHospitals.map(([hospital, count]) => `
      <tr><td>${hospital}</td><td>${count}</td></tr>
    `).join('') || '<tr><td colspan="2">No open opportunities.</td></tr>';

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const { data: upcoming, error } = await supabase
      .from('schedules')
      .select('*, users(name), hospital:hospital_id (name)')
      .gte('date', today.toISOString().split('T')[0])
      .lte('date', nextWeek.toISOString().split('T')[0])
      .eq('status', 'scheduled');
    const upcomingContainer = document.getElementById('upcomingDuties');
    upcomingContainer.innerHTML = (upcoming && upcoming.length) ? upcoming.map(s => `
      <tr><td>${s.users?.name || 'Unknown'}</td><td>${s.date}</td><td>${s.hospital?.name || 'Unknown'}</td><td>${s.case_type}</td></tr>
    `).join('') : '<tr><td colspan="4">No upcoming duties.</td></tr>';

    hideLoading('lackingCases');
    showToast('Analytics loaded successfully', 'success', 2000);
  } catch (err) {
    console.error('Admin analytics error:', err);
    hideLoading('lackingCases');
    showToast('Error loading analytics: ' + err.message, 'error');
  }
}

export async function initOpportunityBoard() {
  const user = requireAuth();
  if (!user || user.role !== 'student') return;

  const container = document.getElementById('opportunityContainer');
  try {
    showLoading('opportunityContainer', 'Loading available slots...');
    const slots = await getAvailableSlots();
    if (!slots || slots.length === 0) {
      container.innerHTML = '<p>No open slots available at the moment.</p>';
    } else {
      container.innerHTML = slots.map(slot => `
        <div class="opportunity-card">
          <div class="slot-info">
            <strong>${slot.case_type}</strong> @ ${slot.hospital} (${slot.date})
          </div>
          <div class="slot-actions">
            <button class="claim-btn" data-slot-id="${slot.id}">Claim Now</button>
          </div>
        </div>
      `).join('');
    }

    container.querySelectorAll('.claim-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slotId = btn.dataset.slotId;
        try {
          btn.disabled = true;
          btn.textContent = 'Claiming...';
          await claimSlot(slotId, user.id);
          showToast('Slot claimed successfully!', 'success');
          initOpportunityBoard();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Claim Now';
          showToast('Failed to claim slot: ' + err.message, 'error');
        }
      });
    });
    hideLoading('opportunityContainer');
  } catch (err) {
    console.error('Opportunity board error:', err);
    hideLoading('opportunityContainer');
    showToast('Error loading opportunities: ' + err.message, 'error');
  }
}

export async function initHeatmap() {
  const user = requireAuth();
  if (!user || (user.role !== 'scheduler' && user.role !== 'admin')) return;

  const container = document.getElementById('heatmapContainer');
  try {
    showLoading('heatmapContainer', 'Generating heatmap...');
    const utilization = await getHospitalUtilization();

    const caseTypes = new Set();
    Object.values(utilization).forEach(hospital => {
      Object.keys(hospital).forEach(caseType => caseTypes.add(caseType));
    });
    const caseList = Array.from(caseTypes).sort();

    let html = '<table class="heatmap-table"><thead><tr><th>Hospital</th>';
    caseList.forEach(c => { html += `<th>${c}</th>`; });
    html += '</tr></thead><tbody>';

    Object.entries(utilization).forEach(([hospital, cases]) => {
      html += `<tr><td><strong>${hospital}</strong></td>`;
      caseList.forEach(caseType => {
        const data = cases[caseType] || { total: 0, completed: 0 };
        const completion = data.total ? Math.round((data.completed / data.total) * 100) : 0;
        const color = completion >= 80 ? '#dcfce7' :
                      completion >= 50 ? '#fef9c3' :
                      completion >= 20 ? '#fed7aa' : '#fecaca';
        html += `<td style="background-color:${color}; text-align:center; padding:6px;">
          ${data.total} (${completion}%)
        </td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
    hideLoading('heatmapContainer');
  } catch (err) {
    console.error('Heatmap error:', err);
    hideLoading('heatmapContainer');
    showToast('Error loading heatmap: ' + err.message, 'error');
  }
}

export function initSendAnnouncement() {
  const user = requireAuth();
  if (!user || (user.role !== 'scheduler' && user.role !== 'ci' && user.role !== 'admin')) return;

  const form = document.getElementById('announcementForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('announcementMessage').value;
    if (!message) {
      showToast('Please enter a message.', 'warning');
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      const count = await sendAnnouncement(message, user.id, 'student');
      showToast(`Announcement sent to ${count} students.`, 'success');
      form.reset();
    } catch (err) {
      showToast('Failed to send announcement: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Broadcast to Students';
    }
  });
}

export async function initAbsenceMarking() {
  const user = requireAuth();
  if (!user || user.role !== 'ci') return;

  const container = document.getElementById('ciDutiesTable');
  try {
    showLoading('ciDutiesTable', 'Loading duties...');
    
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select(`
        id,
        date,
        start_time,
        end_time,
        case_type,
        student:student_id (id, name),
        hospital:hospital_id (name),
        department:department_id (name),
        attendance!left(status, time_in, time_out)
      `)
      .eq('ci_id', user.id)
      .in('status', ['scheduled', 'in_progress'])
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true });
    if (error) throw error;

    if (!schedules || schedules.length === 0) {
      container.innerHTML = '<tr><td colspan="7">No upcoming duties assigned.</td></tr>';
      hideLoading('ciDutiesTable');
      return;
    }

    let rows = '';
    schedules.forEach(s => {
      const studentName = s.student?.name || 'Unknown';
      const attendance = s.attendance && s.attendance.length > 0 ? s.attendance[0] : null;
      const currentStatus = attendance?.status || 'not_marked';
      const statusDisplay = {
        on_time: 'Present',
        late: 'Late',
        absent: 'Absent',
        not_marked: 'Not marked'
      }[currentStatus];

      rows += `
        <tr data-schedule-id="${s.id}" data-student-id="${s.student?.id || ''}">
          <td>${studentName}</td>
          <td>${s.date}</td>
          <td>${s.hospital?.name || 'N/A'}</td>
          <td>${s.case_type || 'N/A'}</td>
          <td><span class="status-badge ${currentStatus}">${statusDisplay}</span></td>
          <td>
            <button class="ci-action present-btn" data-status="on_time" data-original="Present">Present</button>
            <button class="ci-action late-btn" data-status="late" data-original="Late">Late</button>
            <button class="ci-action absent-btn" data-status="absent" data-original="Absent">Absent</button>
          </td>
          <td>
            <input type="text" class="reason-input" placeholder="Reason (optional)" style="width:100px; padding:4px; border-radius:6px; border:1px solid #e9edf2;">
          </td>
        </tr>
      `;
    });

    container.innerHTML = rows;

    container.querySelectorAll('.ci-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const scheduleId = tr.dataset.scheduleId;
        const studentId = tr.dataset.studentId;
        const status = btn.dataset.status;
        const reasonInput = tr.querySelector('.reason-input');
        const reason = reasonInput ? reasonInput.value : '';

        try {
          btn.disabled = true;
          btn.textContent = 'Saving...';
          await markAttendanceManually(scheduleId, studentId, status, reason);
          showToast(`Student marked as ${status}`, 'success');
          initAbsenceMarking();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = btn.dataset.original || 'Mark';
          showToast('Error: ' + err.message, 'error');
        }
      });
    });

    hideLoading('ciDutiesTable');
  } catch (err) {
    console.error('CI attendance error:', err);
    hideLoading('ciDutiesTable');
    showToast('Error loading duties: ' + err.message, 'error');
  }
}

export async function initCasePassport() {
  const user = requireAuth();
  if (!user || user.role !== 'student') return;

  const list = document.getElementById('caseList');
  try {
    showLoading('caseList', 'Loading your cases...');
    const progress = await getProgress(user.id);
    list.innerHTML = progress.cases.map(c => {
      const isComplete = c.status === 'complete';
      const completedCount = c.completed;
      const required = c.required;
      return `
        <div class="case-item">
          <span class="case-name">${c.name} (${completedCount}/${required})</span>
          <span class="case-status">
            ${isComplete ? `<span class="done"><i class="fas fa-check-circle"></i> Complete</span>` 
                         : `<span class="pending"><i class="fas fa-hourglass-half"></i> ${completedCount}/${required} done</span>`}
          </span>
          ${!isComplete ? `<button class="submit-case-btn" data-case-id="${c.id}">Submit</button>` : ''}
        </div>
      `;
    }).join('');

    list.querySelectorAll('.submit-case-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const caseId = btn.dataset.caseId;
        showCaseSubmissionModal(user.id, caseId);
      });
    });

    hideLoading('caseList');
  } catch (err) {
    console.error('Case passport error:', err);
    hideLoading('caseList');
    showToast('Error loading cases: ' + err.message, 'error');
  }
}

function showCaseSubmissionModal(studentId, caseLibraryId) {
  const date = prompt('Enter date completed (YYYY-MM-DD):');
  if (!date) return;
  const notes = prompt('Enter notes (optional):') || '';
  submitCase(studentId, caseLibraryId, date, notes);
}

async function submitCase(studentId, caseLibraryId, date, notes) {
  try {
    const { error } = await supabase
      .from('case_progress')
      .insert([{
        student_id: studentId,
        case_library_id: caseLibraryId,
        date_completed: date,
        notes: notes,
        status: 'pending',
      }]);
    if (error) throw error;
    showToast('Case submitted for verification.', 'success');
    initCasePassport();
  } catch (err) {
    showToast('Error submitting case: ' + err.message, 'error');
  }
}

export async function initCaseVerification() {
  const user = requireAuth();
  if (!user || (user.role !== 'scheduler' && user.role !== 'admin')) return;

  let container = document.getElementById('pendingVerifications');
  if (!container) {
    const main = document.querySelector('.main-content');
    if (!main) return;
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.innerHTML = `<h3>📋 Pending Case Verifications</h3><table><thead><tr><th>Student</th><th>Case</th><th>Date</th><th>Notes</th><th>Actions</th></tr></thead><tbody id="verifyTableBody"></tbody></table>`;
    main.appendChild(wrap);
    container = document.getElementById('verifyTableBody');
  }

  try {
    showLoading('verifyTableBody', 'Loading pending verifications...');
    const { data: pending, error } = await supabase
      .from('case_progress')
      .select(`
        id,
        date_completed,
        notes,
        student:student_id (name),
        case:case_library_id (name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const tbody = container;
    tbody.innerHTML = pending.map(p => `
      <tr>
        <td>${p.student?.name || 'Unknown'}</td>
        <td>${p.case?.name || 'Unknown'}</td>
        <td>${p.date_completed}</td>
        <td>${p.notes || '-'}</td>
        <td>
          <button class="verify-btn" data-id="${p.id}">Verify</button>
          <button class="reject-btn" data-id="${p.id}">Reject</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5">No pending verifications.</td></tr>';

    tbody.querySelectorAll('.verify-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          await supabase
            .from('case_progress')
            .update({ status: 'verified', verified_by: user.id, verified_at: new Date().toISOString() })
            .eq('id', id);
          showToast('Case verified successfully.', 'success');
          initCaseVerification();
        } catch (err) {
          showToast('Error: ' + err.message, 'error');
        }
      });
    });

    tbody.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reason = prompt('Reason for rejection:');
        if (reason === null) return;
        const id = btn.dataset.id;
        try {
          await supabase
            .from('case_progress')
            .update({ status: 'rejected', rejection_reason: reason })
            .eq('id', id);
          showToast('Case rejected.', 'warning');
          initCaseVerification();
        } catch (err) {
          showToast('Error: ' + err.message, 'error');
        }
      });
    });

    hideLoading('verifyTableBody');
  } catch (err) {
    console.error('Case verification error:', err);
    hideLoading('verifyTableBody');
    showToast('Error loading verifications: ' + err.message, 'error');
  }
}

export function initQRAttendance() {
  const user = requireAuth();
  if (!user) return;
  const role = user.role;
  const container = document.getElementById('qrContainer');
  let html = `<div class="qr-scanner-box">
    <h3><i class="fas fa-qrcode"></i> QR Duty Verification</h3>
    <p>${role === 'ci' ? 'Scan the student\'s duty QR code' : 'Show your QR code to the CI'}</p>
    <div id="qrCodePlaceholder" class="qr-placeholder"><i class="fas fa-qrcode"></i></div>
    <button class="action-btn" onclick="window.scanQR()"><i class="fas fa-camera"></i> ${role === 'ci' ? 'Scan QR' : 'Generate My QR'}</button>
    <div id="scanResult" style="margin-top:16px;font-weight:500;"></div>
  </div>`;
  container.innerHTML = html;

  window.scanQR = function() {
    if (role === 'student') {
      const qrDiv = document.getElementById('qrCodePlaceholder');
      const studentId = user.id;
      qrDiv.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(studentId)}" alt="QR Code" style="width:200px;height:200px;border-radius:12px;" />`;
      document.getElementById('scanResult').innerHTML = `<span style="color:#166534;"><i class="fas fa-check-circle"></i> QR code generated. Show to CI for verification.</span>`;
      showToast('QR code generated successfully', 'success', 2000);
    } else if (role === 'ci') {
      document.getElementById('scanResult').innerHTML = `<span style="color:#166534;"><i class="fas fa-check-circle"></i> Duty verified! Time-in: ${new Date().toLocaleTimeString()}</span>`;
      showToast('Duty verified! Time-in recorded.', 'success', 2000);
    }
  };
}

export async function initAIMatchmaker() {
  const user = requireAuth();
  if (!user || (user.role !== 'scheduler' && user.role !== 'admin')) return;

  const container = document.getElementById('matchContainer');
  try {
    showLoading('matchContainer', 'Loading recommendations...');

    const slots = await getAvailableSlots();
    if (!slots || slots.length === 0) {
      container.innerHTML = '<p>No open slots available for matching.</p>';
      hideLoading('matchContainer');
      return;
    }

    let html = `<div class="match-tabs">`;
    slots.forEach((slot, index) => {
      html += `<button class="${index === 0 ? 'active' : ''}" data-slot-id="${slot.id}">${slot.case_type || 'Duty'} – ${slot.date}</button>`;
    });
    html += `</div>`;
    html += `<div id="recommendationContent"></div>`;
    container.innerHTML = html;

    async function loadRecommendations(slotId) {
      const content = document.getElementById('recommendationContent');
      showLoading('recommendationContent', 'Computing scores...');
      try {
        const recommendations = await getRecommendationsForSlot(slotId);
        if (!recommendations || recommendations.length === 0) {
          content.innerHTML = '<p>No eligible students found.</p>';
          return;
        }
        const slot = slots.find(s => s.id === slotId);
        let html2 = `<div class="match-card">
          <div class="match-header">
            <h3>${slot.case_type || 'Duty'} @ ${slot.hospital}</h3>
            <span>${slot.date}</span>
          </div>
          <div class="student-list">
            ${recommendations.map((rec, idx) => `
              <div class="student-item">
                <div>
                  <strong>#${idx+1}</strong> ${rec.studentName}
                  <span class="score-badge">Score: ${rec.score}</span>
                  ${rec.details ? `<div class="explanation"><i class="fas fa-info-circle"></i> ${generateExplanation(rec.details)}</div>` : ''}
                </div>
                <button class="assign-btn" data-slot-id="${slotId}" data-student-id="${rec.studentId}" data-student-name="${rec.studentName}">Assign</button>
              </div>
            `).join('')}
          </div>
        </div>`;
        content.innerHTML = html2;

        content.querySelectorAll('.assign-btn').forEach(btn => {
          const assignedName = btn.dataset.studentName;
          btn.addEventListener('click', async () => {
            const slotId = btn.dataset.slotId;
            const studentId = btn.dataset.studentId;
            try {
              btn.disabled = true;
              btn.textContent = 'Assigning...';
              await claimSlot(slotId, studentId);
              showToast(`Assigned ${assignedName} to duty.`, 'success');
              initAIMatchmaker();
            } catch (err) {
              btn.disabled = false;
              btn.textContent = 'Assign';
              showToast('Error: ' + err.message, 'error');
            }
          });
        });
      } catch (err) {
        content.innerHTML = `<p>Error loading recommendations: ${err.message}</p>`;
      }
      hideLoading('recommendationContent');
    }

    container.querySelectorAll('.match-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.match-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadRecommendations(btn.dataset.slotId);
      });
    });

    const firstTab = container.querySelector('.match-tabs button.active');
    if (firstTab) {
      loadRecommendations(firstTab.dataset.slotId);
    }

    hideLoading('matchContainer');
  } catch (err) {
    console.error('AI Matchmaker error:', err);
    hideLoading('matchContainer');
    showToast('Error loading AI recommendations: ' + err.message, 'error');
  }
}

function generateExplanation(details) {
  const parts = [];
  if (details.caseMatch) parts.push('Needs this case');
  if (!details.hasConflict) parts.push('No duty conflict');
  if (details.attendanceRate > 0.95) parts.push('High attendance');
  if (details.hasMakeup) parts.push('Has make-up duty');
  if (details.absences > 3) parts.push('Excessive absences (-)');
  if (details.alreadyCompleted) parts.push('Already completed this case (-)');
  return parts.length ? parts.join('; ') : 'Balanced candidate';
}

export async function initNotifications() {
  const user = requireAuth();
  if (!user) return;

  const container = document.getElementById('notifList');
  try {
    showLoading('notifList', 'Loading notifications...');
    const notifs = await getNotifications(user.id);
    const unreadCount = notifs.filter(n => !n.read).length;
    updateNotifBadge(unreadCount);

    container.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.read?'':'unread'}" data-id="${n.id}" onclick="window.markNotifRead('${n.id}')">
        <span class="notif-text">${n.message}</span>
        <span class="notif-time">${new Date(n.created_at).toLocaleString()}</span>
      </div>
    `).join('') || '<p>No notifications</p>';

    hideLoading('notifList');
    subscribeToNotifications(user.id);
  } catch (err) {
    console.error('Notifications error:', err);
    hideLoading('notifList');
    showToast('Error loading notifications: ' + err.message, 'error');
  }

  window.markNotifRead = markNotifRead;
}

// ------ Schedule Management (Scheduler) ------
export async function initScheduleManagement() {
  const user = requireAuth();
  if (!user || (user.role !== 'scheduler' && user.role !== 'admin')) return;

  await loadDropdowns();
  await loadScheduleList();

  document.getElementById('createBtn').addEventListener('click', async () => {
    await createNewSchedule();
  });

  document.getElementById('clearFormBtn').addEventListener('click', () => {
    document.getElementById('createForm').querySelectorAll('select, input').forEach(el => {
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else if (el.type !== 'submit') el.value = '';
    });
    document.getElementById('createDepartment').innerHTML = '<option value="">Select Department</option>';
  });

  document.getElementById('createHospital').addEventListener('change', async (e) => {
    const hospitalId = e.target.value;
    if (!hospitalId) {
      document.getElementById('createDepartment').innerHTML = '<option value="">Select Department</option>';
      return;
    }
    const depts = await getDepartmentsByHospital(hospitalId);
    const deptSelect = document.getElementById('createDepartment');
    deptSelect.innerHTML = '<option value="">Select Department</option>';
    depts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      deptSelect.appendChild(opt);
    });
  });

  document.getElementById('scheduleTableBody').addEventListener('click', async (e) => {
    const target = e.target;
    if (target.classList.contains('delete-btn')) {
      const id = target.dataset.id;
      if (confirm('Delete this schedule?')) {
        try {
          await deleteSchedule(id);
          showToast('Schedule deleted.', 'success');
          loadScheduleList();
        } catch (err) {
          showToast('Error: ' + err.message, 'error');
        }
      }
    } else if (target.classList.contains('edit-btn')) {
      const id = target.dataset.id;
      toggleEditForm(id);
    } else if (target.classList.contains('save-edit-btn')) {
      const id = target.dataset.id;
      await saveEdit(id);
    } else if (target.classList.contains('cancel-edit-btn')) {
      const id = target.dataset.id;
      toggleEditForm(id, false);
    }
  });
}

async function loadDropdowns() {
  try {
    const students = await getStudents();
    const studentSelect = document.getElementById('createStudent');
    studentSelect.innerHTML = '<option value="">Select Student</option>';
    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.program || 'BSN'})`;
      studentSelect.appendChild(opt);
    });

    const cis = await getCIs();
    const ciSelect = document.getElementById('createCI');
    ciSelect.innerHTML = '<option value="">Select CI</option>';
    cis.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      ciSelect.appendChild(opt);
    });

    const hospitals = await getHospitals();
    const hospSelect = document.getElementById('createHospital');
    hospSelect.innerHTML = '<option value="">Select Hospital</option>';
    hospitals.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = h.name;
      hospSelect.appendChild(opt);
    });
  } catch (err) {
    showToast('Error loading dropdowns: ' + err.message, 'error');
  }
}

async function loadScheduleList() {
  try {
    const schedules = await getAllSchedules();
    const tbody = document.getElementById('scheduleTableBody');
    if (!schedules || schedules.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9">No schedules found.</td></tr>';
      return;
    }
    let html = '';
    schedules.forEach(s => {
      html += `
        <tr data-id="${s.id}">
          <td>${s.studentName}</td>
          <td>${s.ciName}</td>
          <td>${s.hospital}</td>
          <td>${s.department}</td>
          <td>${s.date}</td>
          <td>${s.start_time} – ${s.end_time}</td>
          <td>${s.case_type || '-'}</td>
          <td><span class="status-badge ${s.status}">${s.status}</span></td>
          <td>
            <button class="edit-btn btn-edit" data-id="${s.id}">Edit</button>
            <button class="delete-btn btn-danger" data-id="${s.id}">Delete</button>
          </td>
        </tr>
        <tr class="edit-form-container" id="edit-${s.id}">
          <td colspan="9">
            <div class="form-grid">
              <div><label>Student</label><select class="edit-student" data-id="${s.id}"></select></div>
              <div><label>CI</label><select class="edit-ci" data-id="${s.id}"></select></div>
              <div><label>Hospital</label><select class="edit-hospital" data-id="${s.id}"></select></div>
              <div><label>Department</label><select class="edit-department" data-id="${s.id}"></select></div>
              <div><label>Date</label><input type="date" class="edit-date" data-id="${s.id}" value="${s.date}"></div>
              <div><label>Start</label><input type="time" class="edit-start" data-id="${s.id}" value="${s.start_time}"></div>
              <div><label>End</label><input type="time" class="edit-end" data-id="${s.id}" value="${s.end_time}"></div>
              <div><label>Case</label><input type="text" class="edit-case" data-id="${s.id}" value="${s.case_type || ''}"></div>
            </div>
            <div style="margin-top:12px;">
              <button class="save-edit-btn btn-primary" data-id="${s.id}">Save</button>
              <button class="cancel-edit-btn" data-id="${s.id}">Cancel</button>
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
    await populateEditDropdowns();
  } catch (err) {
    showToast('Error loading schedules: ' + err.message, 'error');
  }
}

async function populateEditDropdowns() {
  try {
    const students = await getStudents();
    const cis = await getCIs();
    const hospitals = await getHospitals();

    document.querySelectorAll('.edit-student').forEach(select => {
      select.innerHTML = '<option value="">Select</option>';
      students.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.program || 'BSN'})`;
        select.appendChild(opt);
      });
    });

    document.querySelectorAll('.edit-ci').forEach(select => {
      select.innerHTML = '<option value="">Select</option>';
      cis.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        select.appendChild(opt);
      });
    });

    document.querySelectorAll('.edit-hospital').forEach(select => {
      select.innerHTML = '<option value="">Select</option>';
      hospitals.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.id;
        opt.textContent = h.name;
        select.appendChild(opt);
      });
    });

    document.querySelectorAll('.edit-hospital').forEach(select => {
      select.addEventListener('change', async (e) => {
        const hospitalId = e.target.value;
        const container = e.target.closest('.edit-form-container');
        const deptSelect = container.querySelector('.edit-department');
        if (!hospitalId) {
          deptSelect.innerHTML = '<option value="">Select Department</option>';
          return;
        }
        const depts = await getDepartmentsByHospital(hospitalId);
        deptSelect.innerHTML = '<option value="">Select Department</option>';
        depts.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id;
          opt.textContent = d.name;
          deptSelect.appendChild(opt);
        });
      });
    });
  } catch (err) {
    console.error('Error populating edit dropdowns:', err);
  }
}

function toggleEditForm(id, show = null) {
  const container = document.getElementById(`edit-${id}`);
  if (!container) return;
  if (show === null) {
    container.classList.toggle('active');
  } else if (show) {
    container.classList.add('active');
  } else {
    container.classList.remove('active');
  }
  if (container.classList.contains('active')) {
    const tr = container.previousElementSibling;
    const studentSelect = container.querySelector('.edit-student');
    const ciSelect = container.querySelector('.edit-ci');
    const hospitalSelect = container.querySelector('.edit-hospital');
    const deptSelect = container.querySelector('.edit-department');
    const dateInput = container.querySelector('.edit-date');
    const startInput = container.querySelector('.edit-start');
    const endInput = container.querySelector('.edit-end');
    const caseInput = container.querySelector('.edit-case');

    const scheduleId = id;
    (async () => {
      try {
        const { data: schedule, error } = await supabase
          .from('schedules')
          .select('*')
          .eq('id', scheduleId)
          .single();
        if (error) throw error;
        studentSelect.value = schedule.student_id || '';
        ciSelect.value = schedule.ci_id || '';
        hospitalSelect.value = schedule.hospital_id || '';
        const depts = await getDepartmentsByHospital(schedule.hospital_id);
        deptSelect.innerHTML = '<option value="">Select Department</option>';
        depts.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id;
          opt.textContent = d.name;
          deptSelect.appendChild(opt);
        });
        deptSelect.value = schedule.department_id || '';
        dateInput.value = schedule.date;
        startInput.value = schedule.start_time;
        endInput.value = schedule.end_time;
        caseInput.value = schedule.case_type || '';
      } catch (err) {
        showToast('Error loading schedule for edit: ' + err.message, 'error');
      }
    })();
  }
}

async function saveEdit(id) {
  const container = document.getElementById(`edit-${id}`);
  if (!container) return;
  const studentId = container.querySelector('.edit-student').value;
  const ciId = container.querySelector('.edit-ci').value;
  const hospitalId = container.querySelector('.edit-hospital').value;
  const departmentId = container.querySelector('.edit-department').value;
  const date = container.querySelector('.edit-date').value;
  const startTime = container.querySelector('.edit-start').value;
  const endTime = container.querySelector('.edit-end').value;
  const caseType = container.querySelector('.edit-case').value;

  if (!studentId || !ciId || !hospitalId || !departmentId || !date || !startTime || !endTime) {
    showToast('Please fill all required fields.', 'warning');
    return;
  }

  try {
    await updateSchedule(id, {
      student_id: studentId,
      ci_id: ciId,
      hospital_id: hospitalId,
      department_id: departmentId,
      date: date,
      start_time: startTime,
      end_time: endTime,
      case_type: caseType || null,
    });
    showToast('Schedule updated.', 'success');
    toggleEditForm(id, false);
    loadScheduleList();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function createNewSchedule() {
  const studentId = document.getElementById('createStudent').value;
  const ciId = document.getElementById('createCI').value;
  const hospitalId = document.getElementById('createHospital').value;
  const departmentId = document.getElementById('createDepartment').value;
  const date = document.getElementById('createDate').value;
  const startTime = document.getElementById('createStart').value;
  const endTime = document.getElementById('createEnd').value;
  const caseType = document.getElementById('createCaseType').value;

  if (!studentId || !ciId || !hospitalId || !departmentId || !date || !startTime || !endTime) {
    showToast('Please fill all required fields.', 'warning');
    return;
  }

  try {
    await createSchedule({
      student_id: studentId,
      ci_id: ciId,
      hospital_id: hospitalId,
      department_id: departmentId,
      date: date,
      start_time: startTime,
      end_time: endTime,
      case_type: caseType || null,
      status: 'scheduled',
    });
    showToast('Schedule created successfully.', 'success');
    document.getElementById('clearFormBtn').click();
    loadScheduleList();
  } catch (err) {
    showToast('Error creating schedule: ' + err.message, 'error');
  }
}

// ------ Admin Management (Hospitals, Departments, Cases, Users) ------
export async function initAdminManagement() {
  const user = requireAuth();
  if (!user || user.role !== 'admin') return;

  document.querySelectorAll('.admin-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      document.getElementById(`tab-${tabId}`).classList.add('active');
      if (tabId === 'hospitals') loadHospitals();
      if (tabId === 'departments') { loadDepartments(); loadHospitalSelects(); }
      if (tabId === 'cases') loadCases();
      if (tabId === 'users') loadUsers();
    });
  });

  loadHospitals();
  loadDepartments();
  loadCases();
  loadUsers();
  loadHospitalSelects();

  document.getElementById('saveHospitalBtn').addEventListener('click', async () => {
    const editId = document.getElementById('saveHospitalBtn').dataset.editId;
    const name = document.getElementById('hospitalName').value.trim();
    const address = document.getElementById('hospitalAddress').value.trim();
    const lat = parseFloat(document.getElementById('hospitalLat').value);
    const lng = parseFloat(document.getElementById('hospitalLng').value);
    const radius = parseInt(document.getElementById('hospitalRadius').value) || 100;
    if (!name || isNaN(lat) || isNaN(lng)) {
      showToast('Name, latitude, and longitude are required.', 'warning');
      return;
    }
    try {
      if (editId) {
        await updateHospital(editId, { name, address, latitude: lat, longitude: lng, attendance_radius: radius });
        showToast('Hospital updated.', 'success');
      } else {
        await createHospital({ name, address, latitude: lat, longitude: lng, attendance_radius: radius });
        showToast('Hospital added.', 'success');
      }
      document.getElementById('hospitalForm').reset();
      document.getElementById('cancelHospitalBtn').click();
      loadHospitals();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });

  document.getElementById('cancelHospitalBtn').addEventListener('click', () => {
    document.getElementById('hospitalForm').reset();
    document.getElementById('cancelHospitalBtn').style.display = 'none';
    document.getElementById('saveHospitalBtn').textContent = 'Add Hospital';
    document.getElementById('saveHospitalBtn').dataset.editId = '';
  });

  document.getElementById('saveDeptBtn').addEventListener('click', async () => {
    const editId = document.getElementById('saveDeptBtn').dataset.editId;
    const name = document.getElementById('deptName').value.trim();
    const hospitalId = document.getElementById('deptHospital').value;
    if (!name || !hospitalId) {
      showToast('Name and hospital are required.', 'warning');
      return;
    }
    try {
      if (editId) {
        await updateDepartment(editId, { name, hospital_id: hospitalId });
        showToast('Department updated.', 'success');
      } else {
        await createDepartment({ name, hospital_id: hospitalId });
        showToast('Department added.', 'success');
      }
      document.getElementById('departmentForm').reset();
      document.getElementById('cancelDeptBtn').click();
      loadDepartments();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });

  document.getElementById('cancelDeptBtn').addEventListener('click', () => {
    document.getElementById('departmentForm').reset();
    document.getElementById('cancelDeptBtn').style.display = 'none';
    document.getElementById('saveDeptBtn').textContent = 'Add Department';
    document.getElementById('saveDeptBtn').dataset.editId = '';
  });

  document.getElementById('saveCaseBtn').addEventListener('click', async () => {
    const name = document.getElementById('caseName').value.trim();
    const description = document.getElementById('caseDesc').value.trim();
    const category = document.getElementById('caseCategory').value.trim();
    const required = parseInt(document.getElementById('caseRequired').value) || 1;
    const program = document.getElementById('caseProgram').value.trim() || null;
    if (!name) {
      showToast('Case name is required.', 'warning');
      return;
    }
    try {
      await createCase({ name, description, category, required_min: required, program });
      showToast('Case added.', 'success');
      document.getElementById('caseForm').reset();
      loadCases();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });

  document.getElementById('cancelCaseBtn').addEventListener('click', () => {
    document.getElementById('caseForm').reset();
    document.getElementById('cancelCaseBtn').style.display = 'none';
    document.getElementById('saveCaseBtn').textContent = 'Add Case';
    document.getElementById('saveCaseBtn').dataset.editId = '';
  });

  document.getElementById('saveUserBtn').addEventListener('click', async () => {
    const email = document.getElementById('userEmail').value.trim();
    const password = document.getElementById('userPassword').value;
    const name = document.getElementById('userName').value.trim();
    const role = document.getElementById('userRole').value;
    const program = document.getElementById('userProgram').value.trim() || 'BSN';
    if (!email || !password || !name) {
      showToast('Email, password, and name are required.', 'warning');
      return;
    }
    try {
      await createUserByAdmin(email, password, role, name, program);
      showToast('User created. They will receive a confirmation email.', 'success');
      document.getElementById('userForm').reset();
      loadUsers();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });

  document.getElementById('cancelUserBtn').addEventListener('click', () => {
    document.getElementById('userForm').reset();
    document.getElementById('cancelUserBtn').style.display = 'none';
    document.getElementById('saveUserBtn').textContent = 'Create User';
    document.getElementById('saveUserBtn').dataset.editId = '';
  });

  document.getElementById('userRole').addEventListener('change', (e) => {
    document.getElementById('userProgramGroup').style.display = e.target.value === 'student' ? 'block' : 'none';
  });
}

async function loadHospitals() {
  try {
    const hospitals = await getHospitals();
    const tbody = document.getElementById('hospitalTableBody');
    tbody.innerHTML = hospitals.map(h => `
      <tr>
        <td>${h.name}</td>
        <td>${h.address || '-'}</td>
        <td>${h.latitude}</td>
        <td>${h.longitude}</td>
        <td>${h.attendance_radius}m</td>
        <td class="action-group">
          <button class="btn-sm edit" data-id="${h.id}" onclick="editHospital('${h.id}')">Edit</button>
          <button class="btn-sm delete" data-id="${h.id}" onclick="deleteHospitalItem('${h.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error loading hospitals: ' + err.message, 'error');
  }
}

async function loadDepartments() {
  try {
    const depts = await getDepartments();
    const tbody = document.getElementById('deptTableBody');
    tbody.innerHTML = depts.map(d => `
      <tr>
        <td>${d.name}</td>
        <td>${d.hospitalName}</td>
        <td class="action-group">
          <button class="btn-sm edit" data-id="${d.id}" onclick="editDepartment('${d.id}')">Edit</button>
          <button class="btn-sm delete" data-id="${d.id}" onclick="deleteDepartmentItem('${d.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error loading departments: ' + err.message, 'error');
  }
}

async function loadCases() {
  try {
    const cases = await getCaseLibrary();
    const tbody = document.getElementById('caseTableBody');
    tbody.innerHTML = cases.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.category || '-'}</td>
        <td>${c.required_min}</td>
        <td>${c.program || 'All'}</td>
        <td class="action-group">
          <button class="btn-sm edit" data-id="${c.id}" onclick="editCase('${c.id}')">Edit</button>
          <button class="btn-sm delete" data-id="${c.id}" onclick="deleteCaseItem('${c.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error loading cases: ' + err.message, 'error');
  }
}

async function loadUsers() {
  try {
    const users = await getAllUsers();
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${u.program || '-'}</td>
        <td class="action-group">
          <button class="btn-sm edit" data-id="${u.id}" onclick="editUser('${u.id}')">Edit</button>
          <button class="btn-sm delete" data-id="${u.id}" onclick="deleteUserItem('${u.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error loading users: ' + err.message, 'error');
  }
}

async function loadHospitalSelects() {
  try {
    const hospitals = await getHospitals();
    const selects = document.querySelectorAll('#deptHospital');
    selects.forEach(sel => {
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">Select Hospital</option>';
      hospitals.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.id;
        opt.textContent = h.name;
        sel.appendChild(opt);
      });
      if (currentVal) sel.value = currentVal;
    });
  } catch (err) {
    console.error('Error loading hospital selects:', err);
  }
}

// Global edit/delete functions (must be attached to window for onclick)
window.editHospital = async function(id) {
  const hospitals = await getHospitals();
  const h = hospitals.find(x => x.id === id);
  if (!h) return;
  document.getElementById('hospitalName').value = h.name;
  document.getElementById('hospitalAddress').value = h.address || '';
  document.getElementById('hospitalLat').value = h.latitude;
  document.getElementById('hospitalLng').value = h.longitude;
  document.getElementById('hospitalRadius').value = h.attendance_radius || 100;
  document.getElementById('saveHospitalBtn').textContent = 'Update Hospital';
  document.getElementById('saveHospitalBtn').dataset.editId = id;
  document.getElementById('cancelHospitalBtn').style.display = 'inline-block';
};

window.deleteHospitalItem = async function(id) {
  if (!confirm('Delete this hospital? This may affect departments and schedules.')) return;
  try {
    await deleteHospital(id);
    showToast('Hospital deleted.', 'success');
    loadHospitals();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};


window.logoutUser = function() {
  logout();
};

document.addEventListener('DOMContentLoaded', async () => {
  const path = window.location.pathname.split('/').pop();

  // Login handler (only present on the sign-in page)
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginError = document.getElementById('loginError');

    loginBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        loginError.textContent = 'Please enter both email and password.';
        loginError.style.display = 'block';
        return;
      }

      loginError.style.display = 'none';
      loginBtn.disabled = true;
      loginBtn.textContent = 'Signing In...';

      try {
        const user = await signIn(email, password);
        if (user.role === 'student') {
          window.location.href = 'student-dashboard.html';
        } else if (user.role === 'scheduler') {
          window.location.href = 'scheduler-dashboard.html';
        } else if (user.role === 'admin') {
          window.location.href = 'admin.html';
        } else if (user.role === 'ci') {
          window.location.href = 'ci-dashboard.html';
        } else {
          window.location.href = 'student-dashboard.html';
        }
      } catch (err) {
        loginError.textContent = err.message || 'Sign in failed. Please try again.';
        loginError.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'Sign In <i class="fas fa-arrow-right"></i>';
      }
    });

    // Allow Enter key to submit
    [emailInput, passwordInput].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loginBtn.click();
      });
    });
  }

  // Ensure default admin account exists (only if no user is logged in and not on the login page)
  const user = getCurrentUser();
  if (!user && path !== 'index.html') {
    try {
      await ensureAdminAccount();
    } catch (err) {
      console.warn('Admin account check failed:', err);
    }
  }

  const sidebarContainer = document.getElementById('sidebarContainer');
  if (sidebarContainer) {
    const activeMap = {
      'student-dashboard.html': 'student-dashboard.html',
      'scheduler-dashboard.html': 'scheduler-dashboard.html',
      'ci-dashboard.html': 'ci-dashboard.html',
      'admin.html': 'admin.html',
      'case-passport.html': 'case-passport.html',
      'attendance.html': 'attendance.html',
      'ai-matchmaker.html': 'ai-matchmaker.html',
      'notifications.html': 'notifications.html',
      'schedule-management.html': 'schedule-management.html',
      'opportunity-board.html': 'opportunity-board.html'
      // qr-attendance.html removed
    };
    sidebarContainer.innerHTML = renderSidebar(activeMap[path] || '');
  }

  if (path === 'student-dashboard.html') {
    await initStudentDashboard();
  } else if (path === 'scheduler-dashboard.html') {
    await initSchedulerDashboard();
    await initHeatmap();
    await initCaseVerification();
    initSendAnnouncement();
  } else if (path === 'ci-dashboard.html') {
    await initCIDashboard();
    await initAbsenceMarking();
    initSendAnnouncement();
  } else if (path === 'admin.html') {
    await initAdminAnalytics();
    await initAdminManagement();
    initSendAnnouncement();
  } else if (path === 'case-passport.html') {
    await initCasePassport();
  } else if (path === 'attendance.html') {
    await initAttendance();
  } else if (path === 'ai-matchmaker.html') {
    await initAIMatchmaker();
  } else if (path === 'notifications.html') {
    await initNotifications();
  } else if (path === 'opportunity-board.html') {
    await initOpportunityBoard();
  } else if (path === 'schedule-management.html') {
    await initScheduleManagement();
  }

  if (user && !notifSubscription && path !== 'notifications.html') {
    subscribeToNotifications(user.id);
  }
});