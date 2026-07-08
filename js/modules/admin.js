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

// ---- Module-level edit state ----
let hospitalEditId = null;
let deptEditId = null;
let caseEditId = null;
let userEditId = null;

export async function initAdminManagement() {
  const user = requireAuth();
  if (!user || user.role !== 'admin') return;

  setupAdminForms();

  // Tab switching
  document.querySelectorAll('.admin-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      const target = document.getElementById(`tab-${tabId}`);
      if (target) target.classList.add('active');
      switch (tabId) {
        case 'hospitals': loadHospitals(); break;
        case 'departments': loadHospitalSelects(); loadDepartments(); break;
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

function setupAdminForms() {
  // ---- Hospitals ----
  const saveHospitalBtn = document.getElementById('saveHospitalBtn');
  if (saveHospitalBtn) saveHospitalBtn.addEventListener('click', async () => {
    const name = document.getElementById('hospitalName').value.trim();
    const address = document.getElementById('hospitalAddress').value.trim();
    const lat = parseFloat(document.getElementById('hospitalLat').value);
    const lng = parseFloat(document.getElementById('hospitalLng').value);
    const radius = parseInt(document.getElementById('hospitalRadius').value) || 100;
    if (!name || isNaN(lat) || isNaN(lng)) {
      showToast('Please fill in name, latitude, and longitude.', 'warning');
      return;
    }
    saveHospitalBtn.disabled = true;
    try {
      if (hospitalEditId) {
        await updateHospital(hospitalEditId, { name, address: address || null, latitude: lat, longitude: lng, attendance_radius: radius });
        showToast('Hospital updated.', 'success');
      } else {
        await createHospital({ name, address: address || null, latitude: lat, longitude: lng, attendance_radius: radius });
        showToast('Hospital added.', 'success');
      }
      resetHospitalForm();
      loadHospitals();
      loadHospitalSelects();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      saveHospitalBtn.disabled = false;
    }
  });

  const cancelHospitalBtn = document.getElementById('cancelHospitalBtn');
  if (cancelHospitalBtn) cancelHospitalBtn.addEventListener('click', resetHospitalForm);

  // ---- Departments ----
  const saveDeptBtn = document.getElementById('saveDeptBtn');
  if (saveDeptBtn) saveDeptBtn.addEventListener('click', async () => {
    const name = document.getElementById('deptName').value.trim();
    const hospitalId = document.getElementById('deptHospital').value;
    if (!name || !hospitalId) {
      showToast('Please fill in department name and hospital.', 'warning');
      return;
    }
    saveDeptBtn.disabled = true;
    try {
      if (deptEditId) {
        await updateDepartment(deptEditId, { name, hospital_id: hospitalId });
        showToast('Department updated.', 'success');
      } else {
        await createDepartment({ name, hospital_id: hospitalId });
        showToast('Department added.', 'success');
      }
      resetDeptForm();
      loadDepartments();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      saveDeptBtn.disabled = false;
    }
  });

  const cancelDeptBtn = document.getElementById('cancelDeptBtn');
  if (cancelDeptBtn) cancelDeptBtn.addEventListener('click', resetDeptForm);

  // ---- Cases ----
  const saveCaseBtn = document.getElementById('saveCaseBtn');
  if (saveCaseBtn) saveCaseBtn.addEventListener('click', async () => {
    const name = document.getElementById('caseName').value.trim();
    const description = document.getElementById('caseDesc').value.trim();
    const category = document.getElementById('caseCategory').value.trim();
    const required = parseInt(document.getElementById('caseRequired').value) || 1;
    const program = document.getElementById('caseProgram').value.trim();
    if (!name) {
      showToast('Please fill in the case name.', 'warning');
      return;
    }
    saveCaseBtn.disabled = true;
    try {
      if (caseEditId) {
        await updateCase(caseEditId, { name, description: description || null, category: category || null, required_min: required, program: program || null });
        showToast('Case updated.', 'success');
      } else {
        await createCase({ name, description: description || null, category: category || null, required_min: required, program: program || null });
        showToast('Case added.', 'success');
      }
      resetCaseForm();
      loadCases();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      saveCaseBtn.disabled = false;
    }
  });

  const cancelCaseBtn = document.getElementById('cancelCaseBtn');
  if (cancelCaseBtn) cancelCaseBtn.addEventListener('click', resetCaseForm);

  // ---- Users ----
  const userRole = document.getElementById('userRole');
  if (userRole) userRole.addEventListener('change', () => {
    document.getElementById('userProgramGroup').style.display = (userRole.value === 'student') ? 'block' : 'none';
  });

  const saveUserBtn = document.getElementById('saveUserBtn');
  if (saveUserBtn) saveUserBtn.addEventListener('click', async () => {
    const email = document.getElementById('userEmail').value.trim();
    const password = document.getElementById('userPassword').value;
    const name = document.getElementById('userName').value.trim();
    const role = document.getElementById('userRole').value;
    const program = document.getElementById('userProgram').value.trim() || 'BSN';
    if (!email || !name || (!userEditId && !password)) {
      showToast(userEditId ? 'Please fill in email and name.' : 'Please fill in email, password, and name.', 'warning');
      return;
    }
    saveUserBtn.disabled = true;
    try {
      if (userEditId) {
        await updateUser(userEditId, { name, role, program: role === 'student' ? program : null });
        showToast('User updated.', 'success');
      } else {
        await createUserByAdmin(email, password, role, name, role === 'student' ? program : null);
        showToast('User created.', 'success');
      }
      resetUserForm();
      loadUsers();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      saveUserBtn.disabled = false;
    }
  });

  const cancelUserBtn = document.getElementById('cancelUserBtn');
  if (cancelUserBtn) cancelUserBtn.addEventListener('click', resetUserForm);

  // ---- Table-level edit/delete (event delegation) ----
  document.getElementById('hospitalTableBody')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains('edit-hospital')) editHospital(id);
    else if (e.target.classList.contains('delete-hospital')) deleteHospitalRecord(id);
  });
  document.getElementById('deptTableBody')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains('edit-dept')) editDept(id);
    else if (e.target.classList.contains('delete-dept')) deleteDeptRecord(id);
  });
  document.getElementById('caseTableBody')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains('edit-case')) editCase(id);
    else if (e.target.classList.contains('delete-case')) deleteCaseRecord(id);
  });
  document.getElementById('userTableBody')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains('edit-user')) editUser(id);
    else if (e.target.classList.contains('delete-user')) deleteUserRecord(id);
  });
}

// ---- Reset helpers ----
function resetHospitalForm() {
  hospitalEditId = null;
  document.getElementById('hospitalForm').querySelectorAll('input').forEach(el => el.value = '');
  document.getElementById('hospitalRadius').value = '100';
  document.getElementById('saveHospitalBtn').textContent = 'Add Hospital';
  document.getElementById('cancelHospitalBtn').style.display = 'none';
}
function resetDeptForm() {
  deptEditId = null;
  document.getElementById('deptName').value = '';
  document.getElementById('deptHospital').selectedIndex = 0;
  document.getElementById('saveDeptBtn').textContent = 'Add Department';
  document.getElementById('cancelDeptBtn').style.display = 'none';
}
function resetCaseForm() {
  caseEditId = null;
  document.getElementById('caseForm').querySelectorAll('input').forEach(el => el.value = '');
  document.getElementById('caseRequired').value = '1';
  document.getElementById('saveCaseBtn').textContent = 'Add Case';
  document.getElementById('cancelCaseBtn').style.display = 'none';
}
function resetUserForm() {
  userEditId = null;
  document.getElementById('userEmail').value = '';
  document.getElementById('userPassword').value = '';
  document.getElementById('userName').value = '';
  document.getElementById('userRole').selectedIndex = 0;
  document.getElementById('userProgram').value = '';
  document.getElementById('userProgramGroup').style.display = 'none';
  document.getElementById('saveUserBtn').textContent = 'Create User';
  document.getElementById('cancelUserBtn').style.display = 'none';
}

// ---- Loaders ----
async function loadHospitals() {
  const tbody = document.getElementById('hospitalTableBody');
  if (!tbody) return;
  try {
    const hospitals = await getHospitals();
    if (!hospitals || hospitals.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">No hospitals found.</td></tr>';
      return;
    }
    tbody.innerHTML = hospitals.map(h => `
      <tr>
        <td>${h.name}</td>
        <td>${h.address || '-'}</td>
        <td>${h.latitude ?? '-'}</td>
        <td>${h.longitude ?? '-'}</td>
        <td>${h.attendance_radius ?? '-'}</td>
        <td>
          <button class="edit-hospital btn-primary" data-id="${h.id}">Edit</button>
          <button class="delete-hospital btn-secondary" data-id="${h.id}">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">Error: ${err.message}</td></tr>`;
  }
}

async function loadHospitalSelects() {
  const select = document.getElementById('deptHospital');
  if (!select) return;
  try {
    const hospitals = await getHospitals();
    select.innerHTML = '<option value="">Select Hospital</option>' +
      hospitals.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
  } catch (err) {
    showToast('Error loading hospitals: ' + err.message, 'error');
  }
}

async function loadDepartments() {
  const tbody = document.getElementById('deptTableBody');
  if (!tbody) return;
  try {
    const departments = await getDepartments();
    if (!departments || departments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3">No departments found.</td></tr>';
      return;
    }
    tbody.innerHTML = departments.map(d => `
      <tr>
        <td>${d.name}</td>
        <td>${d.hospitalName || 'N/A'}</td>
        <td>
          <button class="edit-dept btn-primary" data-id="${d.id}">Edit</button>
          <button class="delete-dept btn-secondary" data-id="${d.id}">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3">Error: ${err.message}</td></tr>`;
  }
}

async function loadCases() {
  const tbody = document.getElementById('caseTableBody');
  if (!tbody) return;
  try {
    const cases = await getCaseLibrary();
    if (!cases || cases.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No cases found.</td></tr>';
      return;
    }
    tbody.innerHTML = cases.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.category || '-'}</td>
        <td>${c.required_min}</td>
        <td>${c.program || 'All'}</td>
        <td>
          <button class="edit-case btn-primary" data-id="${c.id}">Edit</button>
          <button class="delete-case btn-secondary" data-id="${c.id}">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">Error: ${err.message}</td></tr>`;
  }
}

async function loadUsers() {
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;
  try {
    const users = await getAllUsers();
    if (!users || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
      return;
    }
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.name || '-'}</td>
        <td>${u.email}</td>
        <td><span class="status-badge ${u.role}">${u.role}</span></td>
        <td>${u.program || '-'}</td>
        <td>
          <button class="edit-user btn-primary" data-id="${u.id}">Edit</button>
          <button class="delete-user btn-secondary" data-id="${u.id}">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">Error: ${err.message}</td></tr>`;
  }
}

// ---- Edit handlers ----
async function editHospital(id) {
  try {
    const { data, error } = await supabase.from('hospitals').select('*').eq('id', id).single();
    if (error) throw error;
    hospitalEditId = id;
    document.getElementById('hospitalName').value = data.name || '';
    document.getElementById('hospitalAddress').value = data.address || '';
    document.getElementById('hospitalLat').value = data.latitude ?? '';
    document.getElementById('hospitalLng').value = data.longitude ?? '';
    document.getElementById('hospitalRadius').value = data.attendance_radius ?? '100';
    document.getElementById('saveHospitalBtn').textContent = 'Update Hospital';
    document.getElementById('cancelHospitalBtn').style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function editDept(id) {
  try {
    const { data, error } = await supabase.from('departments').select('*').eq('id', id).single();
    if (error) throw error;
    deptEditId = id;
    document.getElementById('deptName').value = data.name || '';
    document.getElementById('deptHospital').value = data.hospital_id || '';
    document.getElementById('saveDeptBtn').textContent = 'Update Department';
    document.getElementById('cancelDeptBtn').style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function editCase(id) {
  try {
    const { data, error } = await supabase.from('case_library').select('*').eq('id', id).single();
    if (error) throw error;
    caseEditId = id;
    document.getElementById('caseName').value = data.name || '';
    document.getElementById('caseDesc').value = data.description || '';
    document.getElementById('caseCategory').value = data.category || '';
    document.getElementById('caseRequired').value = data.required_min ?? '1';
    document.getElementById('caseProgram').value = data.program || '';
    document.getElementById('saveCaseBtn').textContent = 'Update Case';
    document.getElementById('cancelCaseBtn').style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function editUser(id) {
  try {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error) throw error;
    userEditId = id;
    document.getElementById('userEmail').value = data.email || '';
    document.getElementById('userName').value = data.name || '';
    document.getElementById('userRole').value = data.role || 'student';
    document.getElementById('userProgram').value = data.program || '';
    document.getElementById('userProgramGroup').style.display = (data.role === 'student') ? 'block' : 'none';
    document.getElementById('saveUserBtn').textContent = 'Update User';
    document.getElementById('cancelUserBtn').style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ---- Delete handlers ----
async function deleteHospitalRecord(id) {
  if (!confirm('Delete this hospital? This cannot be undone.')) return;
  try {
    await deleteHospital(id);
    showToast('Hospital deleted.', 'success');
    loadHospitals();
    loadHospitalSelects();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}
async function deleteDeptRecord(id) {
  if (!confirm('Delete this department?')) return;
  try {
    await deleteDepartment(id);
    showToast('Department deleted.', 'success');
    loadDepartments();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}
async function deleteCaseRecord(id) {
  if (!confirm('Delete this case?')) return;
  try {
    await deleteCase(id);
    showToast('Case deleted.', 'success');
    loadCases();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}
async function deleteUserRecord(id) {
  if (!confirm('Delete this user? This cannot be undone.')) return;
  try {
    await deleteUser(id);
    showToast('User deleted.', 'success');
    loadUsers();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}