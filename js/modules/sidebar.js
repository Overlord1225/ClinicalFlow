import { getCurrentUser } from '../auth.js';

export function renderSidebar(activePage) {
  const user = getCurrentUser();
  if (!user) return '';
  const role = user.role;
  let navItems = [];

  if (role === 'student') {
    navItems = [
      { label: 'Dashboard', icon: 'fa-house', page: 'student-dashboard.html' },
      { label: 'Case Passport', icon: 'fa-passport', page: 'case-passport.html' },
      { label: 'Opportunity Board', icon: 'fa-bullhorn', page: 'opportunity-board.html' },
      { label: 'Attendance', icon: 'fa-fingerprint', page: 'attendance.html' },
      { label: 'Incident Report', icon: 'fa-exclamation-triangle', page: 'incident-report.html' },
      { label: 'Notifications', icon: 'fa-bell', page: 'notifications.html' },
    ];
  } else if (role === 'scheduler') {
    navItems = [
      { label: 'Dashboard', icon: 'fa-gauge-high', page: 'scheduler-dashboard.html' },
      { label: 'Schedule Management', icon: 'fa-calendar-plus', page: 'schedule-management.html' },
      { label: 'AI Matchmaker', icon: 'fa-robot', page: 'ai-matchmaker.html' },
      { label: 'Notifications', icon: 'fa-bell', page: 'notifications.html' },
    ];
  } else if (role === 'ci') {
    navItems = [
      { label: 'Dashboard', icon: 'fa-house', page: 'ci-dashboard.html' },
      { label: 'Incident Report', icon: 'fa-exclamation-triangle', page: 'incident-report.html' },
      { label: 'Notifications', icon: 'fa-bell', page: 'notifications.html' },
    ];
  } else if (role === 'admin') {
    navItems = [
      { label: 'Dashboard', icon: 'fa-gauge-high', page: 'admin.html' },
      { label: 'Notifications', icon: 'fa-bell', page: 'notifications.html' },
    ];
  }

  let html = `<div class="sidebar"><div class="brand">Clinical<span>Flow</span></div>`;
  navItems.forEach(item => {
    const active = item.page === activePage ? 'active' : '';
    html += `<a href="${item.page}" class="nav-item ${active}"><i class="fas ${item.icon}"></i><span>${item.label}</span>`;
    if (item.page === 'notifications.html') {
      html += `<span id="sidebarNotifBadge" class="badge-count" style="display:none;">0</span>`;
    }
    html += `</a>`;
  });
  html += `<div class="nav-item logout" onclick="window.logoutUser()"><i class="fas fa-sign-out-alt"></i><span>Logout</span></div></div>`;
  return html;
}

export function updateNotifBadge(count) {
  const badge = document.getElementById('sidebarNotifBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}