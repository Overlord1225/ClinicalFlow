import { getCurrentUser, requireAuth } from '../auth.js';
import {
  getAllSchedules,
  getAvailableSlots,
  getHospitalUtilization,
  sendAnnouncement,
  getStudents,
  getCIs,
  getHospitals,
  getDepartmentsByHospital,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getRecommendationsForSlot,
  getStudentsBySection,
  getSections,
  supabase
} from '../data.js';
import { showToast, showLoading, hideLoading } from '../utils.js';
import { subscribeToNotifications } from './notifications.js';

// ----- Scheduler Dashboard -----
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

    // Setup section filter
    await setupSectionFilter();
    await renderVerifiedCaseSummary();

    subscribeToNotifications(user.id);
  } catch (err) {
    console.error('Scheduler dashboard error:', err);
    hideLoading('allSchedTable');
    showToast('Error loading scheduler data: ' + err.message, 'error');
  }
}

async function renderVerifiedCaseSummary() {
  const container = document.getElementById('verifiedCasesSummary');
  if (!container) return;

  try {
    const { data, error } = await supabase
      .from('case_progress')
      .select(`
        id,
        status,
        student:student_id (name, section, program),
        case:case_library_id (name)
      `)
      .eq('status', 'verified')
      .order('verified_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No verified cases recorded yet.</p>';
      return;
    }

    container.innerHTML = `
      <table>
        <thead><tr><th>Student</th><th>Section</th><th>Case</th><th>Status</th></tr></thead>
        <tbody>
          ${data.map(item => `
            <tr>
              <td>${item.student?.name || 'Unknown'}</td>
              <td>${item.student?.section || 'N/A'}</td>
              <td>${item.case?.name || 'Unknown'}</td>
              <td><span class="status-badge verified">Verified</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error('Verified case summary error:', err);
    container.innerHTML = '<p>Unable to load verified case summary.</p>';
  }
}

async function setupSectionFilter() {
  const mainContent = document.querySelector('.main-content');
  const scheduleSection = document.querySelector('.table-wrap');
  if (!mainContent || !scheduleSection) return;

  // Check if filter already exists
  if (document.getElementById('sectionFilter')) return;

  const filterContainer = document.createElement('div');
  filterContainer.style.marginBottom = '16px';
  filterContainer.innerHTML = `
    <label for="sectionFilter">Filter by Section:</label>
    <select id="sectionFilter" style="padding:8px; border-radius:8px; border:1px solid #e9edf2; margin-left:8px;">
      <option value="">All Sections</option>
    </select>
  `;
  mainContent.insertBefore(filterContainer, scheduleSection);

  const sections = await getSections();
  const filterSelect = document.getElementById('sectionFilter');
  sections.forEach(sec => {
    const opt = document.createElement('option');
    opt.value = sec;
    opt.textContent = sec;
    filterSelect.appendChild(opt);
  });

  filterSelect.addEventListener('change', async () => {
    const section = filterSelect.value;
    const students = await getStudentsBySection(section);
    let sectionTable = document.getElementById('sectionStudentsTable');
    if (!sectionTable) {
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      wrap.innerHTML = `<h3>👥 Students in Section</h3><table><thead><tr><th>Name</th><th>Program</th><th>Section</th></tr></thead><tbody id="sectionStudentsTable"></tbody></table>`;
      mainContent.insertBefore(wrap, scheduleSection);
      sectionTable = document.getElementById('sectionStudentsTable');
    }
    sectionTable.innerHTML = students.map(s => `
      <tr><td>${s.name}</td><td>${s.program || 'BSN'}</td><td>${s.section || 'N/A'}</td></tr>
    `).join('') || '<tr><td colspan="3">No students in this section.</td></tr>';
  });
}

// ----- Heatmap -----
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

// ----- Case Verification (shared with admin) -----
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

// ----- Announcement -----
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

// ----- AI Matchmaker -----
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

// ----- Schedule Management -----
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

async function loadDropdowns() { /* ... */ }
async function loadScheduleList() { /* ... */ }
async function populateEditDropdowns() { /* ... */ }
function toggleEditForm(id, show) { /* ... */ }
async function saveEdit(id) { /* ... */ }
async function createNewSchedule() { /* ... */ }

// These are already defined above; we'll keep them in this module.