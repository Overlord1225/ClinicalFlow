import { getCurrentUser, requireAuth } from '../auth.js';
import {
  getUpcomingSchedule,
  getAttendanceForSchedule,
  verifyGPS,
  recordAttendance,
  updateAttendance
} from '../data.js';
import { showToast, showLoading, hideLoading } from '../utils.js';

let faceMesh = null;
let camera = null;
let videoElement = null;
let blinkDetected = false;
let attendanceState = { timeIn: null, timeOut: null, schedule: null, attendanceId: null };

export async function initAttendance() {
  const user = requireAuth();
  if (!user) return;

  const container = document.getElementById('attendanceContainer');
  if (!container) return;

  try {
    showLoading('attendanceContainer', 'Loading your duty...');

    const schedule = await getUpcomingSchedule(user.id);
    if (!schedule) {
      container.innerHTML = '<p>No upcoming duty. Please check your schedule.</p>';
      return;
    }

    attendanceState.schedule = schedule;

    document.getElementById('dutyTitle').textContent = `${schedule.case_type || 'Duty'} – ${schedule.hospital?.name || 'N/A'}`;
    document.getElementById('dutyDetails').innerHTML = `
      <strong>Date:</strong> ${schedule.date} &nbsp;|&nbsp; 
      <strong>Time:</strong> ${schedule.start_time} – ${schedule.end_time} &nbsp;|&nbsp; 
      <strong>CI:</strong> ${schedule.ciName}
    `;

    const existing = await getAttendanceForSchedule(schedule.id, user.id);
    if (existing) {
      attendanceState.attendanceId = existing.id;
      if (existing.time_in) {
        attendanceState.timeIn = existing.time_in;
        document.getElementById('timeInBtn').disabled = true;
        document.getElementById('timeOutBtn').disabled = false;
        document.getElementById('gpsStatus').classList.add('verified');
        document.getElementById('gpsText').textContent = '✔ Verified (Time In)';
        document.getElementById('faceStatus').classList.add('verified');
        document.getElementById('faceText').textContent = '✔ Verified (Time In)';
        const timeInDate = new Date(existing.time_in);
        document.getElementById('timerDisplay').textContent = timeInDate.toLocaleTimeString();
        if (existing.time_out) {
          attendanceState.timeOut = existing.time_out;
          document.getElementById('timeOutBtn').disabled = true;
          document.getElementById('timerDisplay').textContent = 
            `${new Date(existing.time_in).toLocaleTimeString()} → ${new Date(existing.time_out).toLocaleTimeString()}`;
        }
      }
    }

    await setupCamera();

    hideLoading('attendanceContainer');
    showToast('Ready for biometric verification', 'success', 2000);

  } catch (err) {
    console.error('Attendance init error:', err);
    hideLoading('attendanceContainer');
    container.innerHTML = `<p>Error loading duty: ${err.message}</p>`;
  }
}

async function setupCamera() {
  videoElement = document.getElementById('video');
  if (!videoElement) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    videoElement.srcObject = stream;
    await videoElement.play();

    // MediaPipe Face Mesh
    faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    faceMesh.onResults(onFaceResults);

    const cameraUtils = new Camera(videoElement, {
      onFrame: async () => {
        await faceMesh.send({ image: videoElement });
      },
      width: 640,
      height: 480
    });
    await cameraUtils.start();

    document.getElementById('cameraOverlay').style.display = 'none';
  } catch (err) {
    console.error('Camera error:', err);
    showToast('Could not access camera: ' + err.message, 'error');
  }
}

let eyeOpen = true;
let blinkCount = 0;
let lastBlinkTime = 0;

function onFaceResults(results) {
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    document.getElementById('faceText').textContent = 'No face detected';
    document.getElementById('faceStatus').className = 'face-status failed';
    return;
  }

  const landmarks = results.multiFaceLandmarks[0];
  const leftEye = [33, 133, 160, 159, 158, 144];
  const rightEye = [362, 263, 387, 386, 385, 380];
  const earLeft = getEAR(landmarks, leftEye);
  const earRight = getEAR(landmarks, rightEye);
  const ear = (earLeft + earRight) / 2;

  const threshold = 0.2;
  const currentTime = Date.now();

  if (ear < threshold && eyeOpen) {
    eyeOpen = false;
  } else if (ear >= threshold && !eyeOpen) {
    eyeOpen = true;
    if (currentTime - lastBlinkTime > 300) {
      blinkCount++;
      lastBlinkTime = currentTime;
      document.getElementById('faceText').textContent = `Blink detected (${blinkCount})`;
      if (blinkCount >= 1) {
        blinkDetected = true;
        document.getElementById('faceStatus').className = 'face-status verified';
        document.getElementById('faceText').textContent = '✔ Liveness passed';
        showToast('Liveness verified!', 'success', 2000);
      }
    }
  }
}

function getEAR(landmarks, indices) {
  const p1 = landmarks[indices[0]];
  const p2 = landmarks[indices[1]];
  const p3 = landmarks[indices[2]];
  const p4 = landmarks[indices[3]];
  const p5 = landmarks[indices[4]];
  const p6 = landmarks[indices[5]];
  const dist1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const dist2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  const dist3 = Math.hypot(p1.x - p4.x, p1.y - p4.y);
  return (dist1 + dist2) / (2 * dist3);
}

export async function performTimeIn() {
  const user = getCurrentUser();
  if (!user) return;
  const schedule = attendanceState.schedule;
  if (!schedule) { showToast('No duty loaded', 'error'); return; }

  const btn = document.getElementById('timeInBtn');
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    document.getElementById('gpsText').textContent = 'Checking location...';
    const gpsResult = await verifyGPS(user.id, schedule.id);
    if (!gpsResult.within) {
      showToast(`You are ${Math.round(gpsResult.distance)}m away. Must be within ${gpsResult.radius}m.`, 'error');
      btn.disabled = false;
      btn.textContent = 'Time In';
      return;
    }
    document.getElementById('gpsStatus').className = 'gps-status verified';
    document.getElementById('gpsText').textContent = `✔ Verified (${Math.round(gpsResult.distance)}m within ${gpsResult.radius}m)`;

    document.getElementById('faceText').textContent = 'Looking for face & blink...';
    let attempts = 0;
    while (!blinkDetected && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }
    if (!blinkDetected) {
      showToast('No blink detected. Please blink to verify liveness.', 'error');
      btn.disabled = false;
      btn.textContent = 'Time In';
      return;
    }

    const now = new Date().toISOString();
    const scheduleStart = new Date(`${schedule.date}T${schedule.start_time}`).getTime();
    const nowTime = new Date(now).getTime();
    const status = (nowTime - scheduleStart) <= 15 * 60 * 1000 ? 'on_time' : 'late';

    await recordAttendance(
      schedule.id,
      user.id,
      now,
      null,
      { in: { lat: gpsResult.position.lat, lng: gpsResult.position.lng, accuracy: gpsResult.position.accuracy } },
      true,
      true,
      'biometric',
      status
    );

    attendanceState.timeIn = now;
    document.getElementById('timeInBtn').disabled = true;
    document.getElementById('timeOutBtn').disabled = false;
    document.getElementById('timerDisplay').textContent = new Date(now).toLocaleTimeString();

    showToast(`Time In recorded (${status})`, 'success', 3000);
  } catch (err) {
    console.error('Time In error:', err);
    showToast('Time In failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Time In';
  }
}

export async function performTimeOut() {
  const user = getCurrentUser();
  if (!user) return;
  const schedule = attendanceState.schedule;
  if (!schedule) { showToast('No duty loaded', 'error'); return; }

  const btn = document.getElementById('timeOutBtn');
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    document.getElementById('gpsText').textContent = 'Checking location for Time Out...';
    const gpsResult = await verifyGPS(user.id, schedule.id);
    if (!gpsResult.within) {
      showToast(`You are ${Math.round(gpsResult.distance)}m away. Must be within ${gpsResult.radius}m.`, 'error');
      btn.disabled = false;
      btn.textContent = 'Time Out';
      return;
    }
    document.getElementById('gpsStatus').className = 'gps-status verified';
    document.getElementById('gpsText').textContent = `✔ Verified (${Math.round(gpsResult.distance)}m within ${gpsResult.radius}m)`;

    blinkDetected = false;
    blinkCount = 0;
    document.getElementById('faceText').textContent = 'Look at camera and blink...';
    let attempts = 0;
    while (!blinkDetected && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }
    if (!blinkDetected) {
      showToast('No blink detected. Please blink to verify liveness.', 'error');
      btn.disabled = false;
      btn.textContent = 'Time Out';
      return;
    }

    const now = new Date().toISOString();
    await updateAttendance(schedule.id, user.id, {
      time_out: now,
      gps_out: { lat: gpsResult.position.lat, lng: gpsResult.position.lng, accuracy: gpsResult.position.accuracy }
    });

    attendanceState.timeOut = now;
    document.getElementById('timeOutBtn').disabled = true;
    document.getElementById('timerDisplay').textContent = 
      `${new Date(attendanceState.timeIn).toLocaleTimeString()} → ${new Date(now).toLocaleTimeString()}`;

    showToast('Time Out recorded. Duty complete!', 'success', 3000);
  } catch (err) {
    console.error('Time Out error:', err);
    showToast('Time Out failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Time Out';
  }
}

// Attach event listeners after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const timeInBtn = document.getElementById('timeInBtn');
  if (timeInBtn) timeInBtn.addEventListener('click', performTimeIn);

  const timeOutBtn = document.getElementById('timeOutBtn');
  if (timeOutBtn) timeOutBtn.addEventListener('click', performTimeOut);

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    window.location.reload();
  });
});

// Expose for global access (if needed by inline onclick, etc.)
window.performTimeIn = performTimeIn;
window.performTimeOut = performTimeOut;