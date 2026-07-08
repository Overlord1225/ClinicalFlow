# SIPAG

## Student Internship Placement and Assignment Generator

---

# Executive Summary

## The Problem

Clinical rotation programs in nursing, medical, and allied health schools are foundational to a student's practical education — yet they are managed with the same tools as a 1990s office: spreadsheets, group chats, and verbal confirmations. Students miss required clinical cases, schedulers drown in coordination overhead, clinical instructors record attendance by hand, and program directors have zero visibility into who is on track and who is at risk.

The result is delayed graduations, regulatory compliance violations, and student frustration — all caused by a solvable information problem.

## How ClinicalFlow Solves It

ClinicalFlow is a web-based clinical rotation management system purpose-built for nursing and allied health programs. It centralizes every workflow that currently lives in spreadsheets, messenger apps, and paper logbooks into a single, role-aware platform:

- **Students** track their required clinical cases in a personal "Clinical Passport," join available duty slots, and receive real-time schedule notifications.
- **Clinical Instructors (CIs)** oversee Smart Biometric Attendance Verification (GPS + Face Verification with Liveness Detection) to record attendance automatically and mark absences with one tap.
- **Schedulers** build and manage rotation schedules, monitor compliance gaps, and instantly see which students need make-up duties.
- **Administrators** see program-wide analytics, generate reports for accreditation, and manage all users and system settings.

## Why ClinicalFlow Is Better Than Spreadsheets and Manual Tracking

| Dimension                 | Spreadsheets / Manual               | SIPAG                                   |
| ------------------------- | ----------------------------------- | ----------------------------------------------- |
| Case tracking             | Verbal, easy to forget or duplicate | Verified digital log per student                |
| Attendance                | Paper sign-in, post-hoc entry       | GPS + Face Verification → automatic time-in/out |
| Late detection            | Human judgment, inconsistent        | Automatic vs. schedule start time               |
| Schedule changes          | Group chat, often missed            | Real-time in-app notifications                  |
| Compliance visibility     | Weekend spreadsheet audit           | Live dashboard, any time                        |
| Make-up duty tracking     | Manual list                         | Auto-populated from absences                    |
| Communication             | Messenger chaos                     | Centralized announcements + alerts              |
| Graduation risk detection | Too late, usually                   | Early warning via case gap analysis             |

---

# Current Problems

## Problem 1 — Clinical Case Tracking Is Broken

Students in clinical programs must complete a defined set of required cases before they can graduate. These cases vary by program and include procedures and exposures such as:

- Normal Spontaneous Delivery (NSD)
- IV Catheter Insertion
- Medication Administration (oral, IV, IM)
- Vital Signs Monitoring
- Pediatric Patient Exposure
- Neonatal Care
- Surgical Assistance
- Wound Dressing
- Urinary Catheterization
- Blood Extraction / Venipuncture
- Physical Assessment (Adult, Pediatric, OB)

**What currently happens:**

- Students maintain personal logbooks or notebooks, recording cases themselves without real-time verification.
- At end of rotation, CIs sign off on batches of cases they may not fully remember.
- Duplicated cases are common — a student may log "IV Insertion" three times when only one is required.
- Missing cases are discovered at graduation audit, not during rotation — too late to remediate in time.
- Program directors have no aggregated view of case completion rates across the entire cohort.

**Consequences:**

- Students complete rotations without knowing which cases they still lack.
- CIs and schedulers cannot proactively assign students to the right duties.
- Delayed graduation when case deficits are discovered at the last checkpoint.
- Poor program quality data for accreditation bodies.

---

## Problem 2 — Schedulers Have No Real-Time Visibility

Schedulers are responsible for assigning dozens (sometimes hundreds) of students across multiple hospitals, departments, and shift times. Their current workflow:

1. Open a master spreadsheet.
2. Manually scan each student's row to check hours completed, cases done, and schedule history.
3. Build the next rotation period's schedule.
4. Export and distribute it via group chat or email.

**What they cannot easily answer right now:**

- Which students have not yet completed a Pediatric Exposure?
- Who has been absent more than twice this quarter?
- Which students are assigned to Hospital A this week vs. Hospital B?
- Who still needs 20 more duty hours to hit the 500-hour requirement?
- Who is available for a last-minute slot in the Delivery Room?

**Consequences:**

- Scheduling decisions are based on incomplete or stale data.
- Students who need specific exposures are assigned to irrelevant departments.
- Schedulers spend 6–8 hours per week on administrative coordination instead of student support.

---

## Problem 3 — Communication Is Fragmented and Unreliable

Clinical programs involve at least three layers of communication:

- Scheduler → Student (schedule published, schedule changed, duty reminder)
- CI → Student (duty instructions, absence notifications)
- Scheduler → CI (student list changes, policy updates)
- Admin → All (announcements, policy memos)

**Current reality:**

- All of this happens in Facebook Messenger group chats, Viber groups, and phone calls.
- Students miss schedule change announcements because they are buried in unrelated chat messages.
- CIs receive student lists via screenshot — prone to being outdated within hours.
- Announcements are re-posted multiple times because students claim they did not see them.
- There is no audit trail of who was notified of what and when.

**Consequences:**

- Students show up to the wrong hospital or wrong shift.
- No-shows due to missed notifications blamed on the student, not the communication breakdown.
- CI and scheduler time wasted chasing individual students to confirm receipt.

---

## Problem 4 — Attendance Is Entirely Manual

For each duty, a Clinical Instructor currently:

1. Arrives at the clinical site.
2. Calls roll or waits for students to sign a paper logbook.
3. Notes who was late (subjective — "she looked like she arrived at 7:15").
4. Counts duty hours from sign-in to sign-out, manually.
5. Transfers all of this to a spreadsheet at the end of the day or week.

**Problems with this flow:**

- Time-in and time-out entries are reconstructed from memory, not real-time data.
- Lateness is inconsistently defined and applied across CIs.
- Absent students sometimes submit handwritten alibis and escape the record entirely.
- Duty hours are under-counted or over-counted depending on the CI's diligence.
- There is no automated connection between attendance records and make-up duty assignment.

**Consequences:**

- Attendance data is unreliable, making compliance reporting difficult.
- Students dispute absence records with no objective evidence.
- Make-up duties are assigned weeks late because schedulers don't know who was absent until the spreadsheet is updated.

---

# Solution: ClinicalFlow

ClinicalFlow replaces every manual process described above with a unified, role-aware digital platform. Below is a complete feature breakdown.

---

# User Roles and Permissions

## Role 1 — Administrator

The Administrator has full system access and is responsible for overall program management and system configuration.

**Permissions:**

- Create, edit, deactivate, and delete user accounts for all roles
- Manage hospitals and departments in the system
- Define and manage the master Clinical Case Library (what cases are required, minimum counts)
- View program-wide analytics dashboard (all students, all CIs, all hospitals)
- Generate compliance and accreditation reports
- Send system-wide announcements
- Access all logs and audit trails
- Configure system settings (academic year, rotation periods, pass thresholds)
- Override attendance records with justification
- Manage notification templates

**Cannot do:** Manage individual duty schedules (that is the Scheduler's role), verify clinical cases (that is the Scheduler's role).

---

## Role 2 — Scheduler

The Scheduler creates and manages duty schedules and monitors student compliance in real time.

**Permissions:**

- Create, edit, and delete duty schedules for all students
- Create Available Duty Slots (open enrollment shifts)
- Approve or reject student applications for Available Duty Slots
- Search and filter students by hospital, department, completion status, attendance record, duty hours, and required cases
- View which students need specific clinical cases
- View which students need make-up duties (auto-populated from absences)
- Assign make-up duties
- Send schedule change notifications
- Post announcements to students and CIs
- View real-time attendance for active duties
- Review and manually verify or reject student case submissions, one case type at a time, even when a single duty produced multiple different case submissions
- Generate scheduling and compliance reports
- View all student Clinical Passports (read-only)

**Cannot do:** Create or edit user accounts (Admin's role).

---

## Role 3 — Clinical Instructor (CI)

The CI is the frontline supervisor on the clinical site. They validate student performance and record attendance.

**Permissions:**

- Oversee Smart Biometric Attendance Verification (GPS + Face Verification) to record time-in and time-out for their assigned duties, and use Clinical Instructor Attendance Mode for students who cannot complete verification on their own device
- Mark students as Present, Late, or Absent for a given duty
- View the student roster for their assigned duties
- View each student's Clinical Passport (read-only, for their assigned students)
- Receive real-time notifications about their assigned duties and students
- View attendance records for duties they supervised

**Cannot do:** Create or modify schedules, create Available Duty Slots, verify student case submissions (Scheduler's role), access other CIs' students.

---

## Role 4 — Student

The Student is the end user whose clinical progress is the primary data object of the platform.

**Permissions:**

- View their own duty schedule and upcoming rotations
- View their own Clinical Passport (case completion progress)
- Submit completed clinical cases for Scheduler verification
- Complete Smart Biometric Attendance Verification (GPS + Face Verification with Liveness Detection) for Time In and Time Out
- Browse and apply for Available Duty Slots
- Receive notifications (schedule changes, attendance confirmation, verification results)
- View their own attendance records and duty hours
- View announcements

**Cannot do:** Modify their schedule, verify their own cases, view other students' data, cancel a duty once scheduled (must contact Scheduler).

---

# Features

## Feature 1 — Clinical Passport

### Overview

The Clinical Passport is each student's personal, running record of required clinical case completions. It is the equivalent of a verified competency logbook — digital, tamper-evident, and visible to all authorized roles.

### How It Works

#### Case Library (fully customizable by Admin)

The Admin defines and maintains the master list of required clinical cases for the program. This is fully configurable, not hardcoded:

- Admin can add, edit, or remove case types at any time.
- Admin sets the required minimum count per case type (e.g., Oral Medication Administration — required: 1).
- Each case has a name, description, category (OB, Pediatrics, Medical-Surgical, etc.), and a required minimum count.
- Changes to the Case Library apply to the whole program, and existing student passports recalculate automatically against the updated requirements.

Example required cases:

- Normal Spontaneous Delivery — required: 5
- Assisted Delivery — required: 2
- IV Insertion — required: 10
- Medication Administration (Oral) — required: 1
- Medication Administration (IV) — required: 10
- Vital Signs Monitoring — required: 20
- Pediatric Physical Assessment — required: 5
- Neonatal Care — required: 5
- Urinary Catheterization — required: 5
- Blood Extraction — required: 5
- Wound Dressing — required: 8
- Surgical Assistance — required: 3

#### Student Submission Flow

1. After performing a procedure during duty, the student submits a case completion entry.
2. The entry includes: case type, date, hospital, department, brief notes, and optionally a photo (where permitted).
3. A single duty can involve more than one case type (for example, a Delivery Room duty may cover Normal Spontaneous Delivery and IV Insertion at the same time), so the student submits a separate entry per case type.
4. The assigned Scheduler receives a notification that new case submissions are waiting for verification.

#### Scheduler Verification Flow

Being present or marked attended for a case duty does not automatically check off a case. This mirrors the current manual process, where the student's case form is physically handed to the Scheduler and signed by the department head for confirmation — the system keeps this same manual confirmation step, just digitized:

1. Scheduler opens the pending case submissions queue.
2. Scheduler reviews each submission individually, even when several case types were submitted from the same duty.
3. Scheduler either verifies the submission (marks it confirmed) or rejects it with a reason.
4. Only verified cases count toward the student's passport total, and the check only appears in the passport once the Scheduler has verified that specific case entry.

#### Dashboard Display

- Progress ring per category showing % complete.
- Table view: Case Name | Required | Completed | Verified | Remaining | Status.
- Color coding: Green (complete), Yellow (in progress), Red (deficient).
- Exportable as PDF for accreditation submissions.

#### Scheduler/Admin View

- Filter all students by: cases remaining, specific case type, completion percentage.
- Instantly see which students need Delivery Room exposure.
- Use this data to inform scheduling decisions.

---

## Feature 2 — Smart Scheduler

### Overview

A powerful scheduling dashboard giving Schedulers full visibility and control over duty assignments across all hospitals, departments, students, and rotation periods.

### Schedule Creation

- Scheduler selects: date, start time, end time, hospital, department, assigned CI, and the list of students.
- Students and CIs receive immediate notification when a schedule is published.

### Edit and Delete

- Scheduler can edit any future schedule (students, time, hospital, CI).
- On edit, all affected parties receive a change notification.
- Past schedules are locked and cannot be edited (audit trail preserved).
- Deletion sends a cancellation notification.

### Search and Filter

The scheduler dashboard supports advanced filtering:

- **By Hospital** — show only students assigned to Hospital A, Hospital B, etc.
- **By Department** — Delivery Room, Pediatric Ward, ICU, etc.
- **By Completed Cases** — show students who have completed X case
- **By Remaining Cases** — show students who still need Y case (critical for targeted scheduling)
- **By Attendance** — filter by students with absences, by late count, by perfect attendance
- **By Duty Hours** — show students below X hours, above Y hours
- **By Make-Up Duty Need** — show all students flagged for make-up
- **By Student Name / Student ID**

### Student Compliance View

- Each student card shows: hours completed, cases completed %, attendance rate, upcoming duties.
- Red badge on students who are at risk (low hours + high absences + case deficits).

---

## Feature 3 — Available Duty Slots

### Overview

Schedulers can open specific duty shifts to student enrollment on a first-come, first-served basis. This handles: last-minute slot fill, make-up duty opportunities, and voluntary additional exposure.

### Scheduler Flow

1. Scheduler creates an Available Duty Slot with: hospital, department, date, time, CI assigned, maximum students, and case types likely to be available.
2. The slot is published and students receive a notification.

### Student Flow

1. Student sees the Available Duty Slot in their dashboard.
2. Student taps "Apply."
3. Application is queued in order of submission time.

### Approval Flow

1. Scheduler reviews applications.
2. Scheduler approves students up to the slot maximum.
3. Approved students receive a schedule confirmation notification.
4. Rejected students (queue overflow) receive a notification that the slot is full.

### Make-Up Duty Integration

- Absent students are automatically flagged.
- Scheduler can create Available Duty Slots specifically tagged as "Make-Up Duty."
- System prioritizes make-up flagged students when Scheduler reviews applications.

---

## Feature 4 — Smart Biometric Attendance Verification

### Overview

ClinicalFlow no longer relies on QR Codes for attendance. Instead, attendance uses Multi-Factor Verification combining live GPS location checking with Face Verification and Liveness Detection. Attendance is only considered valid when all verification methods pass successfully.

Attendance does **not** require the student to register a home address. The system only requests the student's live GPS location during Time In and Time Out, and that location is used solely to confirm the student is physically at the assigned hospital — it is not used to track students outside their scheduled duties.

### Attendance Workflow

The student arrives at the assigned hospital, opens ClinicalFlow, and taps **Time In**. The system then performs the following verification process:

**Step 1 — GPS Verification**

1. The browser requests location permission.
2. The application retrieves the student's current GPS coordinates.
3. The system compares the student's current location against the assigned hospital's stored coordinates.
4. Each hospital has a configurable attendance radius (default: 100 meters).
5. If the student is outside the configured radius, attendance is rejected at this step.

**Step 2 — Face Verification with Liveness Detection**

1. The application opens the device camera.
2. The student performs a live face verification (e.g., blink, turn head left, turn head right, smile) so the system can confirm the student is physically present and not using a printed photo or screenshot.
3. After liveness verification passes, the captured face is compared against the student's registered facial profile created during account registration.
4. If the face matches, identity verification succeeds.

**Step 3 — Attendance Recording**

- Once GPS Verification and Face Verification both pass, the system records: Time In, date, GPS coordinates, attendance status, device information, and verification status.
- The same three-step process repeats during Time Out.
- The system automatically calculates duty hours, late minutes, overtime, and the attendance summary.

**Attendance Status Display:**

| Check             | Status                   |
| ----------------- | ------------------------ |
| GPS               | Verified                 |
| Face Verification | Verified                 |
| Liveness          | Passed                   |
| Attendance        | Confirmed                |
| Duty Hours        | Automatically Calculated |

**Late Logic:**

- Each schedule has a defined "grace period" (default: 15 minutes, configurable per schedule).
- If Time-In verification completes more than the grace period after duty start → automatically tagged LATE.
- Late count is tracked on the student record and visible to Scheduler.

### Alternative Attendance Mode (Clinical Instructor Attendance Mode)

Some students may experience low battery, a broken camera, no mobile device, or internet problems. Rather than allowing classmates to record attendance on their behalf, ClinicalFlow provides **Clinical Instructor Attendance Mode**:

1. The Clinical Instructor opens the assigned duty and selects the student.
2. The student performs Face Verification using the CI's registered device.
3. GPS is verified using the CI's device, since the CI is physically present at the assigned hospital.
4. Attendance is then recorded normally.

This preserves security while still allowing attendance to be recorded when a student cannot use their own device.

### Security

Attendance cannot be completed unless GPS Verification, Face Verification, and Liveness Detection all pass. This prevents attendance spoofing, fake-GPS attendance, printed-photo attacks, screenshot attacks, and proxy attendance.

### Registration Requirement

During account registration, every student completes Face Registration, capturing multiple facial angles so the system can generate a facial profile for future attendance verification. This facial profile is linked only to the student's own account.

---

## Feature 5 — Attendance Management

### CI Dashboard — Attendance Panel

For each active duty, the CI sees a student roster with status buttons:

| Student Name | Verification          | Status  | Action                    |
| ------------ | --------------------- | ------- | ------------------------- |
| Maria Santos | ✓ GPS + Face 06:05 AM | ON TIME | —                         |
| Juan Cruz    | ✓ GPS + Face 06:22 AM | LATE    | —                         |
| Ana Reyes    | ✗                     | —       | [Present] [Late] [Absent] |

**Manual override buttons** (for cases where biometric verification could not be completed, e.g., handled via Clinical Instructor Attendance Mode):

- **Present** — CI manually marks student present with current timestamp.
- **Late** — CI marks student as late with a note.
- **Absent** — CI marks student absent.

**Absent Flow:**

- When CI marks a student Absent:
  1. Student record is flagged "ABSENT" for that duty.
  2. Scheduler receives an immediate notification: "Ana Reyes marked ABSENT — ICU Ward, July 12."
  3. Student is automatically added to the "Needs Make-Up Duty" queue.
  4. Student receives a notification: "You have been marked Absent for your July 12 duty. Contact your Scheduler."
- **There is no cancel button for students.** Once marked absent by a CI, only a Scheduler or Admin can reverse it with an audit note.

**Duty Hours Computation:**

- Automatic: Time-Out − Time-In = duty hours for that session.
- Cumulative hours tracked per student.
- Progress bar in student dashboard: "487 / 500 hours completed."

---

## Feature 6 — Notifications System

### Overview

Real-time, in-app notification center for all users, with role-specific routing.

### Notification Types

| Event                           | Recipients                 | Priority |
| ------------------------------- | -------------------------- | -------- |
| New schedule published          | Affected students + CI     | High     |
| Schedule changed                | Affected students + CI     | High     |
| Schedule cancelled              | Affected students + CI     | High     |
| Duty starting in 1 hour         | Assigned students          | Medium   |
| Time-In recorded                | Student                    | Low      |
| Time-Out recorded               | Student                    | Low      |
| Marked Absent                   | Student + Scheduler        | High     |
| New Available Duty Slot         | All students (or filtered) | Medium   |
| Slot application approved       | Student                    | High     |
| Slot application rejected       | Student                    | Medium   |
| Case submitted for verification | Assigned Scheduler         | Medium   |
| Case verified                   | Student                    | Medium   |
| Case rejected                   | Student                    | Medium   |
| New announcement                | All (or targeted by role)  | Medium   |
| Student needs make-up duty      | Scheduler                  | High     |

### Delivery Mechanism

- **In-app bell icon** with unread count badge.
- **Notification center page** with read/unread status and timestamp.
- **Real-time** via WebSockets (Server-Sent Events as fallback).
- Future: Email digest (daily summary for users who prefer it).

### Announcements (Separate from Notifications)

- Admins and Schedulers can post rich-text announcements.
- Announcements appear on the dashboard home for all targeted roles.
- Read confirmation tracking ("3 of 12 students have read this").

---

## Feature 7 — Dashboard Analytics

### Administrator Dashboard

- **Program Overview Card:** Total students, active rotations, completion rate, attendance rate.
- **Case Completion Heatmap:** Which cases have the lowest completion rates across all students.
- **At-Risk Students List:** Students with multiple absences + low case completion.
- **Hospital Utilization:** How many students are placed at each hospital.
- **Hours Distribution:** Bar chart of student duty hours progress.
- **Monthly Attendance Trend:** Line chart of on-time vs. late vs. absent per month.
- **Upcoming Duties:** Timeline of all scheduled duties next 7 days.

### Scheduler Dashboard

- **Today's Active Duties:** Cards showing hospital, dept, CI, student count, status.
- **Students Needing Make-Up:** Priority queue with days since absence.
- **Pending Case Verifications:** Student case submissions waiting for Scheduler sign-off, shown per case type even when several came from the same duty.
- **Case Gap Analysis:** Table of students × missing cases, sortable.
- **Available Slot Applications:** Pending approval queue.
- **Recent Absences:** Last 7 days absence log.

### CI Dashboard

- **Today's Duty:** Active duty card with attendance verification status.
- **My Students:** Roster for current duty with attendance status.
- **Recent Attendance History:** Last 10 duties supervised.

### Student Dashboard

- **My Clinical Passport:** Progress ring (% complete) + key missing cases.
- **Next Duty:** Date, time, hospital, department, CI name, Time In / Time Out button.
- **Duty Hours:** Progress bar (X / 500 hours).
- **Attendance Summary:** Present / Late / Absent count.
- **Recent Notifications:** Last 5 alerts.
- **Available Duty Slots:** Open slots the student can apply to.

---

## Feature 8 — Intelligent Recommendation Engine

### Overview

ClinicalFlow uses a **Rule-Based Recommendation Engine with Weighted Scoring** to help Schedulers decide which students to assign to a new duty or Available Duty Slot. This is deterministic, explainable, and optimized for real-time scheduling — it is not a black-box AI decision, so Schedulers can always see and trust why a student was recommended.

### How It Works

The recommendation engine evaluates every eligible student whenever the Scheduler creates a new duty or Available Duty Slot. Each student receives a recommendation score calculated from configurable weights.

**Example Criteria (Positive):**

| Criterion                    | Weight |
| ---------------------------- | ------ |
| Needs Required Clinical Case | +40    |
| No Academic Class Conflict   | +30    |
| No Existing Duty Conflict    | +25    |
| Attendance Rate Above 95%    | +20    |
| Lower Completed Duty Hours   | +15    |
| High Priority Make-up Duty   | +10    |

**Example Criteria (Negative):**

| Criterion                       | Weight |
| ------------------------------- | ------ |
| More than 5 Late Records        | −20    |
| More than 3 Absences            | −30    |
| Already Completed Required Case | −40    |
| Weekly Duty Hour Limit Reached  | −50    |

After calculating scores for all eligible students, the system sorts them from highest to lowest and recommends the top candidates to the Scheduler. The Scheduler can still manually override any recommendation at any time.

The scoring weights are configurable so Administrators can adjust them in future versions without changing source code.

### Optional AI-Generated Explanations

The recommendation itself always comes from the Rule-Based Recommendation Engine — the AI does not decide which students are assigned. Optionally, the Google Gemini API can be used to turn a student's score breakdown into a human-readable explanation for the Scheduler, for example:

> "Maria Santos is recommended because she still requires a Normal Delivery case, has no academic or duty conflicts, maintains a 98% attendance rate, and has completed fewer clinical hours than most eligible students."

---

## Biometric Attendance Security

- Attendance cannot be completed unless GPS Verification, Face Verification, and Liveness Detection all pass.
- GPS verification uses the Browser Geolocation API and compares the student's live coordinates against the assigned hospital's stored coordinates and configurable attendance radius.
- Face Verification with Liveness Detection is performed on-device using Google MediaPipe Tasks Vision (face detection, face landmark detection, blink detection, head rotation detection) before comparing against the student's registered facial profile.
- This combination prevents attendance spoofing, fake-GPS attendance, printed-photo attacks, screenshot attacks, and proxy attendance.
- Face images are not permanently stored after verification whenever possible; only encrypted facial templates or securely managed verification data are retained, in line with privacy best practices.

## Data Integrity

- All attendance overrides and case verification changes logged to audit_logs.
- Students cannot modify their own case completion records (submit only, Scheduler verifies).
- Schedule past dates are locked against modification.

## Input Validation

- All API inputs validated with Zod schemas server-side.
- Parameterized SQL queries via Drizzle ORM (no raw string interpolation).
- File uploads (case photos) restricted by MIME type, size, and scanned for basic integrity.

---

# Pages

## Public Pages

1. **Landing Page** (`/`) — Product hero, features overview, call to action
2. **Login** (`/login`) — Email + password, role auto-detected
3. **Forgot Password** (`/forgot-password`) — Email input for reset
4. **Reset Password** (`/reset-password/:token`) — New password entry

## Shared Authenticated Pages

5. **Dashboard** (`/dashboard`) — Role-specific home dashboard
6. **Notifications** (`/notifications`) — Full notification center with read/unread
7. **Announcements** (`/announcements`) — Program announcements list
8. **Profile Settings** (`/settings/profile`) — Update personal info, avatar, password

## Student Pages

9. **Student Dashboard** (`/dashboard`) — Passport ring, next duty, hours bar, recent alerts
10. **My Schedule** (`/schedule`) — Calendar + list view of upcoming duties
11. **Duty Detail** (`/schedule/:id`) — Full duty info + Time In / Time Out biometric verification
12. **Clinical Passport** (`/passport`) — Case completion table with progress, filter by category
13. **Submit Case** (`/passport/submit`) — Form to submit a new case completion
14. **My Attendance** (`/attendance`) — History table with hours, status, per duty
15. **Available Slots** (`/slots`) — Browse open duty slots, apply button
16. **My Applications** (`/slots/my-applications`) — Track application status

## Clinical Instructor Pages

17. **CI Dashboard** (`/dashboard`) — Today's duty, recent history
18. **My Duties** (`/duties`) — List of all assigned duties
19. **Active Duty** (`/duties/:id/attendance`) — Live roster with verification status + manual status buttons
20. **CI-Assisted Verification** (`/duties/:id/verify`) — Clinical Instructor Attendance Mode: face verification via CI's device, GPS verified via CI's location

## Scheduler Pages

21. **Scheduler Dashboard** (`/dashboard`) — Today's duties, at-risk students, pending case verifications
22. **Schedule Management** (`/schedules`) — Full schedule list with filters
23. **Create Schedule** (`/schedules/create`) — Form: date, time, hospital, dept, CI, students
24. **Edit Schedule** (`/schedules/:id/edit`) — Same form pre-filled
25. **Student Roster** (`/students`) — All students with search, filter, compliance badges
26. **Student Profile** (`/students/:id`) — Full profile: passport, attendance, schedule history
27. **Available Slots** (`/slots`) — Manage open slots
28. **Create Slot** (`/slots/create`) — Form to create an available duty slot
29. **Slot Applications** (`/slots/:id/applications`) — Review and approve/reject applicants
30. **Make-Up Queue** (`/makeup-duties`) — List of students needing make-up + assignment
31. **Case Gap Analysis** (`/case-gaps`) — Matrix view: students × missing cases
32. **Case Verifications** (`/verifications`) — Queue of pending student case submissions, shown per case type even when several came from the same duty
33. **Verification Detail** (`/verifications/:id`) — Review and manually verify or reject a case
34. **Recommended Students** (`/schedules/:id/recommendations` or `/slots/:id/recommendations`) — Ranked, weighted-score list of eligible students for a duty or slot, with optional AI-generated explanation
35. **Announcements** (`/announcements/manage`) — Create and manage announcements

## Administrator Pages

36. **Admin Dashboard** (`/dashboard`) — Program KPIs, at-risk students, case heatmap
37. **User Management** (`/admin/users`) — CRUD for all users
38. **Create User** (`/admin/users/create`) — Role-specific user creation form
39. **Hospital Management** (`/admin/hospitals`) — CRUD for hospitals, including GPS coordinates and attendance radius
40. **Department Management** (`/admin/hospitals/:id/departments`) — Manage departments
41. **Clinical Case Library** (`/admin/cases`) — Manage required case types
42. **Recommendation Engine Settings** (`/admin/recommendation-weights`) — Configure scoring weights for the Rule-Based Recommendation Engine
43. **Analytics** (`/admin/analytics`) — Full program analytics with charts
44. **Reports** (`/admin/reports`) — Generate and export compliance reports
45. **Audit Log** (`/admin/audit`) — System audit trail
46. **System Settings** (`/admin/settings`) — Academic year, rotation periods, thresholds

# User Flow Diagrams

## Student Flow

```
Register/Login
     ↓
Student Dashboard
 ├── View next duty → Duty Detail → Time In (GPS + Face Verification)
 ├── Clinical Passport → Submit Case → Await Scheduler Verification
 ├── Browse Available Slots → Apply → Await Scheduler Approval
 ├── View Attendance → See hours, statuses
 └── View Notifications → Read alerts
```

## CI Flow

```
Login
  ↓
CI Dashboard
 ├── View Today's Duty → Active Duty Screen
 │    ├── Student completes GPS + Face Verification → Time-In Recorded
 │    ├── Manual Status Buttons (Present/Late/Absent)
 │    ├── Clinical Instructor Attendance Mode (student's device unavailable) → CI-assisted verification
 │    └── End of Duty → GPS + Face Verification Out → Hours Computed
 └── View Assigned Duties → My Duties List
```

## Scheduler Flow

```
Login
  ↓
Scheduler Dashboard
 ├── Create Schedule → View Recommended Students (Weighted Scoring) → Assign Students → Publish → Notify
 ├── View Case Gaps → Identify Students → Assign to Right Dept
 ├── View Make-Up Queue → Create Slot → View Recommended Students → Review Applications → Approve
 ├── Pending Case Verifications → Review Each Case Submission → Verify or Reject
 └── Monitor Today's Duties → View Live Attendance
```

## Admin Flow

```
Login
  ↓
Admin Dashboard
 ├── Manage Users → Create CI / Scheduler / Student accounts
 ├── Configure Case Library → Add/Edit required cases
 ├── View Analytics → Monitor program health
 ├── Generate Reports → Export for accreditation
 └── System Settings → Configure academic year, thresholds
```

---

# Edge Cases

| Scenario                                                        | Handling                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Student is outside the hospital's attendance radius             | Error: "You are outside the attendance radius for this hospital"; attendance rejected                  |
| Face verification fails to match registered profile             | Error: "Face verification failed"; student can retry or CI can use Clinical Instructor Attendance Mode |
| Student denies camera or location permission                    | Attendance blocked until permission granted, or CI-assisted verification is used                       |
| CI marks student absent after manual Present                    | Audit log records override; Scheduler notified                                                         |
| Student submits same case type twice                            | Allowed (e.g. IV Insertion count = 3 of 10); each submission reviewed separately                       |
| Network loss during GPS/Face Verification                       | Offline-resilient: client queues verification attempt, retries on reconnect                            |
| Two students apply for 1 remaining slot simultaneously          | Database-level row lock; first commit wins; second gets "slot full"                                    |
| Student's device has low battery, broken camera, or no internet | Clinical Instructor Attendance Mode: CI records attendance using their own registered device           |
| CI absent on duty day                                           | Scheduler reassigns or cancels; students notified                                                      |
| Student exceeds required case count                             | Over-completions stored but do not block; passport shows "Complete"                                    |
| Student disputes absence mark                                   | No self-cancel; must contact Scheduler; Scheduler overrides with audit note                            |
| Admin deactivates user with active schedules                    | Future schedules flagged; CI replacement required before activation                                    |

---

# Development Roadmap

## Milestone 1 — Authentication & User Management

- Database schema for users, student_profiles, ci_profiles
- Login / logout with session cookies
- Role-based route guards (frontend + backend)
- Admin user creation flow
- Profile settings page

**Deliverable:** Any of the 4 roles can log in and see a role-appropriate dashboard shell.

---

## Milestone 2 — Core Dashboard & Navigation

- AppLayout component (sidebar + header)
- Role-specific sidebar navigation
- Dashboard home page per role (skeleton with placeholders)
- Notification bell with unread count
- Announcements display

**Deliverable:** Full navigation shell visible and functional per role.

---

## Milestone 3 — Scheduling System

- Hospital + Department CRUD (Admin)
- Schedule creation form (Scheduler)
- Schedule list with filters
- Schedule student assignment
- Hospital GPS coordinates + attendance radius configuration
- Student: view own schedule + duty detail page
- CI: view assigned duties list

**Deliverable:** Schedulers can create duties; students and CIs can view their schedules.

---

## Milestone 4 — Smart Biometric Attendance Verification

- Student Face Registration flow during onboarding (multiple facial angles)
- Browser Geolocation API integration for GPS Verification
- Face Verification with Liveness Detection using Google MediaPipe Tasks Vision (blink, head rotation)
- Time-In verification (GPS + Face) → attendance record created
- Late detection logic (vs. schedule start time + grace period)
- Time-Out verification (GPS + Face) → duty hours computed
- Manual attendance buttons (Present / Late / Absent)
- Clinical Instructor Attendance Mode (CI-assisted verification)
- Absent → Scheduler notification + make-up queue flagging
- Attendance history page (student view)
- Active duty roster page (CI view)

**Deliverable:** End-to-end Smart Biometric Attendance Verification flow operational.

---

## Milestone 5 — Clinical Passport

- Clinical Case Library management (Admin), fully customizable case types and required counts
- Student case submission form, supporting multiple case types per duty
- Scheduler case verification queue (manual, per case type)
- Scheduler verify / reject flow
- Student passport display (progress rings, table, category filter)
- Scheduler case gap analysis view

**Deliverable:** Students can build and track their clinical passport; Schedulers manually verify each case submission.

---

## Milestone 6 — Available Duty Slots, Make-Up System & Recommendation Engine

- Scheduler creates Available Duty Slot
- Student slot browsing + application
- First-come queue with timestamp ordering
- Scheduler approval / rejection
- Make-up duty flagging from absences
- Make-up duty queue (Scheduler dashboard)
- Rule-Based Recommendation Engine with configurable weighted scoring
- Recommended Students view (ranked list) for new duties and slots
- Optional Google Gemini API integration for human-readable recommendation explanations

**Deliverable:** Open enrollment, make-up duty management, and student recommendations fully operational.

---

## Milestone 7 — Notifications & Announcements

- Real-time notification delivery (WebSockets)
- Notification center page (read/unread)
- Per-event notification triggers (schedule changes, absences, verifications, etc.)
- Announcement creation + management (Scheduler/Admin)
- Announcement read tracking

**Deliverable:** All real-time alerts operational across all roles.

---

## Milestone 8 — Analytics, Reports & Polish

- Admin analytics dashboard (program KPIs, charts, at-risk list)
- Scheduler dashboard enhancements (case gap matrix, compliance stats)
- Student report PDF generation
- Program accreditation report export
- Audit log viewer (Admin)
- UI polish pass: animations, empty states, loading skeletons, mobile responsiveness
- GPS radius tuning and biometric verification edge case hardening
- Rate limiting and security review

**Deliverable:** Production-quality, fully featured platform ready for Hackathon presentation.
