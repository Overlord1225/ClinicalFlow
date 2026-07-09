import { requireAuth } from '../auth.js';
import {
  getAssignedStudents,
  getCIAssignedHospital,
  getAllIncidentReports,
  markAttendanceManually,
  supabase
} from '../data.js';
import { showToast, showLoading, hideLoading } from '../utils.js';
import { initSendAnnouncement } from './scheduler.js';

async function loadCIIncidents() {
  const incidentContainer = document.getElementById('ciIncidentList');
  if (!incidentContainer) return;

  try {
    incidentContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading incident reports...</p></div>';
    const incidents = await getAllIncidentReports();
    if (!incidents || incidents.length === 0) {
      incidentContainer.innerHTML = '<p>No incident reports yet.</p>';
      return;
    }

    incidentContainer.innerHTML = incidents.slice(0, 5).map(r => `
      <div class="incident-item">
        <div class="incident-header">
          <strong>${r.title}</strong>
          <span class="status-badge ${r.status}">${r.status.replace(/_/g, ' ')}</span>
        </div>
        <div class="incident-body">
          <p>${r.description}</p>
          <small>Reporter: ${r.reporter?.name || 'N/A'} | Date: ${r.incident_date} | Location: ${r.location || 'N/A'}</small>
        </div>
      </div>
    `).join('');
  } catch (err) {
    incidentContainer.innerHTML = '<p class="text-error">Unable to load incidents.</p>';
    console.error('CI incident load error:', err);
  }
}

export async function initCIDashboard() {
  try {
    const user = requireAuth();
    if (!user || user.role !== 'ci') return;
    showLoading('ciStudentsTable', 'Loading students...');

    document.getElementById('ciName').textContent = user.name;

    // Assigned students
    const assignedStudents = await getAssignedStudents(user.id);
    const studentTbody = document.getElementById('ciStudentsTable');
    studentTbody.innerHTML = assignedStudents.map(s => `
      <tr><td>${s.name}</td><td>${s.program || 'BSN'}</td><td>${s.section || 'N/A'}</td><td><span class="status-badge scheduled">Active</span></td></tr>
    `).join('') || '<tr><td colspan="4">No students assigned.</td></tr>';

    // Assigned hospital/location
    const hospital = await getCIAssignedHospital(user.id);
    const locContainer = document.getElementById('ciLocation');
    if (locContainer) {
      if (hospital) {
        locContainer.innerHTML = `
          <p><strong>Assigned Hospital:</strong> ${hospital.name}</p>
          <p><strong>Address:</strong> ${hospital.address || 'N/A'}</p>
        `;
      } else {
        locContainer.innerHTML = '<p>No upcoming duty location assigned.</p>';
      }
    }

    hideLoading('ciStudentsTable');
    showToast('CI dashboard loaded', 'success', 2000);

    await loadCIIncidents();
    // Also initialize absence marking and announcement (call from scheduler module)
    await initAbsenceMarking();
    initSendAnnouncement();
  } catch (err) {
    console.error('CI dashboard error:', err);
    hideLoading('ciStudentsTable');
    showToast('Error loading CI data: ' + err.message, 'error');
  }
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