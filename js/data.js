import { supabase } from './supabaseClient.js';

export let currentUser = null;

// ---- Sign In ----
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (userError) throw userError;
  if (!userData) throw new Error('User profile not found. Please contact support.');

  currentUser = userData;
  sessionStorage.setItem('clinicalflow_user', JSON.stringify(currentUser));
  return currentUser;
}

// ---- Ensure default admin account exists ----
export async function ensureAdminAccount() {
  const adminEmail = 'admin@sipag.com';
  const adminPassword = 'password123';

  // 1. Check if admin row exists in users table
  const { data: existingRow, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', adminEmail)
    .eq('role', 'admin')
    .maybeSingle();

  // 2. Try to sign in with default credentials
  let authUser = null;
  let passwordCorrect = false;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });
    if (!error && data.user) {
      authUser = data.user;
      passwordCorrect = true;
    } else if (error && error.message.includes('Invalid login credentials')) {
      console.warn('Admin Auth user exists but password is incorrect. Will recreate.');
    }
  } catch (e) {
    // Auth user might not exist – we'll proceed to create
  }

  // 3. If sign-in succeeded and row exists, all good
  if (passwordCorrect && existingRow) {
    console.log('Admin account is fully set up.');
    return;
  }

  // 4. If sign-in succeeded but row is missing, insert it
  if (passwordCorrect && !existingRow) {
    const { error: insertError } = await supabase
      .from('users')
      .insert([{
        id: authUser.id,
        email: adminEmail,
        role: 'admin',
        name: 'System Admin',
        program: null
      }]);
    if (insertError) {
      console.error('Failed to insert admin row:', insertError);
      throw insertError;
    }
    console.log('Admin row inserted.');
    return;
  }

  // 5. If we have an orphan row (row exists but Auth missing or wrong password)
  if (existingRow && !passwordCorrect) {
    // Clean up foreign key references (announcements, etc.)
    await supabase
      .from('announcements')
      .delete()
      .eq('sender_id', existingRow.id);
    // Delete the orphan row
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', existingRow.id);
    if (deleteError) {
      console.error('Failed to delete orphan admin row:', deleteError);
      throw deleteError;
    }
    console.log('Orphan admin row deleted.');
  }

  // 6. Create a fresh admin via sign-up
  try {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: adminEmail,
      password: adminPassword,
      options: {
        data: {
          role: 'admin',
          name: 'System Admin',
          program: null
        }
      }
    });
    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: adminEmail,
          password: adminPassword,
        });
        if (!signInError && signInData.user) {
          await supabase.from('users').insert([{
            id: signInData.user.id,
            email: adminEmail,
            role: 'admin',
            name: 'System Admin',
            program: null
          }]);
          console.log('Admin row inserted after sign-in.');
          return;
        }
      }
      throw signUpError;
    }
    console.log('Admin account created successfully.');
  } catch (err) {
    console.error('Admin account creation failed:', err);
  }
}

// ---- Get current user from session ----
export function getCurrentUser() {
  if (currentUser) return currentUser;
  const stored = sessionStorage.getItem('clinicalflow_user');
  if (stored) {
    currentUser = JSON.parse(stored);
    return currentUser;
  }
  return null;
}

// ============================================================
// INCIDENT REPORTS
// ============================================================

export async function createIncidentReport(report) {
  const { error } = await supabase
    .from('incident_reports')
    .insert([report]);
  if (error) throw error;
}

export async function getIncidentReportsForUser(userId) {
  const { data, error } = await supabase
    .from('incident_reports')
    .select('*')
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAllIncidentReports() {
  const { data, error } = await supabase
    .from('incident_reports')
    .select('*, reporter:reporter_id (name, email, role)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateIncidentReportStatus(id, status) {
  const { error } = await supabase
    .from('incident_reports')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
// STUDENT ATTENDANCE HISTORY
// ============================================================

export async function getAttendanceHistory(studentId) {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      id,
      time_in,
      time_out,
      status,
      schedule:schedule_id (
        date,
        start_time,
        end_time,
        case_type,
        hospital:hospital_id (name, address),
        department:department_id (name)
      )
    `)
    .eq('student_id', studentId)
    .order('time_in', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============================================================
// STUDENT SECTIONS (for scheduler)
// ============================================================

export async function getStudentsBySection(section) {
  let query = supabase
    .from('users')
    .select('id, name, program, section')
    .eq('role', 'student');
  if (section) {
    query = query.eq('section', section);
  }
  const { data, error } = await query.order('name');
  if (error) throw error;
  return data || [];
}

export async function getSections() {
  const { data, error } = await supabase
    .from('users')
    .select('section')
    .eq('role', 'student')
    .not('section', 'is', null);
  if (error) throw error;
  const sections = [...new Set(data.map(item => item.section).filter(Boolean))];
  return sections;
}

// ============================================================
// CI ASSIGNED STUDENTS & LOCATION
// ============================================================

export async function getAssignedStudents(ciId) {
  // Get distinct students from schedules where ci_id = ciId
  const { data, error } = await supabase
    .from('schedules')
    .select(`
      student:student_id (id, name, program, section)
    `)
    .eq('ci_id', ciId)
    .neq('status', 'cancelled');
  if (error) throw error;
  // Deduplicate students
  const studentMap = new Map();
  data.forEach(item => {
    if (item.student) {
      studentMap.set(item.student.id, item.student);
    }
  });
  return Array.from(studentMap.values());
}

export async function getCIAssignedHospital(ciId) {
  // Get the most frequent hospital from schedules, or the next upcoming one
  const { data, error } = await supabase
    .from('schedules')
    .select(`
      hospital:hospital_id (id, name, address, latitude, longitude)
    `)
    .eq('ci_id', ciId)
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: true })
    .limit(1);
  if (error) throw error;
  if (data && data.length > 0) {
    return data[0].hospital;
  }
  return null;
}

// ---- Logout ----
export async function logout() {
  await supabase.auth.signOut();
  sessionStorage.removeItem('clinicalflow_user');
  currentUser = null;
  window.location.href = 'index.html';
}

// ---- Student helpers ----
export async function getStudent(id) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, program, students(year)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return { id, name: 'Unknown', program: 'BSN', year: 1 };
    }
    return {
      id: data.id,
      name: data.name,
      program: data.program || 'BSN',
      year: data.students?.[0]?.year || 1,
    };
  } catch (err) {
    // Fallback: the students relationship may not exist in all deployments
    const { data } = await supabase
      .from('users')
      .select('id, name, program')
      .eq('id', id)
      .maybeSingle();
    if (data) {
      return { id: data.id, name: data.name, program: data.program || 'BSN', year: 1 };
    }
    return { id, name: 'Unknown', program: 'BSN', year: 1 };
  }
}

export async function getProgress(studentId) {
  const { data: library, error: libError } = await supabase
    .from('case_library')
    .select('id, name, required_min, category');
  if (libError) throw libError;

  const { data: progress, error: progError } = await supabase
    .from('case_progress')
    .select('case_library_id, status, verified_by')
    .eq('student_id', studentId)
    .eq('status', 'verified');
  if (progError) throw progError;

  const completionCount = {};
  progress.forEach(p => {
    completionCount[p.case_library_id] = (completionCount[p.case_library_id] || 0) + 1;
  });

  const cases = library.map(lib => ({
    id: lib.id,
    name: lib.name,
    category: lib.category,
    required: lib.required_min,
    completed: completionCount[lib.id] || 0,
    status: (completionCount[lib.id] || 0) >= lib.required_min ? 'complete' : 'pending',
  }));

  return { studentId, cases };
}

// ---- Schedules ----
export async function getSchedules(studentId) {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        hospital:hospital_id (name),
        department:department_id (name)
      `)
      .eq('student_id', studentId);
    if (error) {
      console.error('Error fetching schedules:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getSchedules:', error);
    return [];
  }
}

export async function getAllSchedules() {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        student:users!student_id (name),
        ci:users!ci_id (name)
      `);
    if (error) {
      console.error('Error fetching all schedules:', error);
      return [];
    }
    return (data || []).map(s => ({ 
      ...s, 
      studentName: s.student?.name || 'Unknown',
      ciName: s.ci?.name || 'Unknown'
    }));
  } catch (error) {
    console.error('Error in getAllSchedules:', error);
    return [];
  }
}

// ---- Notifications ----
export async function getNotifications(userId) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getNotifications:', error);
    return [];
  }
}

export async function markRead(notifId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notifId);
    if (error) throw error;
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

// ---- Opportunity Board ----
export async function getAvailableSlots() {
  const { data, error } = await supabase
    .from('open_slots')
    .select(`
      *,
      hospital:hospital_id (name),
      department:department_id (name),
      ci:ci_id (name)
    `)
    .order('date', { ascending: true });
  if (error) throw error;

  return data.map(s => ({
    ...s,
    hospital: s.hospital?.name || 'Unknown',
    department: s.department?.name || 'Unknown',
    ciName: s.ci?.name || 'Unknown',
  }));
}

// Alias for compatibility
export async function getOpenSlots() {
  return getAvailableSlots();
}

export async function getStudentsByIds(ids) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name')
      .in('id', ids);
    if (error) {
      console.error('Error fetching students:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getStudentsByIds:', error);
    return [];
  }
}

export async function claimSlot(slotId, studentId) {
  const { data: slot, error: fetchError } = await supabase
    .from('open_slots')
    .select('*')
    .eq('id', slotId)
    .single();
  if (fetchError) throw fetchError;
  if (!slot) throw new Error('Slot not found');

  const { error: insertError } = await supabase
    .from('schedules')
    .insert([{
      student_id: studentId,
      ci_id: slot.ci_id,
      hospital_id: slot.hospital_id,
      department_id: slot.department_id,
      date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      case_type: slot.case_type,
      status: 'scheduled',
    }]);
  if (insertError) throw insertError;

  const { error: appError } = await supabase
    .from('slot_applications')
    .insert([{
      slot_id: slotId,
      student_id: studentId,
      status: 'approved',
    }]);
  if (appError) throw appError;

  const { error: deleteError } = await supabase
    .from('open_slots')
    .delete()
    .eq('id', slotId);
  if (deleteError) throw deleteError;

  const { data: hospitalData, error: hospError } = await supabase
    .from('hospitals')
    .select('name')
    .eq('id', slot.hospital_id)
    .single();
  const hospitalName = !hospError && hospitalData ? hospitalData.name : 'Unknown';
  
  await supabase
    .from('notifications')
    .insert([{
      user_id: studentId,
      message: `You have claimed a duty slot: ${slot.case_type} at ${hospitalName} on ${slot.date}`,
      type: 'slot_claimed',
    }]);

  return true;
}

// ---- Announcements ----
export async function sendAnnouncement(message, senderId, targetRole = 'student') {
  const { error: annError } = await supabase
    .from('announcements')
    .insert([{
      sender_id: senderId,
      title: 'Announcement',
      content: message,
      target_role: targetRole,
    }]);
  if (annError) throw annError;

  const { data: users, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', targetRole);
  if (error) throw error;

  if (users.length > 0) {
    const notifications = users.map(user => ({
      user_id: user.id,
      message: message,
      read: false,
      type: 'announcement',
      created_at: new Date().toISOString(),
    }));
    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notifications);
    if (notifError) throw notifError;
  }

  return users.length;
}

// ---- Absence Management ----
export async function markAbsent(scheduleId, studentId) {
  const { error: updateError } = await supabase
    .from('schedules')
    .update({ status: 'absent' })
    .eq('id', scheduleId);
  if (updateError) throw updateError;

  const { data: schedule, error: fetchError } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', scheduleId)
    .single();
  if (fetchError) throw fetchError;

  const { error: insertError } = await supabase
    .from('open_slots')
    .insert([{
      hospital_id: schedule.hospital_id,
      department_id: schedule.department_id,
      ci_id: schedule.ci_id,
      date: schedule.date,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      case_type: schedule.case_type,
      max_students: 1,
      is_makeup: true,
    }]);
  if (insertError) throw insertError;

  await supabase
    .from('notifications')
    .insert([{
      user_id: studentId,
      message: `You were marked absent for ${schedule.case_type} on ${schedule.date}. A make‑up duty has been queued.`,
      type: 'absence',
    }]);

  return true;
}

// ---- Attendance ----
export async function getUpcomingSchedule(studentId) {
  const today = new Date().toLocaleDateString('en-CA');
  const { data, error } = await supabase
    .from('schedules')
    .select(`
      id,
      date,
      start_time,
      end_time,
      case_type,
      hospital:hospital_id (id, name, latitude, longitude, attendance_radius),
      department:department_id (name),
      ci:ci_id (name),
      attendance(*)
    `)
    .eq('student_id', studentId)
    .eq('status', 'scheduled')
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const s = data[0];
  return {
    ...s,
    hospital: s.hospital ? { ...s.hospital } : null,
    department: s.department?.name || 'N/A',
    ciName: s.ci?.name || 'N/A',
    attendance: s.attendance || [],
  };
}

export async function getHospitalCoordinates(hospitalId) {
  const { data, error } = await supabase
    .from('hospitals')
    .select('latitude, longitude, attendance_radius')
    .eq('id', hospitalId)
    .single();
  if (error) throw error;
  return data;
}

export async function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error('GPS error: ' + err.message))
    );
  });
}

function distance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function verifyGPS(studentId, scheduleId) {
  const { data: schedule, error } = await supabase
    .from('schedules')
    .select('hospital_id, hospital:hospital_id (latitude, longitude, attendance_radius)')
    .eq('id', scheduleId)
    .single();
  if (error) throw error;
  const hospital = schedule.hospital;
  if (!hospital) throw new Error('Hospital not found');

  const pos = await getCurrentPosition();
  const dist = distance(pos.lat, pos.lng, hospital.latitude, hospital.longitude);
  const radius = hospital.attendance_radius || 100;
  const within = dist <= radius;
  return {
    within,
    distance: dist,
    radius,
    position: pos,
    hospitalCoords: { lat: hospital.latitude, lng: hospital.longitude }
  };
}

export async function recordAttendance(scheduleId, studentId, timeIn, timeOut, gpsData, faceVerified, livenessPassed, method, status) {
  const { error } = await supabase
    .from('attendance')
    .insert([{
      schedule_id: scheduleId,
      student_id: studentId,
      time_in: timeIn,
      time_out: timeOut,
      gps_in: gpsData?.in || null,
      gps_out: gpsData?.out || null,
      face_verified: faceVerified || false,
      liveness_passed: livenessPassed || false,
      status: status || 'on_time',
      verification_method: method || 'biometric',
    }]);
  if (error) throw error;
}

export async function updateAttendance(scheduleId, studentId, updates) {
  const { error } = await supabase
    .from('attendance')
    .update(updates)
    .eq('schedule_id', scheduleId)
    .eq('student_id', studentId);
  if (error) throw error;
}

export async function getAttendanceForSchedule(scheduleId, studentId) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('schedule_id', scheduleId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAttendanceForStudent(studentId) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', studentId);
  if (error) throw error;
  return data || [];
}

// ---- Manual Attendance (CI override) ----
export async function markAttendanceManually(scheduleId, studentId, status, reason = null) {
  const existing = await getAttendanceForSchedule(scheduleId, studentId);
  const now = new Date().toISOString();
  const currentUser = await getCurrentUser();

  if (existing) {
    const updates = {
      status: status,
      verification_method: 'manual',
      verified_by: currentUser?.id || null,
      updated_at: now,
    };
    if (status !== 'absent' && !existing.time_in) {
      updates.time_in = now;
    }
    const { error } = await supabase
      .from('attendance')
      .update(updates)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const insertData = {
      schedule_id: scheduleId,
      student_id: studentId,
      status: status,
      verification_method: 'manual',
      verified_by: currentUser?.id || null,
      time_in: status !== 'absent' ? now : null,
      time_out: null,
    };
    const { error } = await supabase
      .from('attendance')
      .insert([insertData]);
    if (error) throw error;
  }

  if (status === 'absent') {
    await markAbsent(scheduleId, studentId);
    return true;
  }

  const statusLabel = { on_time: 'Present', late: 'Late', absent: 'Absent' }[status];
  await supabase
    .from('notifications')
    .insert([{
      user_id: studentId,
      message: `Your attendance for duty on ${new Date(now).toLocaleDateString()} was marked as ${statusLabel} by CI.${reason ? ' Reason: ' + reason : ''}`,
      type: 'attendance_override',
    }]);

  return true;
}

// ---- Schedule Management (CRUD) ----
export async function getStudents() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, program')
    .eq('role', 'student')
    .order('name');
  if (error) throw error;
  return data;
}

export async function getCIs() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'ci')
    .order('name');
  if (error) throw error;
  return data;
}

export async function getDepartmentsByHospital(hospitalId) {
  if (!hospitalId) return [];
  const { data, error } = await supabase
    .from('departments')
    .select('id, name')
    .eq('hospital_id', hospitalId)
    .order('name');
  if (error) throw error;
  return data;
}

export async function createSchedule(scheduleData) {
  const { error } = await supabase
    .from('schedules')
    .insert([scheduleData]);
  if (error) throw error;
  return true;
}

export async function updateSchedule(scheduleId, updates) {
  const { error } = await supabase
    .from('schedules')
    .update(updates)
    .eq('id', scheduleId);
  if (error) throw error;
}

export async function deleteSchedule(scheduleId) {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', scheduleId);
  if (error) throw error;
}

// ---- Admin user creation ----
export async function createUserByAdmin(email, password, role, name, program) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, name, program: program || 'BSN' }
    }
  });
  if (error) throw error;
  return data.user;
}

// ---- Admin Management ----
// Hospitals
export async function getHospitals() {
  const { data, error } = await supabase
    .from('hospitals')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

export async function createHospital(hospital) {
  const { error } = await supabase
    .from('hospitals')
    .insert([hospital]);
  if (error) throw error;
}

export async function updateHospital(id, updates) {
  const { error } = await supabase
    .from('hospitals')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteHospital(id) {
  const { error } = await supabase
    .from('hospitals')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Departments
export async function getDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('*, hospital:hospital_id (name)')
    .order('name');
  if (error) throw error;
  return data.map(d => ({ ...d, hospitalName: d.hospital?.name || 'Unknown' }));
}

export async function createDepartment(dept) {
  const { error } = await supabase
    .from('departments')
    .insert([dept]);
  if (error) throw error;
}

export async function updateDepartment(id, updates) {
  const { error } = await supabase
    .from('departments')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteDepartment(id) {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Case Library
export async function getCaseLibrary() {
  const { data, error } = await supabase
    .from('case_library')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

export async function createCase(caseItem) {
  const { error } = await supabase
    .from('case_library')
    .insert([caseItem]);
  if (error) throw error;
}

export async function updateCase(id, updates) {
  const { error } = await supabase
    .from('case_library')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCase(id) {
  const { count, error: countError } = await supabase
    .from('case_progress')
    .select('id', { count: 'exact', head: true })
    .eq('case_library_id', id);
  if (countError) throw countError;
  if (count > 0) {
    throw new Error('Cannot delete case because it has progress records. Archive instead.');
  }
  const { error } = await supabase
    .from('case_library')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Users (Admin)
export async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role, name, program, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteUser(id) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function updateUser(id, updates) {
  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

// ---- Student Progress Summary (Aggregated) ----
export async function getStudentProgressSummary() {
  // Get all students
  const { data: students, error } = await supabase
    .from('users')
    .select('id, name, program')
    .eq('role', 'student');
  if (error) throw error;

  // Get all case library items to know required counts
  const { data: library, error: libError } = await supabase
    .from('case_library')
    .select('id, required_min');
  if (libError) throw libError;

  const requiredMap = {};
  library.forEach(l => { requiredMap[l.id] = l.required_min; });

  // Get all verified case progress
  const { data: progress, error: progError } = await supabase
    .from('case_progress')
    .select('student_id, case_library_id')
    .eq('status', 'verified');
  if (progError) throw progError;

  const completionMap = {};
  progress.forEach(p => {
    const key = `${p.student_id}-${p.case_library_id}`;
    completionMap[key] = (completionMap[key] || 0) + 1;
  });

  const result = students.map(student => {
    let total = 0;
    let completed = 0;
    Object.keys(requiredMap).forEach(caseId => {
      total += requiredMap[caseId];
      const key = `${student.id}-${caseId}`;
      completed += Math.min(completionMap[key] || 0, requiredMap[caseId]);
    });
    return {
      ...student,
      total,
      completed,
      percentage: total ? Math.round((completed / total) * 100) : 0,
    };
  });

  // Count absences per student
  const { data: absences, error: absError } = await supabase
    .from('schedules')
    .select('student_id')
    .eq('status', 'absent');
  if (!absError && absences) {
    const absenceCount = {};
    absences.forEach(a => { absenceCount[a.student_id] = (absenceCount[a.student_id] || 0) + 1; });
    result.forEach(s => s.absences = absenceCount[s.id] || 0);
  }

  return result;
}

// ---- Hospital Utilization ----
export async function getHospitalUtilization() {
  const { data, error } = await supabase
    .from('schedules')
    .select(`
      status,
      case_type,
      hospital:hospital_id (name)
    `);
  if (error) throw error;

  const utilization = {};
  data.forEach(row => {
    const hospitalName = row.hospital?.name || 'Unknown';
    const caseType = row.case_type || 'Total';
    if (!utilization[hospitalName]) utilization[hospitalName] = {};
    if (!utilization[hospitalName][caseType]) {
      utilization[hospitalName][caseType] = { total: 0, completed: 0 };
    }
    utilization[hospitalName][caseType].total++;
    if (row.status === 'completed') {
      utilization[hospitalName][caseType].completed++;
    }
  });
  return utilization;
}

// ---- Recommendation Engine ----
export async function getRecommendationWeights() {
  const { data, error } = await supabase
    .from('recommendation_weights')
    .select('*')
    .order('weight', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateRecommendationWeight(criterion, weight) {
  const { error } = await supabase
    .from('recommendation_weights')
    .update({ weight, updated_at: new Date().toISOString() })
    .eq('criterion', criterion);
  if (error) throw error;
}

// Compute recommendation score for a student for a given slot
export async function computeRecommendationScore(studentId, slotId) {
  const { data: slot, error: slotError } = await supabase
    .from('open_slots')
    .select('*, hospital:hospital_id (id), department:department_id (id)')
    .eq('id', slotId)
    .single();
  if (slotError) throw slotError;

  const progress = await getProgress(studentId);
  const student = await getStudent(studentId);
  const schedules = await getSchedules(studentId);
  const attendanceRecords = await getAttendanceForStudent(studentId);

  const weights = await getRecommendationWeights();
  const weightMap = {};
  weights.forEach(w => weightMap[w.criterion] = w.weight);

  let score = 0;

  const caseMatch = progress.cases.some(c => c.status === 'pending' && c.name === slot.case_type);
  if (caseMatch) score += (weightMap['Needs Required Clinical Case'] || 40);

  score += (weightMap['No Academic Class Conflict'] || 30);

  const hasConflict = schedules.some(s => s.date === slot.date && s.status === 'scheduled');
  if (!hasConflict) score += (weightMap['No Existing Duty Conflict'] || 25);

  const absences = attendanceRecords.filter(a => a.status === 'absent').length;
  const totalAtt = attendanceRecords.length;
  const attendanceRate = totalAtt > 0 ? (totalAtt - absences) / totalAtt : 1;
  if (attendanceRate > 0.95) score += (weightMap['Attendance Rate Above 95%'] || 20);

  const completedCount = schedules.filter(s => s.status === 'completed').length;
  const hoursPenalty = Math.min(completedCount, 10) / 10;
  score += (1 - hoursPenalty) * (weightMap['Lower Completed Duty Hours'] || 15);

  const hasMakeup = schedules.some(s => s.status === 'absent');
  if (hasMakeup) score += (weightMap['High Priority Make-up Duty'] || 10);

  if (absences > 5) {
    score += (weightMap['More than 5 Late Records'] || -20);
  } else if (absences > 3) {
    score += (weightMap['More than 3 Absences'] || -30);
  }

  const alreadyCompleted = progress.cases.some(c => c.status === 'complete' && c.name === slot.case_type);
  if (alreadyCompleted) score += (weightMap['Already Completed Required Case'] || -40);

  const slotDate = new Date(slot.date);
  const weekStart = new Date(slotDate);
  weekStart.setDate(slotDate.getDate() - slotDate.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekSchedules = schedules.filter(s => {
    const d = new Date(s.date);
    return d >= weekStart && d <= weekEnd;
  });
  if (weekSchedules.length >= 3) score += (weightMap['Weekly Duty Hour Limit Reached'] || -50);

  return {
    studentId,
    studentName: student.name,
    score: Math.round(score),
    details: {
      caseMatch,
      hasConflict,
      attendanceRate,
      completedCount,
      absences,
      hasMakeup,
      alreadyCompleted,
      weekSchedulesCount: weekSchedules.length,
    }
  };
}

export async function getRecommendationsForSlot(slotId) {
  const { data: students, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'student');
  if (error) throw error;

  const results = await Promise.all(
    students.map(s => computeRecommendationScore(s.id, slotId))
  );

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 10);
}

export { 
  supabase
};