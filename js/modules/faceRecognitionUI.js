import { getCurrentUser, requireAuth } from '../auth.js';
import {
  initFaceApi,
  registerFace,
  recognizeFace,
  detectAllFaces,
  hasRegisteredFace,
  startWebcam,
  stopWebcam,
  drawFaceBox,
  clearCanvas,
  deleteRegisteredFace
} from '../faceRecognition.js';
import { showToast } from '../utils.js';

let faceScanningInterval = null;
let isScanningMultiple = false;

export async function initFaceScanner() {
  const user = requireAuth();
  if (!user) return;
  const role = user.role;
  const container = document.getElementById('faceScannerContainer');
  const modeBadge = document.getElementById('modeBadge');
  if (modeBadge) {
    modeBadge.textContent = role === 'ci' ? 'CI Mode' : 'Student Mode';
  }

  const initialized = await initFaceApi();
  if (!initialized) {
    container.innerHTML = '<div class="status-message error">Failed to load face recognition models. Please refresh the page.</div>';
    return;
  }

  if (role === 'student') {
    await initStudentFaceMode(user, container);
  }
}

export async function initFaceAttendance() {
  await initFaceScanner();
}

async function initStudentFaceMode(user, container) {
  const hasFace = hasRegisteredFace(user.id);
  
  let html = `
    <h3><i class="fas fa-camera"></i> Face Registration & Verification</h3>
    <p>Register your face for attendance tracking</p>
    
    <div class="video-wrapper">
      <video id="faceVideo" autoplay muted playsinline></video>
      <canvas id="faceCanvas"></canvas>
    </div>

    <div id="faceStatus" class="status-message info">
      ${hasFace ? '✓ Face registered. Click "Verify Me" to test.' : 'Click "Register Face" to capture your face.'}
    </div>

    <div class="face-actions">
      ${!hasFace ? '<button id="registerFaceBtn" class="face-btn"><i class="fas fa-camera"></i> Register Face</button>' : ''}
      ${hasFace ? '<button id="verifyFaceBtn" class="face-btn"><i class="fas fa-check-circle"></i> Verify Me</button>' : ''}
      ${hasFace ? '<button id="reregisterFaceBtn" class="face-btn secondary"><i class="fas fa-redo"></i> Re-register</button>' : ''}
    </div>

    <div id="recognizedResult" style="margin-top:20px;"></div>
  `;
  
  container.innerHTML = html;

  const video = document.getElementById('faceVideo');
  const canvas = document.getElementById('faceCanvas');
  
  const webcamStarted = await startWebcam(video);
  if (!webcamStarted) {
    document.getElementById('faceStatus').innerHTML = '<div class="status-message error">Failed to access webcam. Please allow camera permissions.</div>';
    return;
  }

  video.addEventListener('loadedmetadata', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  });

  const registerBtn = document.getElementById('registerFaceBtn');
  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      registerBtn.disabled = true;
      registerBtn.textContent = 'Capturing...';
      
      const result = await registerFace(user.id, user.name, video);
      
      if (result.success) {
        showToast(result.message, 'success');
        document.getElementById('faceStatus').innerHTML = '<div class="status-message success">✓ Face registered successfully! You can now verify your identity.</div>';
        initStudentFaceMode(user, container);
      } else {
        document.getElementById('faceStatus').innerHTML = `<div class="status-message error">${result.error}</div>`;
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register Face';
      }
    });
  }

  const verifyBtn = document.getElementById('verifyFaceBtn');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verifying...';
      
      const result = await recognizeFace(video, 0.6);
      
      if (result.success && result.matches.length > 0) {
        const match = result.matches[0];
        if (match.userId === user.id) {
          document.getElementById('recognizedResult').innerHTML = `
            <div class="status-message success">
              <strong>✓ Verified!</strong> Welcome, ${match.userName}!<br>
              <small>Confidence: ${match.confidence}% | Time: ${new Date().toLocaleTimeString()}</small>
            </div>
          `;
          showToast(`Welcome ${match.userName}! Attendance recorded.`, 'success');
        } else {
          document.getElementById('recognizedResult').innerHTML = `
            <div class="status-message error">
              <strong>✗ Face mismatch!</strong> Detected: ${match.userName}<br>
              <small>This doesn't match your account.</small>
            </div>
          `;
        }
      } else {
        document.getElementById('recognizedResult').innerHTML = `
          <div class="status-message error">
            <strong>✗ Verification failed</strong><br>
            <small>${result.error || 'Face not recognized. Please try again.'}</small>
          </div>
        `;
      }
      
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify Me';
    });
  }

  const reregisterBtn = document.getElementById('reregisterFaceBtn');
  if (reregisterBtn) {
    reregisterBtn.addEventListener('click', () => {
      deleteRegisteredFace(user.id);
      initStudentFaceMode(user, container);
    });
  }
}
