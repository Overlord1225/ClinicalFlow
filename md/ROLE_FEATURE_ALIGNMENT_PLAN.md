# Role Feature Alignment Plan

## Goal
Ensure every user-facing button, page, and function in ClinicalFlow matches the intended role and that each feature is available only to the correct user role.

## Target Role Matrix

### Student
- View attendance records
- View duty schedule
- Track verified clinical cases
- View assigned hospital/location
- Submit incident report form

### Scheduler
- Match students to hospital duties
- View students per section
- Monitor students with verified cases
- Receive incident report notifications via email

### Clinical Instructor (CI)
- View assigned students
- View assigned hospital/location
- Submit incident report form
- Check and verify attendance

---

## Current Audit Scope
Review and align the following areas:
- Navigation and sidebar access in [js/modules/sidebar.js](js/modules/sidebar.js)
- Role-based page routing in [js/main.js](js/main.js)
- Student features in [js/modules/student.js](js/modules/student.js)
- Scheduler features in [js/modules/scheduler.js](js/modules/scheduler.js)
- CI features in [js/modules/ci.js](js/modules/ci.js)
- Incident reporting in [js/modules/incident.js](js/modules/incident.js)
- Data and role checks in [js/auth.js](js/auth.js) and [js/data.js](js/data.js)

---

## Implementation Plan

### Phase 1 — Feature Inventory
1. List every visible button, link, and action per role.
2. Match each UI element to one feature from the role matrix.
3. Identify any missing, duplicate, or misclassified features.

### Phase 2 — Role-Based Access Control
1. Confirm sidebar items only appear for the logged-in role.
2. Confirm pages are blocked for unauthorized roles.
3. Confirm role checks happen on both page load and action execution.
4. Ensure the current user is always used as the permission gate (features must equal user).

### Phase 3 — Feature Completion by Role

#### Student
- Verify attendance history is visible on the student dashboard or attendance view.
- Verify duty schedule is visible and populated from the student’s assigned records.
- Verify clinical case progress is displayed and reflects verified submissions.
- Verify assigned hospital/location appears in the student view.
- Verify the incident report form is available and submits data for the logged-in student.

#### Scheduler
- Confirm the AI Matchmaker flow assigns students to duty slots.
- Confirm students can be filtered and viewed by section.
- Confirm verified case monitoring is visible in the scheduler dashboard or verification workflow.
- Add or confirm incident report notifications are sent via email to schedulers/admins.

#### CI
- Confirm assigned students are visible on the CI dashboard.
- Confirm assigned hospital/location is visible.
- Confirm the incident report form is available for CI users.
- Confirm attendance can be checked and marked as Present, Late, or Absent.

### Phase 4 — Missing Functionality Fixes
1. Add email notification support for incident reports and related alerts.
2. Ensure scheduler and CI views use the current user’s assigned data, not generic data.
3. Remove any buttons or links that appear for the wrong role.
4. Replace placeholder or generic actions with real role-specific workflows.

### Phase 5 — QA and Validation
1. Log in as each role and verify only intended features are visible.
2. Click every visible button and confirm it performs the correct action.
3. Confirm unauthorized users cannot access restricted pages or actions.
4. Confirm each feature is tied to the logged-in user’s data.

---

## Acceptance Criteria
- Student sees only student features.
- Scheduler sees only scheduler features.
- CI sees only CI features.
- Every listed feature is reachable through the correct UI path.
- No role is shown buttons or actions that do not belong to them.
- Incident reports trigger notification delivery for the right role.

---

## Suggested Priority Order
1. Fix role-gated navigation and page access.
2. Confirm student feature completeness.
3. Confirm CI attendance and assignment views.
4. Add scheduler email notifications.
5. Perform end-to-end role-based QA.
