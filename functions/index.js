// ============================================================
// SMARTDOM - Pametni dom (Smart Home IoT Platform)
// Brezstrežniška arhitektura z Firebase Functions
//
// 5 GLAVNIH FUNKCIONALNOSTI:
//   1. Upravljanje uporabnikov  (src/users.js, src/auth.js)
//   2. Upravljanje IoT naprav   (src/devices.js)
//   3. Senzorski podatki        (src/sensors.js)
//   4. Avtomatizacija           (src/automation.js)
//   5. Opozorila in poročila    (src/alerts.js, src/reports.js, src/storage.js)
//
// VRSTE EVENTOV:
//   - User Events       : onUserRegistered, onUserDeleted (Auth trigger)
//   - HTTP Events       : register, login, CRUD endpoints
//   - Podatkovne spr.   : onDeviceStatusChanged, onAlertCreated (Firestore trigger)
//   - Sporočila         : processSensorData, processAlertNotification (Pub/Sub)
//   - Časovni dogodki   : checkAutomations, generateDailyReport (Scheduled)
//   - Shramba           : onImageUploaded (Storage trigger)
// ============================================================

const admin = require("firebase-admin");
admin.initializeApp();

// 1. Avtentikacija - Auth triggerji (User Events)
Object.assign(exports, require("./src/auth"));

// 2. Upravljanje uporabnikov - HTTP + Logs
Object.assign(exports, require("./src/users"));

// 3. Upravljanje IoT naprav - HTTP + Firestore trigger
Object.assign(exports, require("./src/devices"));

// 4. Senzorski podatki - HTTP (IoT) + Pub/Sub trigger
Object.assign(exports, require("./src/sensors"));

// 5. Avtomatizacija - HTTP + Scheduled (Cron)
Object.assign(exports, require("./src/automation"));

// 6. Opozorila - HTTP + Firestore trigger + Pub/Sub trigger
Object.assign(exports, require("./src/alerts"));

// 7. Shramba in slike - Storage trigger + HTTP
Object.assign(exports, require("./src/storage"));

// 8. Poročila - Scheduled (Cron) + HTTP
Object.assign(exports, require("./src/reports"));
