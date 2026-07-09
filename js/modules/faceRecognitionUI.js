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
let faceDetectionInterval = null;

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

function buildConfidenceMeter(confidence) {
  const level = confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low';
  return `
    <div class="confidence-meter">
      <div class="meter-label">
        <span>Confidence</span>
        <span>${confidence}%</span>
      </div>
      <div class="meter-bar-bg">
        <div class="meter-bar-fill ${level}" style="width:${confidence}%"></div>
      </div>
    </div>
  `;
}

function buildResultCard(type, title, subtitle, timeStr, confidence) {
  const iconMap = {
    success: '✅',
    error: '❌',
    warning: '⚠️'
  };
  let extraHtml = '';
  if (confidence !== undefined) {
    extraHtml = buildConfidenceMeter(confidence);
  }
  return `
    <div class="result-card">
      <div class="result-icon ${type}">${iconMap[type] || 'ℹ️'}</div>
      <div class="result-body">
        <div class="result-title">${title}</div>
        <div class="result-sub">${subtitle}</div>
        ${timeStr ? `<div class="result-time">${timeStr}</div>` : ''}
      </div>
    </div>
    ${extraHtml}
  `;
}

function buildFaceGuideOverlay(detected) {
  const statusClass = detected ? 'detected' : 'undetected';
  const hintClass = detected ? 'success' : '';
  const hintText = detected ? 'Face detected ✓' : 'Position your face in the oval';
  return `
    <div class="face-guide-overlay">
      <div class="face-oval ${statusClass}"></div>
    </div>
    <div class="face-guide-hint ${hintClass}">${hintText}</div>
  `;
}

function updateVideoWrapperState(videoWrapper, state) {
  videoWrapper.classList.remove('face-detected', 'face-not-detected', 'face-scanning');
  if (state) {
    videoWrapper.classList.add(state);
  }
}

async function startFaceDetectionLoop(video, videoWrapper, canvas) {
  // Clear any existing loop
  if (faceDetectionInterval) {
    clearInterval(faceDetectionInterval);
    faceDetectionInterval = null;
  }

  // Remove any existing guide overlay
  const existingOverlay = videoWrapper.querySelector('.face-guide-overlay');
  if (existingOverlay) existingOverlay.remove();
  const existingHint = videoWrapper.querySelector('.face-guide-hint');
  if (existingHint) existingHint.remove();

  // Add guide overlay
  videoWrapper.insertAdjacentHTML('beforeend', buildFaceGuideOverlay(false));

  const guideOval = videoWrapper.querySelector('.face-oval');
  const guideHint = videoWrapper.querySelector('.face-guide-hint');

  faceDetectionInterval = setInterval(async () => {
    try {
      if (typeof faceapi === 'undefined') return;
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      if (detection) {
        updateVideoWrapperState(videoWrapper, 'face-detected');
        if (guideOval) {
          guideOval.className = 'face-oval detected';
        }
        if (guideHint) {
          guideHint.textContent = 'Face detected ✓';
          guideHint.className = 'face-guide-hint success';
        }
      } else {
        updateVideoWrapperState(videoWrapper, 'face-not-detected');
        if (guideOval) {
          guideOval.className = 'face-oval undetected';
        }
        if (guideHint) {
          guideHint.textContent = 'Position your face in the oval';
          guideHint.className = 'face-guide-hint';
        }
      }
    } catch (e) {
      // Silently continue if detection fails (e.g. during capture)
    }
  }, 500);
}

function stopFaceDetectionLoop() {
  if (faceDetectionInterval) {
    clearInterval(faceDetectionInterval);
    faceDetectionInterval = null;
  }
}

async function initStudentFaceMode(user, container) {
  const hasFace = hasRegisteredFace(user.id);
  
  let html = `
    <h3><i class="fas fa-camera"></i> Face Registration & Verification</h3>
    <p>Register your face for attendance tracking</p>
    
    <div class="video-wrapper" id="faceVideoWrapper">
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
  const videoWrapper = document.getElementById('faceVideoWrapper');
  
  const webcamStarted = await startWebcam(video);
  if (!webcamStarted) {
    document.getElementById('faceStatus').innerHTML = '<div class="status-message error">Failed to access webcam. Please allow camera permissions.</div>';
    return;
  }

  video.addEventListener('loadedmetadata', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    // Start live face detection loop
    startFaceDetectionLoop(video, videoWrapper, canvas);
  });

  const registerBtn = document.getElementById('registerFaceBtn');
  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      registerBtn.disabled = true;
      registerBtn.innerHTML = '<span class="btn-spinner"></span> Capturing...';
      updateVideoWrapperState(videoWrapper, 'face-scanning');
      
      const result = await registerFace(user.id, user.name, video);
      
      if (result.success) {
        showToast(result.message, 'success');
        document.getElementById('faceStatus').innerHTML = `
          <div class="status-message success">
            <strong>✓ Face registered successfully!</strong> You can now verify your identity.
          </div>
        `;
        // Show success animation on button
        registerBtn.innerHTML = '<span class="btn-check">✓</span> Registered!';
        setTimeout(() => {
          initStudentFaceMode(user, container);
        }, 1200);
      } else {
        document.getElementById('faceStatus').innerHTML = `<div class="status-message error">${result.error}</div>`;
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<i class="fas fa-camera"></i> Register Face';
        updateVideoWrapperState(videoWrapper, 'face-not-detected');
      }
    });
  }

  const verifyBtn = document.getElementById('verifyFaceBtn');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      verifyBtn.disabled = true;
      verifyBtn.innerHTML = '<span class="btn-spinner"></span> Verifying...';
      updateVideoWrapperState(videoWrapper, 'face-scanning');
      
      const result = await recognizeFace(video, 0.6);
      
      const resultContainer = document.getElementById('recognizedResult');
      
      if (result.success && result.matches.length > 0) {
        const match = result.matches[0];
        if (match.userId === user.id) {
          resultContainer.innerHTML = buildResultCard(
            'success',
            '✓ Verified!',
            `Welcome, ${match.userName}!`,
            `Time: ${new Date().toLocaleTimeString()}`,
            match.confidence
          );
          showToast(`Welcome ${match.userName}! Attendance recorded.`, 'success');
          verifyBtn.innerHTML = '<span class="btn-check">✓</span> Verified!';
        } else {
          resultContainer.innerHTML = buildResultCard(
            'error',
            '✗ Face Mismatch!',
            `Detected: ${match.userName} — This doesn't match your account.`,
            null,
            match.confidence
          );
          verifyBtn.innerHTML = '<i class="fas fa-check-circle"></i> Verify Me';
        }
      } else {
        resultContainer.innerHTML = buildResultCard(
          'warning',
          '✗ Verification Failed',
          result.error || 'Face not recognized. Please try again.',
          null
        );
        verifyBtn.innerHTML = '<i class="fas fa-check-circle"></i> Verify Me';
      }
      
      verifyBtn.disabled = false;
      setTimeout(() => {
        updateVideoWrapperState(videoWrapper, 'face-detected');
      }, 500);
    });
  }

  const reregisterBtn = document.getElementById('reregisterFaceBtn');
  if (reregisterBtn) {
    reregisterBtn.addEventListener('click', () => {
      deleteRegisteredFace(user.id);
      stopFaceDetectionLoop();
      initStudentFaceMode(user, container);
    });
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopFaceDetectionLoop();
  const video = document.getElementById('faceVideo');
  if (video) stopWebcam(video);
});