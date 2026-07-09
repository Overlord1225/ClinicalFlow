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
  getCaseLibrary,
  createOpenSlot,
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

// ----- Create Open Slot Form -----
export function initCreateOpenSlotForm() {
  const user = requireAuth();
  if (!user || (user.role !== 'scheduler' && user.role !== 'admin')) return;

  const form = document.getElementById('openSlotForm');
  if (!form) return;

  // Load dropdowns
  (async () => {
    const hospitals = await getHospitals();
    const cis = await getCIs();
    const cases = await getCaseLibrary();

    const hospitalSelect = document.getElementById('openSlotHospital');
    hospitalSelect.innerHTML = '<option value="">Select Hospital</option>' +
      hospitals.map(h => `<option value="${h.id}">${h.name}</option>`).join('');

    const ciSelect = document.getElementById('openSlotCI');
    ciSelect.innerHTML = '<option value="">Select CI</option>' +
      cis.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const caseSelect = document.getElementById('openSlotCaseType');
    caseSelect.innerHTML = '<option value="">Select Case Type</option>' +
      cases.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    // Hospital -> Department cascade
    hospitalSelect.addEventListener('change', async () => {
      const deptSelect = document.getElementById('openSlotDepartment');
      if (!hospitalSelect.value) {
        deptSelect.innerHTML = '<option value="">Select Department</option>';
        return;
      }
      const depts = await getDepartmentsByHospital(hospitalSelect.value);
      deptSelect.innerHTML = '<option value="">Select Department</option>' +
        depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    });
  })();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');

    const payload = {
      hospital_id: document.getElementById('openSlotHospital').value,
      department_id: document.getElementById('openSlotDepartment').value,
      ci_id: document.getElementById('openSlotCI').value,
      date: document.getElementById('openSlotDate').value,
      start_time: document.getElementById('openSlotStart').value,
      end_time: document.getElementById('openSlotEnd').value,
      case_type: document.getElementById('openSlotCaseType').value,
      max_students: parseInt(document.getElementById('openSlotMax').value) || 1,
      is_makeup: false,
    };

    if (!payload.hospital_id || !payload.department_id || !payload.ci_id || !payload.date || !payload.start_time || !payload.end_time || !payload.case_type) {
      showToast('Please fill in all required fields.', 'warning');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
      await createOpenSlot(payload);
      showToast('Open slot created successfully!', 'success');
      form.reset();
      document.getElementById('openSlotDepartment').innerHTML = '<option value="">Select Department</option>';
    } catch (err) {
      showToast('Error creating slot: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Open Slot';
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

    // Init create open slot form
    initCreateOpenSlotForm();
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
    if (editingScheduleId) {
      await saveEdit(editingScheduleId);
    } else {
      await createNewSchedule();
    }
  });

  document.getElementById('clearFormBtn').addEventListener('click', () => {
    document.getElementById('createForm').querySelectorAll('select, input').forEach(el => {
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else if (el.type !== 'submit') el.value = '';
    });
    document.getElementById('createDepartment').innerHTML = '<option value="">Select Department</option>';
    resetEditMode();
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

// ---- Module-level state for edit mode ----
let editingScheduleId = null;

async function loadDropdowns() {
  const students = await getStudents();
  const cis = await getCIs();
  const hospitals = await getHospitals();
  const cases = await getCaseLibrary();

  const studentSelect = document.getElementById('createStudent');
  const ciSelect = document.getElementById('createCI');
  const hospitalSelect = document.getElementById('createHospital');
  const deptSelect = document.getElementById('createDepartment');
  const caseTypeSelect = document.getElementById('createCaseType');

  studentSelect.innerHTML = '<option value="">Select Student</option>' +
    students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  ciSelect.innerHTML = '<option value="">Select CI</option>' +
    cis.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  hospitalSelect.innerHTML = '<option value="">Select Hospital</option>' +
    hospitals.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
  deptSelect.innerHTML = '<option value="">Select Department</option>';
  caseTypeSelect.innerHTML = '<option value="">Select Case Type</option>' +
    cases.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

async function loadScheduleList() {
  const tbody = document.getElementById('scheduleTableBody');
  if (!tbody) return;
  try {
    showLoading('scheduleTableBody', 'Loading schedules...');
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        student:users!student_id (name),
        ci:users!ci_id (name),
        hospital:hospital_id (name),
        department:department_id (name)
      `)
      .order('date', { ascending: true });
    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9">No schedules found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(s => `
      <tr data-id="${s.id}">
        <td>${s.student?.name || 'N/A'}</td>
        <td>${s.ci?.name || 'N/A'}</td>
        <td>${s.hospital?.name || 'N/A'}</td>
        <td>${s.department?.name || 'N/A'}</td>
        <td>${s.date}</td>
        <td>${s.start_time} – ${s.end_time}</td>
        <td>${s.case_type || '-'}</td>
        <td><span class="status-badge ${s.status}">${s.status}</span></td>
        <td>
          <button class="edit-btn btn-primary" data-id="${s.id}">Edit</button>
          <button class="delete-btn btn-secondary" data-id="${s.id}">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('loadScheduleList error:', err);
    tbody.innerHTML = `<tr><td colspan="9">Error: ${err.message}</td></tr>`;
  } finally {
    hideLoading('scheduleTableBody');
  }
}

function buildSchedulePayload() {
  return {
    student_id: document.getElementById('createStudent').value,
    ci_id: document.getElementById('createCI').value,
    hospital_id: document.getElementById('createHospital').value,
    department_id: document.getElementById('createDepartment').value,
    date: document.getElementById('createDate').value,
    start_time: document.getElementById('createStart').value,
    end_time: document.getElementById('createEnd').value,
    case_type: document.getElementById('createCaseType').value.trim() || null,
  };
}

function validateSchedulePayload(p) {
  return p.student_id && p.ci_id && p.hospital_id && p.department_id && p.date && p.start_time && p.end_time;
}

async function createNewSchedule() {
  const payload = buildSchedulePayload();
  if (!validateSchedulePayload(payload)) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }
  const btn = document.getElementById('createBtn');
  btn.disabled = true;
  try {
    await createSchedule({ ...payload, status: 'scheduled' });
    showToast('Schedule created successfully.', 'success');
    document.getElementById('clearFormBtn').click();
    await loadScheduleList();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function loadScheduleIntoForm(id) {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }

  editingScheduleId = id;
  document.getElementById('createStudent').value = data.student_id || '';
  document.getElementById('createCI').value = data.ci_id || '';
  document.getElementById('createHospital').value = data.hospital_id || '';

  const depts = await getDepartmentsByHospital(data.hospital_id);
  const deptSelect = document.getElementById('createDepartment');
  deptSelect.innerHTML = '<option value="">Select Department</option>' +
    depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  deptSelect.value = data.department_id || '';

  document.getElementById('createDate').value = data.date || '';
  document.getElementById('createStart').value = data.start_time || '';
  document.getElementById('createEnd').value = data.end_time || '';
  document.getElementById('createCaseType').value = data.case_type || '';

  document.getElementById('createBtn').textContent = 'Save Changes';
  document.getElementById('clearFormBtn').textContent = 'Cancel';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetEditMode() {
  editingScheduleId = null;
  document.getElementById('createBtn').textContent = 'Create Schedule';
  document.getElementById('clearFormBtn').textContent = 'Clear';
}

function toggleEditForm(id, show = true) {
  if (!show) {
    document.getElementById('clearFormBtn').click();
    resetEditMode();
    return;
  }
  loadScheduleIntoForm(id);
}

async function saveEdit(id) {
  const payload = buildSchedulePayload();
  if (!validateSchedulePayload(payload)) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }
  const btn = document.getElementById('createBtn');
  btn.disabled = true;
  try {
    await updateSchedule(id, payload);
    showToast('Schedule updated successfully.', 'success');
    document.getElementById('clearFormBtn').click();
    resetEditMode();
    await loadScheduleList();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}