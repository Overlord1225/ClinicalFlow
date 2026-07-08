import { getCurrentUser, requireAuth } from '../auth.js';
import {
  getStudent,
  getProgress,
  getSchedules,
  getNotifications,
  getAvailableSlots,
  claimSlot,
  getAttendanceHistory,
  getUpcomingSchedule,
  supabase
} from '../data.js';
import { showToast, showLoading, hideLoading } from '../utils.js';
import { updateNotifBadge, subscribeToNotifications } from './notifications.js';

export async function initStudentDashboard() {
  const user = requireAuth();
  if (!user || user.role !== 'student') return;
  showLoading('recentNotifs', 'Loading your dashboard...');

  try {
    const student = await getStudent(user.id);
    const progress = await getProgress(user.id);
    const schedules = await getSchedules(user.id);
    const notifs = await getNotifications(user.id);
    const nextSchedule = await getUpcomingSchedule(user.id);
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

    const verifiedCases = progress.cases.filter(c => c.completed >= c.required);
    const assignedLocation = document.getElementById('assignedHospitalLocation');
    if (assignedLocation) {
      if (nextSchedule?.hospital) {
        assignedLocation.innerHTML = `
          <strong>${nextSchedule.hospital.name}</strong><br>
          ${nextSchedule.hospital.address || 'No address provided'}<br>
          <small>${nextSchedule.case_type || 'Duty'} • ${nextSchedule.date}</small>
        `;
      } else {
        assignedLocation.innerHTML = '<p>No assigned hospital for your next duty yet.</p>';
      }
    }

    const verifiedCasesList = document.getElementById('verifiedCasesList');
    if (verifiedCasesList) {
      verifiedCasesList.innerHTML = verifiedCases.length > 0
        ? verifiedCases.map(c => `<div class="case-item"><span class="case-name">${c.name}</span><span class="case-status"><span class="done"><i class="fas fa-check-circle"></i> Verified</span></span></div>`).join('')
        : '<p>No verified cases yet.</p>';
    }

    const upcoming = schedules.filter(s => s.status === 'scheduled');
    const tbody = document.getElementById('upcomingTable');
    tbody.innerHTML = upcoming.map(s => `
      <tr><td>${s.date}</td><td>${s.hospital?.name || 'N/A'}</td><td>${s.case_type || '-'}</td><td><span class="status-badge scheduled">Scheduled</span></td></tr>
    `).join('') || '<tr><td colspan="4">No upcoming duties</td></tr>';

    const notifList = document.getElementById('recentNotifs');
    notifList.innerHTML = notifs.slice(0, 3).map(n => `
      <div class="notif-item ${n.read?'':'unread'}">
        <span class="notif-text">${n.message}</span>
        <span class="notif-time">${new Date(n.created_at).toLocaleString()}</span>
      </div>
    `).join('') || '<p>No notifications</p>';

    // Attendance History
    const history = await getAttendanceHistory(user.id);
    const historyTbody = document.getElementById('historyTable');
    if (historyTbody) {
      historyTbody.innerHTML = history.map(h => `
        <tr>
          <td>${h.schedule?.date || 'N/A'}</td>
          <td>${h.schedule?.hospital?.name || 'N/A'}</td>
          <td>${h.schedule?.case_type || 'N/A'}</td>
          <td>${h.time_in ? new Date(h.time_in).toLocaleTimeString() : '-'}</td>
          <td>${h.time_out ? new Date(h.time_out).toLocaleTimeString() : '-'}</td>
          <td><span class="status-badge ${h.status}">${h.status}</span></td>
        </tr>
      `).join('') || '<tr><td colspan="6">No attendance records found.</td></tr>';
    }

    hideLoading('recentNotifs');
    showToast('Dashboard loaded successfully', 'success', 2000);
  } catch (err) {
    console.error('Student dashboard error:', err);
    hideLoading('recentNotifs');
    showToast('Failed to load dashboard: ' + err.message, 'error');
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