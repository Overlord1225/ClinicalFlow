import { getCurrentUser, requireAuth } from '../auth.js';
import {
  getUpcomingSchedule,
  getAttendanceForSchedule,
  verifyGPS,
  recordAttendance,
  updateAttendance,
  getAttendanceHistory
} from '../data.js';
import { initFaceScanner } from './faceRecognitionUI.js';
import { showToast, showLoading, hideLoading } from '../utils.js';

let attendanceState = { timeIn: null, timeOut: null, schedule: null, attendanceId: null };

export async function initAttendance() {
  const user = requireAuth();
  if (!user) return;

  const container = document.getElementById('attendanceContainer');
  if (!container) return;

  try {
    await initFaceScanner();

    const schedule = await getUpcomingSchedule(user.id);
    if (!schedule) {
      container.innerHTML = '<p>No upcoming duty. Please check your schedule.</p>' +
        '<p class="debug-note">If you believe this is wrong, verify your schedule date/status in the database.</p>';
      await renderAttendanceHistory(user.id);
      return;
    }

    attendanceState.schedule = schedule;

    const assignedLocationText = schedule.hospital?.name ? `${schedule.hospital.name}` : 'Unassigned';
    const radiusValue = schedule.hospital?.attendance_radius || 100;

    document.getElementById('assignedLocation').textContent = assignedLocationText;
    document.getElementById('allowedRadius').textContent = `${radiusValue} m`;
    document.getElementById('dutyTitle').textContent = `${schedule.case_type || 'Duty'} – ${assignedLocationText}`;
    document.getElementById('dutyDetails').innerHTML = `
      <strong>Date:</strong> ${schedule.date} &nbsp;|&nbsp; 
      <strong>Time:</strong> ${schedule.start_time} – ${schedule.end_time} &nbsp;|&nbsp; 
      <strong>CI:</strong> ${schedule.ciName}
    `;

    await renderAttendanceHistory(user.id);

    const existing = await getAttendanceForSchedule(schedule.id, user.id);
    if (existing) {
      attendanceState.attendanceId = existing.id;
      if (existing.time_in) {
        attendanceState.timeIn = existing.time_in;
        document.getElementById('timeInBtn').disabled = true;
        document.getElementById('timeOutBtn').disabled = false;
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

    hideLoading('attendanceContainer');
    showToast('Ready for attendance verification', 'success', 2000);

  } catch (err) {
    console.error('Attendance init error:', err);
    hideLoading('attendanceContainer');
    container.innerHTML = `<p>Error loading duty: ${err.message}</p>`;
  }
}

async function renderAttendanceHistory(userId) {
  const historyContainer = document.getElementById('attendanceHistory');
  if (!historyContainer) return;

  try {
    const history = await getAttendanceHistory(userId);
    if (!history || history.length === 0) {
      historyContainer.innerHTML = '<p>No attendance records yet.</p>';
      return;
    }

    const rows = history.map(record => {
      const schedule = record.attendance?.schedule;
      const date = schedule?.date || '-';
      const hospital = schedule?.hospital?.name || '-';
      const timeIn = record.time_in ? new Date(record.time_in).toLocaleTimeString() : '-';
      const timeOut = record.time_out ? new Date(record.time_out).toLocaleTimeString() : '-';
      return `
        <tr>
          <td>${date}</td>
          <td>${hospital}</td>
          <td>${timeIn}</td>
          <td>${timeOut}</td>
          <td>${record.status || '-'}</td>
          <td>${record.verification_method || 'gps'}</td>
        </tr>
      `;
    }).join('');

    historyContainer.innerHTML = `
      <div class="table-wrap">
        <table class="attendance-history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Hospital</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th>Status</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } catch (err) {
    historyContainer.innerHTML = `<p class="status-message error">Failed to load history: ${err.message}</p>`;
  }
}

export async function performTimeIn() {
  const user = getCurrentUser();
  if (!user) return;

  const schedule = attendanceState.schedule;
  if (!schedule) {
    showToast('No duty loaded', 'error');
    return;
  }

  const btn = document.getElementById('timeInBtn');
  if (!btn) return;

  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    const gpsResult = await verifyGPS(user.id, schedule.id);
    if (!gpsResult.within) {
      showToast(`You are ${Math.round(gpsResult.distance)}m away. Must be within ${gpsResult.radius}m.`, 'error');
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
      false,
      false,
      'gps',
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
    const gpsResult = await verifyGPS(user.id, schedule.id);
    if (!gpsResult.within) {
      showToast(`You are ${Math.round(gpsResult.distance)}m away. Must be within ${gpsResult.radius}m.`, 'error');
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

// Attach event listeners after DOM ready
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

// Expose for global access (if needed by inline onclick, etc.)
window.performTimeIn = performTimeIn;
window.performTimeOut = performTimeOut;