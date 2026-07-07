// js/faceRecognition.js
// Face recognition service using face-api.js

let faceapiLoaded = false;
let modelsLoaded = false;

// Load face-api.js models
export async function loadFaceApiModels() {
  if (modelsLoaded) return true;

  try {
    const MODEL_URL = 'js/face-api-models/';
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);

    modelsLoaded = true;
    console.log('Face-api models loaded successfully');
    return true;
  } catch (error) {
    console.error('Error loading face-api models:', error);
    return false;
  }
}

// Initialize face-api.js library
export async function initFaceApi() {
  if (faceapiLoaded) return true;

  try {
    // face-api.js is loaded via script tag, check if it's available
    if (typeof faceapi === 'undefined') {
      console.error('face-api.js not loaded');
      return false;
    }
    
    faceapiLoaded = true;
    return await loadFaceApiModels();
  } catch (error) {
    console.error('Error initializing face-api:', error);
    return false;
  }
}

// Capture face descriptor from video/image
export async function captureFaceDescriptor(videoElement) {
  try {
    if (!modelsLoaded) {
      await loadFaceApiModels();
    }

    // Detect face with landmarks
    const detection = await faceapi
      .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      return { success: false, error: 'No face detected. Please position your face in the camera.' };
    }

    return {
      success: true,
      descriptor: Array.from(detection.descriptor),
      detection: detection
    };
  } catch (error) {
    console.error('Error capturing face:', error);
    return { success: false, error: 'Failed to capture face: ' + error.message };
  }
}

// Register face for a user
export async function registerFace(userId, userName, videoElement) {
  try {
    const result = await captureFaceDescriptor(videoElement);
    
    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Store face descriptor in localStorage
    const faceData = {
      userId: userId,
      userName: userName,
      descriptor: result.descriptor,
      registeredAt: new Date().toISOString()
    };

    // Get existing registered faces
    const registeredFaces = getRegisteredFaces();
    registeredFaces[userId] = faceData;
    
    localStorage.setItem('clinicalflow_faces', JSON.stringify(registeredFaces));

    return { success: true, message: 'Face registered successfully!' };
  } catch (error) {
    console.error('Error registering face:', error);
    return { success: false, error: 'Failed to register face: ' + error.message };
  }
}

// Get all registered faces from localStorage
export function getRegisteredFaces() {
  try {
    const stored = localStorage.getItem('clinicalflow_faces');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error getting registered faces:', error);
    return {};
  }
}

// Recognize face from video/image
export async function recognizeFace(videoElement, threshold = 0.6) {
  try {
    if (!modelsLoaded) {
      await loadFaceApiModels();
    }

    // Detect face
    const detection = await faceapi
      .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      return { success: false, error: 'No face detected', matches: [] };
    }

    // Compare with registered faces
    const registeredFaces = getRegisteredFaces();
    const matches = [];

    for (const [userId, faceData] of Object.entries(registeredFaces)) {
      const distance = faceapi.euclideanDistance(
        detection.descriptor,
        new Float32Array(faceData.descriptor)
      );

      if (distance < threshold) {
        const confidence = Math.round((1 - distance) * 100);
        matches.push({
          userId: userId,
          userName: faceData.userName,
          confidence: confidence,
          distance: distance
        });
      }
    }

    // Sort by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);

    return {
      success: true,
      detection: detection,
      matches: matches
    };
  } catch (error) {
    console.error('Error recognizing face:', error);
    return { success: false, error: 'Failed to recognize face: ' + error.message, matches: [] };
  }
}

// Detect all faces in image/video (for CI scanning multiple students)
export async function detectAllFaces(videoElement, threshold = 0.6) {
  try {
    if (!modelsLoaded) {
      await loadFaceApiModels();
    }

    // Detect all faces
    const detections = await faceapi
      .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!detections || detections.length === 0) {
      return { success: true, faces: [] };
    }

    // Compare each detected face with registered faces
    const registeredFaces = getRegisteredFaces();
    const recognizedFaces = [];

    for (const detection of detections) {
      const matches = [];

      for (const [userId, faceData] of Object.entries(registeredFaces)) {
        const distance = faceapi.euclideanDistance(
          detection.descriptor,
          new Float32Array(faceData.descriptor)
        );

        if (distance < threshold) {
          const confidence = Math.round((1 - distance) * 100);
          matches.push({
            userId: userId,
            userName: faceData.userName,
            confidence: confidence,
            distance: distance
          });
        }
      }

      // Get best match
      matches.sort((a, b) => b.confidence - a.confidence);
      const bestMatch = matches.length > 0 ? matches[0] : null;

      recognizedFaces.push({
        detection: detection,
        match: bestMatch,
        allMatches: matches
      });
    }

    return {
      success: true,
      faces: recognizedFaces
    };
  } catch (error) {
    console.error('Error detecting faces:', error);
    return { success: false, error: 'Failed to detect faces: ' + error.message, faces: [] };
  }
}

// Check if user has registered face
export function hasRegisteredFace(userId) {
  const registeredFaces = getRegisteredFaces();
  return !!registeredFaces[userId];
}

// Delete registered face
export function deleteRegisteredFace(userId) {
  const registeredFaces = getRegisteredFaces();
  delete registeredFaces[userId];
  localStorage.setItem('clinicalflow_faces', JSON.stringify(registeredFaces));
}

// Start webcam
export async function startWebcam(videoElement) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      }
    });

    videoElement.srcObject = stream;
    
    return new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        resolve(true);
      };
    });
  } catch (error) {
    console.error('Error starting webcam:', error);
    return false;
  }
}

// Stop webcam
export function stopWebcam(videoElement) {
  try {
    if (videoElement.srcObject) {
      const tracks = videoElement.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoElement.srcObject = null;
    }
  } catch (error) {
    console.error('Error stopping webcam:', error);
  }
}

// Draw face detection box on canvas
export function drawFaceBox(canvas, detection, label = '', color = '#00ff00') {
  const ctx = canvas.getContext('2d');
  const box = detection.detection.box;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw box
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(box.x, box.y, box.width, box.height);

  // Draw label background
  if (label) {
    ctx.fillStyle = color;
    ctx.fillRect(box.x, box.y - 30, box.width, 30);

    // Draw label text
    ctx.fillStyle = '#000';
    ctx.font = '16px Arial';
    ctx.fillText(label, box.x + 5, box.y - 8);
  }
}

// Clear canvas
export function clearCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}