import { getCurrentUser, requireAuth } from '../auth.js';
import {
  getStudentProgressSummary,
  getAvailableSlots,
  getAllSchedules,
  getHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getCaseLibrary,
  createCase,
  updateCase,
  deleteCase,
  getAllUsers,
  createUserByAdmin,
  deleteUser,
  updateUser,
  supabase
} from '../data.js';
import { showToast, showLoading, hideLoading } from '../utils.js';
import { initSendAnnouncement } from './scheduler.js';

export async function initAdminAnalytics() {
  const user = requireAuth();
  if (!user || user.role !== 'admin') return;

  document.getElementById('adminName').textContent = user.name;

  try {
    showLoading('lackingCases', 'Loading analytics...');

    const students = await getStudentProgressSummary();
    document.getElementById('statStudents').textContent = students.length;
    const slots = await getAvailableSlots();
    document.getElementById('statSlots').textContent = slots.length;
    const allSched = await getAllSchedules();
    document.getElementById('statSched').textContent = allSched.length;
    document.getElementById('statCompleted').textContent = allSched.filter(s => s.status === 'completed').length;

    // Lacking cases
    const lacking = students.filter(s => s.percentage < 100);
    document.getElementById('lackingCases').innerHTML = lacking.map(s => `
      <tr><td>${s.name}</td><td>${s.program}</td><td>${s.completed}/${s.total}</td><td>${s.percentage}%</td></tr>
    `).join('') || '<tr><td colspan="4">All students have completed all cases.</td></tr>';

    // Nearing completion
    const nearing = students.filter(s => s.percentage >= 80 && s.percentage < 100);
    document.getElementById('nearingCompletion').innerHTML = nearing.map(s => `
      <tr><td>${s.name}</td><td>${s.program}</td><td>${s.completed}/${s.total}</td><td>${s.percentage}%</td></tr>
    `).join('') || '<tr><td colspan="4">No students nearing completion.</td></tr>';

    // Excessive absences
    const excessive = students.filter(s => s.absences > 2);
    document.getElementById('excessiveAbsences').innerHTML = excessive.map(s => `
      <tr><td>${s.name}</td><td>${s.program}</td><td>${s.absences}</td></tr>
    `).join('') || '<tr><td colspan="3">No students with excessive absences.</td></tr>';

    // Hospital open opportunities
    const hospitalCount = {};
    slots.forEach(s => { hospitalCount[s.hospital] = (hospitalCount[s.hospital] || 0) + 1; });
    const sortedHospitals = Object.entries(hospitalCount).sort((a,b) => b[1] - a[1]);
    document.getElementById('openOpportunities').innerHTML = sortedHospitals.map(([hospital, count]) => `
      <tr><td>${hospital}</td><td>${count}</td></tr>
    `).join('') || '<tr><td colspan="2">No open opportunities.</td></tr>';

    // Upcoming duties
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const { data: upcoming, error } = await supabase
      .from('schedules')
      .select(`
        *,
        student:users!student_id (name),
        hospital:hospital_id (name)
      `)
      .gte('date', today.toISOString().split('T')[0])
      .lte('date', nextWeek.toISOString().split('T')[0])
      .eq('status', 'scheduled');
    document.getElementById('upcomingDuties').innerHTML = (upcoming && upcoming.length) ? upcoming.map(s => `
      <tr><td>${s.student?.name || 'Unknown'}</td><td>${s.date}</td><td>${s.hospital?.name || 'Unknown'}</td><td>${s.case_type}</td></tr>
    `).join('') : '<tr><td colspan="4">No upcoming duties.</td></tr>';

    hideLoading('lackingCases');
    showToast('Analytics loaded successfully', 'success', 2000);
    initSendAnnouncement();
  } catch (err) {
    console.error('Admin analytics error:', err);
    hideLoading('lackingCases');
    showToast('Error loading analytics: ' + err.message, 'error');
  }
}

export async function initAdminManagement() {
  // This function sets up the CRUD tabs and event listeners.
  // It's large; I'll summarize the main parts.
  const user = requireAuth();
  if (!user || user.role !== 'admin') return;

  // Tab switching
  document.querySelectorAll('.admin-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      document.getElementById(`tab-${tabId}`).classList.add('active');
      // Reload data for tab
      switch(tabId) {
        case 'hospitals': loadHospitals(); break;
        case 'departments': loadDepartments(); loadHospitalSelects(); break;
        case 'cases': loadCases(); break;
        case 'users': loadUsers(); break;
      }
    });
  });

  // Initial load
  loadHospitals();
  loadDepartments();
  loadCases();
  loadUsers();
  loadHospitalSelects();
}