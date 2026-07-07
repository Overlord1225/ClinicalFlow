// js/data.js
import { supabase } from './supabaseClient.js';

// ---- Current user ----
export let currentUser = null;

// ---- Auth functions ----
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

export async function signUp(email, password, role, name, program) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Failed to create user account.');

  const { error: insertError } = await supabase
    .from('users')
    .insert([{ id: data.user.id, email, role, name, program }]);
  if (insertError) throw insertError;

  if (role === 'student') {
    const { error: studentError } = await supabase
      .from('students')
      .insert([{ id: data.user.id, program, year: 1 }]);
    if (studentError) throw studentError;
  }

  await supabase.auth.signInWithPassword({ email, password });

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (userError) throw userError;
  if (!userData) throw new Error('Failed to retrieve user profile after sign-up.');

  currentUser = userData;
  sessionStorage.setItem('clinicalflow_user', JSON.stringify(currentUser));
  return currentUser;
}

export function getCurrentUser() {
  if (currentUser) return currentUser;
  const stored = sessionStorage.getItem('clinicalflow_user');
  if (stored) {
    currentUser = JSON.parse(stored);
    return currentUser;
  }
  return null;
}

export async function logout() {
  await supabase.auth.signOut();
  sessionStorage.removeItem('clinicalflow_user');
  currentUser = null;
  window.location.href = 'index.html';
}

// ---- Data fetching functions ----
export async function getStudent(id) {
  const { data, error } = await supabase
    .from('students')
    .select('*, users(name, program)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return { id, name: 'Unknown', program: 'BSN', year: 1 };
  }
  return { ...data, name: data.users?.name || 'Unknown', program: data.users?.program || 'BSN' };
}

export async function getProgress(studentId) {
  try {
    const { data, error } = await supabase
      .from('required_cases')
      .select(`
        id,
        name,
        case_progress!left(completed, verified_by)
      `)
      .eq('case_progress.student_id', studentId);

    if (error) {
      console.error('Error fetching progress:', error);
      return { studentId, cases: [] };
    }
    
    if (!data || data.length === 0) {
      return { studentId, cases: [] };
    }
    
    const cases = data.map(c => ({
      name: c.name,
      completed: c.case_progress?.[0]?.completed || false,
      verifiedBy: c.case_progress?.[0]?.verified_by || null
    }));
    return { studentId, cases };
  } catch (error) {
    console.error('Error in getProgress:', error);
    return { studentId, cases: [] };
  }
}

export async function getSchedules(studentId) {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
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
      .select('*, users(name)');
    if (error) {
      console.error('Error fetching all schedules:', error);
      return [];
    }
    return (data || []).map(s => ({ ...s, studentName: s.users?.name }));
  } catch (error) {
    console.error('Error in getAllSchedules:', error);
    return [];
  }
}

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

export async function getOpenSlots() {
  try {
    const { data, error } = await supabase
      .from('open_slots')
      .select('*')
      .order('date');
    if (error) {
      console.error('Error fetching open slots:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getOpenSlots:', error);
    return [];
  }
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

// ===== NEW FUNCTIONS =====

// ----- Opportunity Board -----
export async function getAvailableSlots() {
  const { data, error } = await supabase
    .from('open_slots')
    .select('*')
    .order('date');
  if (error) throw error;
  return data;
}

export async function claimSlot(slotId, studentId) {
  // 1. Fetch the slot to get its details
  const { data: slot, error: fetchError } = await supabase
    .from('open_slots')
    .select('*')
    .eq('id', slotId)
    .single();
  if (fetchError) throw fetchError;
  if (!slot) throw new Error('Slot not found');

  // 2. Create a schedule entry for the student
  const { error: insertError } = await supabase
    .from('schedules')
    .insert([{
      student_id: studentId,
      date: slot.date,
      hospital: slot.hospital,
      case_type: slot.case_type,
      status: 'scheduled'
    }]);
  if (insertError) throw insertError;

  // 3. Remove the slot from open_slots
  const { error: deleteError } = await supabase
    .from('open_slots')
    .delete()
    .eq('id', slotId);
  if (deleteError) throw deleteError;

  // 4. Notify the student
  await supabase
    .from('notifications')
    .insert([{
      user_id: studentId,
      message: `You have claimed a duty slot: ${slot.case_type} at ${slot.hospital} on ${slot.date}`
    }]);

  return true;
}

// ----- Announcements -----
export async function sendAnnouncement(message, senderId, targetRole = 'student') {
  const { data: users, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', targetRole);
  if (error) throw error;

  const notifications = users.map(user => ({
    user_id: user.id,
    message: message,
    read: false,
    created_at: new Date().toISOString()
  }));

  const { error: insertError } = await supabase
    .from('notifications')
    .insert(notifications);
  if (insertError) throw insertError;

  return notifications.length;
}

// ----- Absence Management -----
export async function markAbsent(scheduleId, studentId) {
  // 1. Update schedule status to 'absent'
  const { error: updateError } = await supabase
    .from('schedules')
    .update({ status: 'absent' })
    .eq('id', scheduleId);
  if (updateError) throw updateError;

  // 2. Fetch the schedule details to create a make-up slot
  const { data: schedule, error: fetchError } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', scheduleId)
    .single();
  if (fetchError) throw fetchError;

  // 3. Create a make-up open slot for the student
  const { error: insertError } = await supabase
    .from('open_slots')
    .insert([{
      hospital: schedule.hospital,
      case_type: schedule.case_type,
      date: schedule.date, // you might want to add +7 days in a real app
      eligible_students: [studentId]
    }]);
  if (insertError) throw insertError;

  // 4. Notify student
  await supabase
    .from('notifications')
    .insert([{
      user_id: studentId,
      message: `You were marked absent for ${schedule.case_type} at ${schedule.hospital} on ${schedule.date}. A make‑up duty has been queued.`
    }]);

  return true;
}

// ----- Analytics -----
export async function getStudentProgressSummary() {
  try {
    const { data: students, error } = await supabase
      .from('users')
      .select('id, name, program')
      .eq('role', 'student');
    if (error) {
      console.error('Error fetching students:', error);
      return [];
    }

    const result = await Promise.all(students.map(async (student) => {
      const progress = await getProgress(student.id);
      const total = progress.cases.length;
      const completed = progress.cases.filter(c => c.completed).length;
      return {
        ...student,
        total,
        completed,
        percentage: total ? Math.round((completed / total) * 100) : 0
      };
    }));

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
  } catch (error) {
    console.error('Error in getStudentProgressSummary:', error);
    return [];
  }
}

export async function getHospitalUtilization() {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select('hospital, case_type, status');
    if (error) {
      console.error('Error fetching hospital utilization:', error);
      return {};
    }

    const utilization = {};
    (data || []).forEach(row => {
      if (!utilization[row.hospital]) utilization[row.hospital] = {};
      if (!utilization[row.hospital][row.case_type]) {
        utilization[row.hospital][row.case_type] = { total: 0, completed: 0 };
      }
      utilization[row.hospital][row.case_type].total++;
      if (row.status === 'completed') utilization[row.hospital][row.case_type].completed++;
    });
    return utilization;
  } catch (error) {
    console.error('Error in getHospitalUtilization:', error);
    return {};
  }
}

export { supabase };