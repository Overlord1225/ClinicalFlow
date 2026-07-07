# ClinicalFlow - Face Recognition Attendance System

## 📋 Overview

ClinicalFlow is a clinical rotation management system with **AI-powered face recognition attendance tracking**. Built for hackathons and prototyping, it replaces traditional QR code attendance with modern face recognition technology.

---

## ✨ Key Features

### 🔐 Authentication & Roles
- **Student** - View dashboard, register face, verify attendance
- **CI (Clinical Instructor)** - Scan students, mark attendance
- **Scheduler** - Manage schedules and announcements
- **Admin** - View analytics and manage system

### 📸 Face Recognition Attendance (NEW!)
- **Student Mode:**
  - Register face with one click
  - Verify identity with confidence score
  - Re-register face if needed
  
- **CI Mode:**
  - Real-time multi-face detection
  - Automatic student recognition
  - Live attendance tracking with timestamps
  - Visual bounding boxes around detected faces

### 📊 Other Features
- Student dashboard with case progress tracking
- Opportunity board for duty slots
- QR Attendance (legacy, replaced by face recognition)
- Notifications system
- Admin analytics dashboard
- AI Matchmaker for duty assignment

---

## 🚀 Quick Start Guide

### Prerequisites
- Modern web browser (Chrome, Firefox, Edge)
- Webcam/camera
- Local web server (required for ES6 modules)

### Step 1: Start the Server

Open a terminal in the `CriticalFlow` folder and run:

```bash
# Using Python (recommended)
python3 -m http.server 8000

# OR using Node.js
npx serve .

# OR using PHP
php -S localhost:8000
```

### Step 2: Open the Application

Navigate to in your browser:
```
http://localhost:8000
# OR
http://localhost:5500 (if using VS Code Live Server)
```

### Step 3: Login

Use these demo credentials:

| Role | Email | Password |
|------|-------|----------|
| Student | student@demo.com | password123 |
| CI | ci@demo.com | password123 |
| Scheduler | scheduler@demo.com | password123 |
| Admin | admin@demo.com | password123 |

**OR** click on any role button to auto-fill credentials, then click "Sign In"

---

## 📸 Using Face Recognition Attendance

### For Students:

1. **Login** with student credentials
2. Navigate to **"QR Attendance"** in the sidebar (now shows "Face Attendance")
3. Click **"Register Face"** button
4. Position your face in the camera view
5. Click the button to capture your face
6. Wait for success message
7. Click **"Verify Me"** to test recognition
8. See your name and confidence score

**Note:** Your face data is stored locally in your browser (localStorage). If you clear browser data, you'll need to re-register.

### For CI (Clinical Instructor):

1. **Login** with CI credentials
2. Navigate to **"QR Attendance"** in the sidebar
3. Click **"Start Scanning"** button
4. Point camera at students
5. Watch as students are automatically detected and recognized:
   - Green bounding box = Recognized student (with name)
   - Red bounding box = Unknown face
6. View the **Recognized Students** list on the right with:
   - Student name
   - Time of detection
   - Confidence percentage
7. Click **"Stop Scanning"** when done

---

## 🗂️ Project Structure

```
CriticalFlow/
├── index.html                    # Login page
├── signup.html                   # User registration
├── student-dashboard.html        # Student dashboard
├── ci-dashboard.html             # CI dashboard
├── scheduler-dashboard.html      # Scheduler dashboard
├── admin.html                    # Admin analytics
├── qr-attendance.html            # Face recognition attendance ⭐
├── case-passport.html            # Case tracking
├── opportunity-board.html        # Duty slot board
├── notifications.html            # Notifications
├── ai-matchmaker.html            # AI matching
├── css/
│   └── style.css                 # All styles
├── js/
│   ├── supabaseClient.js         # Supabase configuration
│   ├── auth.js                   # Authentication helpers
│   ├── data.js                   # Database operations
│   ├── utils.js                  # Utility functions
│   ├── main.js                   # Main application logic
│   ├── faceRecognition.js        # Face recognition service ⭐
│   ├── face-api.min.js           # Face-api.js library
│   └── face-api-models/          # AI models
│       ├── tiny_face_detector_model-shard1
│       ├── tiny_face_detector_model-weights_manifest.json
│       ├── face_landmark_68_model-shard1
│       ├── face_landmark_68_model-weights_manifest.json
│       ├── face_recognition_model-shard1
│       ├── face_recognition_model-shard2
│       └── face_recognition_model-weights_manifest.json
└── README.md                     # This file
```

---

## 🔧 Technical Details

### Face Recognition Technology
- **Library:** face-api.js (v0.22.2)
- **Models:** Tiny Face Detector, Face Landmark 68, Face Recognition
- **Storage:** Browser localStorage (no database required)
- **Recognition Threshold:** 60% confidence minimum
- **Scanning Interval:** 2 seconds (CI mode)

### Database
- **Backend:** Supabase
- **Auth:** Supabase Auth (email/password)
- **Tables:** users, students, schedules, notifications, open_slots, required_cases, case_progress

### Browser Requirements
- Camera permissions required
- Works on localhost or HTTPS only
- Recommended: Chrome, Firefox, Edge (latest versions)

---

## 🐛 Troubleshooting

### Camera Not Working
- Ensure you're on `http://localhost` or `https://`
- Check browser permissions (click lock icon in address bar)
- Try Chrome/Edge for best compatibility

### Face Not Detected
- Ensure good lighting
- Face should be clearly visible and centered
- Move closer to camera
- Remove glasses/sunglasses if needed

### Models Not Loading
- Check that all files in `js/face-api-models/` are present (7 files total)
- Hard refresh the page (Ctrl+Shift+R)
- Check browser console for specific errors

### Login Fails
- Verify demo users exist in Supabase `users` table
- Check Supabase credentials in `js/supabaseClient.js`
- Ensure Supabase project is active

### CORS Errors
- **Don't** open HTML files directly (no `file://` protocol)
- Always use a local web server
- Use one of the server commands listed in "Quick Start"

---

## 🎯 Testing the System

### Test Student Flow:
1. Login as `student@demo.com` / `password123`
2. Go to Face Attendance
3. Register your face
4. Verify your face
5. Check that recognition works

### Test CI Flow:
1. Login as `ci@demo.com` / `password123`
2. Go to Face Attendance
3. Click "Start Scanning"
4. Have students with registered faces appear in camera
5. Verify they appear in the recognized list
6. Check confidence scores and timestamps

### Test Multiple Users:
1. Register faces for multiple demo users
2. Login as CI
3. Scan multiple people at once
4. Verify all are detected and recognized

---

## 📝 Notes

- **Prototype Status:** This is a hackathon prototype. Some features are simplified.
- **Face Data Storage:** Currently uses localStorage (per-browser). For production, move to database.
- **Demo Data:** Demo users may not have case progress or schedules. This is expected.
- **Model Size:** Face recognition models are ~7MB total. First load may take a few seconds.

---

## 🔄 Recent Updates

### Face Recognition System (Latest)
- ✅ Replaced QR code with face recognition
- ✅ Student face registration
- ✅ CI multi-face scanning
- ✅ Real-time recognition with confidence scores
- ✅ Visual bounding boxes
- ✅ Attendance timestamps
- ✅ LocalStorage for face data
- ✅ Error handling for missing database data

### Previous Updates
- ✅ Login functionality added
- ✅ Error handling for empty database tables
- ✅ Fixed Supabase client case sensitivity
- ✅ Added comprehensive error handling

---

## 👥 Credits

Built with:
- [face-api.js](https://github.com/justadudewhohacks/face-api.js) - Face recognition
- [Supabase](https://supabase.io) - Backend & authentication
- [Font Awesome](https://fontawesome.com) - Icons

---

## 📄 License

This is a hackathon prototype. Feel free to use and modify as needed.

---

## 🆘 Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Open browser console (F12) and look for error messages
3. Verify all files are in place
4. Ensure server is running on localhost

**Happy coding! 🚀**