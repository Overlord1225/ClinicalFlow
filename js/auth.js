// js/auth.js
import { getCurrentUser as getSupabaseUser, logout as logoutUser } from './data.js';

export function getCurrentUser() {
  return getSupabaseUser();
}

export function getDefaultDashboard(role) {
  switch (role) {
    case 'student':
      return 'student-dashboard.html';
    case 'ci':
      return 'ci-dashboard.html';
    case 'scheduler':
      return 'scheduler-dashboard.html';
    case 'admin':
      return 'admin.html';
    default:
      return 'index.html';
  }
}

export function redirectToRoleDashboard(role = getCurrentUser()?.role) {
  const target = getDefaultDashboard(role);
  if (window.location.pathname.split('/').pop() !== target) {
    window.location.href = target;
  }
  return target;
}

export function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  return user;
}

export async function logout() {
  await logoutUser();
}

export function requireRole(allowedRoles) {
  const user = requireAuth();
  if (!user) return null;
  if (!allowedRoles.includes(user.role)) {
    alert('Access denied. You do not have permission for this page.');
    redirectToRoleDashboard(user.role);
    return null;
  }
  return user;
}