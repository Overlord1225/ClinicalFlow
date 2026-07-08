import { getCurrentUser, requireAuth } from '../auth.js';
import { createIncidentReport, getIncidentReportsForUser, supabase } from '../data.js';
import { showToast } from '../utils.js';

export async function initIncidentReport() {
  const user = requireAuth();
  if (!user) return;
  if (!['student', 'ci'].includes(user.role)) {
    window.location.href = 'student-dashboard.html';
    return;
  }

  const form = document.getElementById('incidentForm');
  const listContainer = document.getElementById('incidentList');

  async function loadUserReports() {
    try {
      const reports = await getIncidentReportsForUser(user.id);
      if (reports.length === 0) {
        listContainer.innerHTML = '<p>No reports submitted.</p>';
        return;
      }
      listContainer.innerHTML = reports.map(r => `
        <div class="incident-item">
          <div class="incident-header">
            <strong>${r.title}</strong>
            <span class="status-badge ${r.status}">${r.status}</span>
          </div>
          <div class="incident-body">
            <p>${r.description}</p>
            <small>Date: ${r.incident_date} | Location: ${r.location || 'N/A'}</small>
          </div>
        </div>
      `).join('');
    } catch (err) {
      showToast('Error loading reports: ' + err.message, 'error');
    }
  }

  await loadUserReports();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('incidentTitle').value.trim();
    const description = document.getElementById('incidentDescription').value.trim();
    const incidentDate = document.getElementById('incidentDate').value;
    const location = document.getElementById('incidentLocation').value.trim();

    if (!title || !description || !incidentDate) {
      showToast('Please fill in all required fields.', 'warning');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      await createIncidentReport({
        reporter_id: user.id,
        reporter_role: user.role,
        title,
        description,
        incident_date: incidentDate,
        location: location || null,
        status: 'submitted'
      });

      showToast('Incident report submitted successfully.', 'success');
      form.reset();
      await loadUserReports();

      // Notify schedulers/admins and open a mail draft for email-based alerting
      const { data: recipients } = await supabase
        .from('users')
        .select('id, email, role')
        .in('role', ['scheduler', 'admin']);

      if (recipients && recipients.length > 0) {
        const notifications = recipients.map(a => ({
          user_id: a.id,
          message: `New incident report from ${user.name}: "${title}"`,
          type: 'incident',
          read: false,
          created_at: new Date().toISOString()
        }));
        await supabase.from('notifications').insert(notifications);

        const emailRecipients = recipients.filter(r => r.email).map(r => r.email).join(',');
        if (emailRecipients) {
          const subject = encodeURIComponent(`New Incident Report: ${title}`);
          const body = encodeURIComponent(`A new incident report was submitted.\n\nReporter: ${user.name} (${user.role})\nTitle: ${title}\nDate: ${incidentDate}\nLocation: ${location || 'N/A'}\n\nDescription:\n${description}`);
          window.open(`mailto:${emailRecipients}?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');
        }
      }

    } catch (err) {
      showToast('Error submitting report: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Report';
    }
  });
}