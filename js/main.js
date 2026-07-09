import { getCurrentUser, requireAuth, requireRole, logout, redirectToRoleDashboard } from './auth.js';
import { renderSidebar } from './modules/sidebar.js';
import { initNotifications, subscribeToNotifications } from './modules/notifications.js';
import { initAttendance } from './modules/attendance.js';
import { initStudentDashboard, initCasePassport, initOpportunityBoard } from './modules/student.js';
import {
  initSchedulerDashboard,
  initHeatmap,
  initCaseVerification,
  initSendAnnouncement,
  initAIMatchmaker,
  initScheduleManagement
} from './modules/scheduler.js';
import { initCIDashboard, initAbsenceMarking } from './modules/ci.js';
import { initAdminAnalytics, initAdminManagement } from './modules/admin.js';
import { initIncidentReport } from './modules/incident.js';
import { ensureAdminAccount, signIn } from './data.js';

// ---- Global logout function (used in sidebar) ----
window.logoutUser = function() {
  logout();
};

async function handleLogin() {
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');

  if (!emailInput || !passwordInput || !loginBtn) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    if (loginError) {
      loginError.textContent = 'Please enter your email and password.';
      loginError.style.display = 'block';
    }
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerHTML = 'Signing in...';
  if (loginError) {
    loginError.style.display = 'none';
  }

  try {
    await ensureAdminAccount();
    const user = await signIn(email, password);
    const targetPage = redirectToRoleDashboard(user.role);
    window.location.href = targetPage;
  } catch (err) {
    console.error('Login error:', err);
    if (loginError) {
      loginError.textContent = err.message || 'Unable to sign in. Please check your credentials.';
      loginError.style.display = 'block';
    }
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = 'Sign In <i class="fas fa-arrow-right"></i>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const path = window.location.pathname.split('/').pop();

  // Login page (no sidebar needed)
  if (path === 'index.html') {
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.getElementById('loginBtn');

    if (emailInput) {
      emailInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') handleLogin();
      });
    }
    if (passwordInput) {
      passwordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') handleLogin();
      });
    }
    if (loginBtn) {
      loginBtn.addEventListener('click', handleLogin);
    }

    if (getCurrentUser()) {
      window.location.href = redirectToRoleDashboard(getCurrentUser().role);
    }
    return;
  }

  // Ensure admin account exists (only if no user is logged in)
  const user = getCurrentUser();
  const allowedPagesByRole = {
    student: ['student-dashboard.html', 'case-passport.html', 'attendance.html', 'opportunity-board.html', 'incident-report.html', 'notifications.html'],
    scheduler: ['scheduler-dashboard.html', 'schedule-management.html', 'ai-matchmaker.html', 'notifications.html'],
    ci: ['ci-dashboard.html', 'incident-report.html', 'notifications.html'],
    admin: ['admin.html', 'schedule-management.html', 'ai-matchmaker.html', 'notifications.html']
  };

  if (user && path !== 'notifications.html' && !allowedPagesByRole[user.role]?.includes(path)) {
    redirectToRoleDashboard(user.role);
    return;
  }
  if (!user) {
    try {
      await ensureAdminAccount();
    } catch (err) {
      console.warn('Admin account check failed:', err);
    }
  }

  // Render sidebar
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
      'opportunity-board.html': 'opportunity-board.html',
      'incident-report.html': 'incident-report.html'
    };
    sidebarContainer.innerHTML = renderSidebar(activeMap[path] || '');
  }

  // Route to appropriate initializer
  if (path === 'student-dashboard.html') {
    requireRole(['student']);
    await initStudentDashboard();
  } else if (path === 'scheduler-dashboard.html') {
    requireRole(['scheduler', 'admin']);
    await initSchedulerDashboard();
    await initHeatmap();
    await initCaseVerification();
    initSendAnnouncement();
  } else if (path === 'ci-dashboard.html') {
    requireRole(['ci']);
    await initCIDashboard();
  } else if (path === 'admin.html') {
    requireRole(['admin']);
    await initAdminAnalytics();
    await initAdminManagement();
    initSendAnnouncement();
  } else if (path === 'case-passport.html') {
    requireRole(['student']);
    await initCasePassport();
  } else if (path === 'attendance.html') {
    requireRole(['student']);
    await initAttendance();
  } else if (path === 'ai-matchmaker.html') {
    requireRole(['scheduler', 'admin']);
    await initAIMatchmaker();
  } else if (path === 'notifications.html') {
    requireAuth();
    await initNotifications();
  } else if (path === 'opportunity-board.html') {
    requireRole(['student']);
    await initOpportunityBoard();
  } else if (path === 'schedule-management.html') {
    requireRole(['scheduler', 'admin']);
    await initScheduleManagement();
  } else if (path === 'incident-report.html') {
    requireRole(['student', 'ci']);
    await initIncidentReport();
  }

  // Subscribe to notifications for any logged-in user
  const currentUser = getCurrentUser();
  if (currentUser && path !== 'notifications.html') {
    subscribeToNotifications(currentUser.id);
  }
});