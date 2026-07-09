import { requireAuth } from '../auth.js';
import { supabase } from '../supabaseClient.js';
import { getNotifications, markRead } from '../data.js';
import { showToast, showLoading, hideLoading } from '../utils.js';
import { updateNotifBadge as updateSidebarNotifBadge } from './sidebar.js';

export { updateSidebarNotifBadge as updateNotifBadge };

let notifSubscription = null;

export function subscribeToNotifications(userId) {
  if (notifSubscription) {
    notifSubscription.unsubscribe();
    notifSubscription = null;
  }

  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const newNotif = payload.new;
        const container = document.getElementById('notifList');
        if (container) {
          const notifItem = document.createElement('div');
          notifItem.className = `notif-item unread`;
          notifItem.dataset.id = newNotif.id;
          notifItem.innerHTML = `
            <span class="notif-text">${newNotif.message}</span>
            <span class="notif-time">${new Date(newNotif.created_at).toLocaleString()}</span>
          `;
          notifItem.onclick = () => markNotifRead(newNotif.id);
          container.prepend(notifItem);
          const emptyMsg = container.querySelector('p');
          if (emptyMsg) emptyMsg.remove();
        }

        const currentCount = parseInt(document.getElementById('sidebarNotifBadge')?.textContent || '0');
        updateSidebarNotifBadge(currentCount + 1);

        if (newNotif.type === 'absence' || newNotif.type === 'schedule_change') {
          showToast('🔔 ' + newNotif.message, 'info', 5000);
        }
      }
    )
    .subscribe();

  notifSubscription = channel;
}

export async function markNotifRead(notifId) {
  try {
    await markRead(notifId);
    const item = document.querySelector(`.notif-item[data-id="${notifId}"]`);
    if (item) item.classList.remove('unread');
    const badge = document.getElementById('sidebarNotifBadge');
    if (badge) {
      const current = parseInt(badge.textContent) || 0;
      if (current > 0) updateSidebarNotifBadge(current - 1);
    }
  } catch (err) {
    showToast('Error marking as read: ' + err.message, 'error');
  }
}

export async function initNotifications() {
  const user = requireAuth();
  if (!user) return;

  const container = document.getElementById('notifList');
  try {
    showLoading('notifList', 'Loading notifications...');
    const notifs = await getNotifications(user.id);
    const unreadCount = notifs.filter(n => !n.read).length;
    updateSidebarNotifBadge(unreadCount);

    container.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.read?'':'unread'}" data-id="${n.id}" onclick="window.markNotifRead('${n.id}')">
        <span class="notif-text">${n.message}</span>
        <span class="notif-time">${new Date(n.created_at).toLocaleString()}</span>
      </div>
    `).join('') || '<p>No notifications</p>';

    hideLoading('notifList');
    subscribeToNotifications(user.id);
  } catch (err) {
    console.error('Notifications error:', err);
    hideLoading('notifList');
    showToast('Error loading notifications: ' + err.message, 'error');
  }
}

// Attach markNotifRead to window for inline onclick
window.markNotifRead = markNotifRead;