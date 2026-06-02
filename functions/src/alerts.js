// ============================================================
// OPOZORILA IN OBVESTILA - Alerts & Notifications
// Dogodki: HTTP Events + Podatkovne spremembe (Firestore Trigger)
//          + Sporočila (Pub/Sub Trigger)
// Funkcije: getAlerts, markAlertRead, markAllAlertsRead,
//           onAlertCreated, processAlertNotification
// ============================================================

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const corsHandler = require("../utils/cors");
const { verifyToken } = require("../utils/authMiddleware");
const { publishMessage } = require("../utils/pubsub");

// HTTP - Pridobi opozorila uporabnika
exports.getAlerts = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    try {
      const { unreadOnly, severity, limit = 20 } = req.query;
      const db = admin.firestore();

      let query = db
        .collection("alerts")
        .where("userId", "==", user.uid)
        .orderBy("createdAt", "desc")
        .limit(parseInt(limit));

      if (unreadOnly === "true") {
        query = db
          .collection("alerts")
          .where("userId", "==", user.uid)
          .where("isRead", "==", false)
          .orderBy("createdAt", "desc")
          .limit(parseInt(limit));
      } else if (severity) {
        query = db
          .collection("alerts")
          .where("userId", "==", user.uid)
          .where("severity", "==", severity)
          .orderBy("createdAt", "desc")
          .limit(parseInt(limit));
      }

      const snapshot = await query.get();
      const alerts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const unreadCount = alerts.filter((a) => !a.isRead).length;

      return res.status(200).json({
        alerts,
        count: alerts.length,
        unreadCount,
      });
    } catch (error) {
      functions.logger.error("Napaka pri pridobivanju opozoril:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// HTTP - Označi opozorilo kot prebrano (?alertId=...)
exports.markAlertRead = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "PUT") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    const alertId = req.query.alertId;
    if (!alertId) {
      return res.status(400).json({ error: "Manjka query param: alertId" });
    }

    try {
      const db = admin.firestore();
      const ref = db.collection("alerts").doc(alertId);
      const doc = await ref.get();

      if (!doc.exists || doc.data().userId !== user.uid) {
        return res.status(404).json({ error: "Opozorilo ni najdeno" });
      }

      await ref.update({
        isRead: true,
        readAt: FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ message: "Opozorilo označeno kot prebrano" });
    } catch (error) {
      functions.logger.error("Napaka pri označevanju opozorila:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// HTTP - Označi vsa opozorila kot prebrana
exports.markAllAlertsRead = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "PUT") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    try {
      const db = admin.firestore();
      const snapshot = await db
        .collection("alerts")
        .where("userId", "==", user.uid)
        .where("isRead", "==", false)
        .get();

      const batch = db.batch();
      const now = FieldValue.serverTimestamp();

      snapshot.forEach((doc) => {
        batch.update(doc.ref, { isRead: true, readAt: now });
      });

      await batch.commit();

      return res.status(200).json({
        message: "Vsa opozorila označena kot prebrana",
        count: snapshot.size,
      });
    } catch (error) {
      functions.logger.error("Napaka pri označevanju opozoril:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// EVENT TIP: Podatkovne spremembe - Firestore Trigger
// Samodejno se sproži ob ustvarjanju novega opozorila
exports.onAlertCreated = functions.firestore
  .document("alerts/{alertId}")
  .onCreate(async (snapshot, context) => {
    const alert = snapshot.data();
    const alertId = context.params.alertId;

    try {
      functions.logger.info(
        `Novo opozorilo [${alert.severity}]: ${alert.message}`
      );

      // Objavi v Pub/Sub za procesiranje obvestil
      try {
        await publishMessage(
          "alert-notifications",
          {
            alertId,
            userId: alert.userId,
            deviceId: alert.deviceId,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
          },
          { severity: alert.severity, userId: alert.userId }
        );
      } catch (pubsubError) {
        functions.logger.warn("Pub/Sub ni dosegljiv:", pubsubError.message);
      }

      // Zabeleži v log
      const db = admin.firestore();
      await db.collection("logs").add({
        type: "ALERT_CREATED",
        alertId,
        userId: alert.userId,
        alertType: alert.type,
        severity: alert.severity,
        timestamp: FieldValue.serverTimestamp(),
        message: `Opozorilo ustvarjeno: ${alert.type} (${alert.severity})`,
      });
    } catch (error) {
      functions.logger.error("Napaka pri obdelavi novega opozorila:", error);
    }
  });

// EVENT TIP: Sporočila - Pub/Sub Trigger
// Samodejno se sproži ob prejemu sporočila v temo "alert-notifications"
exports.processAlertNotification = functions.pubsub
  .topic("alert-notifications")
  .onPublish(async (message) => {
    const db = admin.firestore();

    try {
      const data = message.json;
      const attributes = message.attributes || {};

      functions.logger.info(
        `Procesiranje obvestila za uporabnika: ${data.userId}`
      );

      // Določi prioriteto obvestila glede na resnost
      const priority =
        attributes.severity === "critical"
          ? "high"
          : attributes.severity === "warning"
          ? "normal"
          : "low";

      // Simulacija pošiljanja obvestila (v produkciji: FCM, email, SMS)
      await db.collection("notifications").add({
        userId: data.userId,
        alertId: data.alertId,
        deviceId: data.deviceId || null,
        channel: "in-app",
        priority,
        title: getNotificationTitle(data.type),
        body: data.message,
        severity: data.severity,
        isRead: false,
        sentAt: FieldValue.serverTimestamp(),
        status: "delivered",
      });

      functions.logger.info(
        `Obvestilo dostavljeno (${priority}) za: ${data.userId}`
      );
    } catch (error) {
      functions.logger.error("Napaka pri procesiranju obvestila:", error);
      throw error;
    }
  });

function getNotificationTitle(alertType) {
  const titles = {
    DEVICE_OFFLINE: "Naprava offline",
    DEVICE_ONLINE: "Naprava online",
    THRESHOLD_VIOLATION: "Prekoračitev mejne vrednosti",
    AUTOMATION_TRIGGERED: "Avtomatizacija sprožena",
    CAMERA_IMAGE_CAPTURED: "Nova slika kamere",
  };
  return titles[alertType] || "Sistemsko obvestilo";
}
