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

export async function initFaceAttendance() {
  const user = requireAuth();
  if (!user) return;
  const role = user.role;
  const container = document.getElementById('faceScannerContainer');
  
  document.getElementById('modeBadge').textContent = role === 'ci' ? 'CI Mode' : 'Student Mode';

  const initialized = await initFaceApi();
  if (!initialized) {
    container.innerHTML = '<div class="status-message error">Failed to load face recognition models. Please refresh the page.</div>';
    return;
  }

  if (role === 'student') {
    await initStudentFaceMode(user, container);
  } else if (role === 'ci') {
    await initCIFaceMode(user, container);
  }
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

async function initCIFaceMode(user, container) {
  let html = `
    <h3><i class="fas fa-user-md"></i> CI Face Scanner</h3>
    <p>Scan students for attendance verification</p>
    
    <div class="video-wrapper">
      <video id="faceVideo" autoplay muted playsinline></video>
      <canvas id="faceCanvas"></canvas>
    </div>

    <div id="faceStatus" class="status-message info">
      Click "Start Scanning" to detect students
    </div>

    <div class="face-actions">
      <button id="startScanBtn" class="face-btn"><i class="fas fa-play"></i> Start Scanning</button>
      <button id="stopScanBtn" class="face-btn secondary" disabled><i class="fas fa-stop"></i> Stop Scanning</button>
    </div>

    <div id="recognizedList" class="recognized-list">
      <h3>Recognized Students</h3>
      <div id="recognizedStudents">
        <p style="color:#64748b; font-style:italic;">No students scanned yet</p>
      </div>
    </div>
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

  let recognizedStudents = new Map();
  let isScanning = false;

  document.getElementById('startScanBtn').addEventListener('click', async () => {
    isScanning = true;
    isScanningMultiple = true;
    document.getElementById('startScanBtn').disabled = true;
    document.getElementById('stopScanBtn').disabled = false;
    document.getElementById('faceStatus').innerHTML = '<div class="scanning-indicator"><div class="spinner"></div> Scanning for faces...</div>';
    
    recognizedStudents.clear();
    updateRecognizedList();

    faceScanningInterval = setInterval(async () => {
      if (!isScanning) return;
      
      const result = await detectAllFaces(video, 0.6);
      
      if (result.success && result.faces.length > 0) {
        clearCanvas(canvas);
        
        result.faces.forEach(faceData => {
          const { detection, match } = faceData;
          
          const label = match ? `${match.userName} (${match.confidence}%)` : 'Unknown';
          const color = match ? '#00ff00' : '#ff0000';
          drawFaceBox(canvas, detection, label, color);
          
          if (match && !recognizedStudents.has(match.userId)) {
            recognizedStudents.set(match.userId, {
              name: match.userName,
              confidence: match.confidence,
              time: new Date().toLocaleTimeString()
            });
            updateRecognizedList();
            showToast(`Recognized: ${match.userName}`, 'success', 2000);
          }
        });
      } else {
        clearCanvas(canvas);
      }
    }, 2000);
  });

  document.getElementById('stopScanBtn').addEventListener('click', () => {
    isScanning = false;
    isScanningMultiple = false;
    if (faceScanningInterval) {
      clearInterval(faceScanningInterval);
      faceScanningInterval = null;
    }
    document.getElementById('startScanBtn').disabled = false;
    document.getElementById('stopScanBtn').disabled = true;
    document.getElementById('faceStatus').innerHTML = '<div class="status-message info">Scanning stopped. Click "Start Scanning" to resume.</div>';
    clearCanvas(canvas);
  });

  function updateRecognizedList() {
    const listContainer = document.getElementById('recognizedStudents');
    
    if (recognizedStudents.size === 0) {
      listContainer.innerHTML = '<p style="color:#64748b; font-style:italic;">No students scanned yet</p>';
      return;
    }

    listContainer.innerHTML = Array.from(recognizedStudents.values()).map(student => `
      <div class="recognized-item">
        <div class="recognized-info">
          <div class="recognized-name">${student.name}</div>
          <div class="recognized-time">Time: ${student.time}</div>
        </div>
        <span class="recognized-confidence ${student.confidence < 70 ? 'medium' : ''}">${student.confidence}%</span>
      </div>
    `).join('');
  }
}