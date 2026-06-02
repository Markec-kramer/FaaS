// ============================================================
// POROČILA IN ANALITIKA - Reports & Analytics
// Dogodki: Časovni dogodki (Scheduled/Cron) + HTTP Events
// Funkcije: generateDailyReport (scheduled), getReports,
//           triggerReportGeneration (manualno sprožanje)
// ============================================================

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const corsHandler = require("../utils/cors");
const { verifyToken } = require("../utils/authMiddleware");

// EVENT TIP: Časovni dogodki - Scheduled Function (Cron)
// Samodejno generira dnevna poročila vsak dan ob polnoči
exports.generateDailyReport = functions.pubsub
  .schedule("0 0 * * *")
  .timeZone("Europe/Ljubljana")
  .onRun(async () => {
    const db = admin.firestore();

    try {
      functions.logger.info("Generiranje dnevnih poročil za vse uporabnike...");

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const fromTs = Timestamp.fromDate(yesterday);
      const toTs = Timestamp.fromDate(today);
      const dateStr = yesterday.toISOString().split("T")[0];

      const usersSnapshot = await db.collection("users").get();
      functions.logger.info(`Generiranje za ${usersSnapshot.size} uporabnikov`);

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        const [alertsSnap, devicesSnap, sensorSnap] = await Promise.all([
          db.collection("alerts")
            .where("userId", "==", userId)
            .where("createdAt", ">=", fromTs)
            .where("createdAt", "<", toTs)
            .get(),
          db.collection("devices")
            .where("userId", "==", userId)
            .get(),
          db.collection("sensorData")
            .where("userId", "==", userId)
            .where("timestamp", ">=", fromTs)
            .where("timestamp", "<", toTs)
            .get(),
        ]);

        const stats = {
          totalDevices: devicesSnap.size,
          onlineDevices: devicesSnap.docs.filter(
            (d) => d.data().status === "online"
          ).length,
          totalAlerts: alertsSnap.size,
          criticalAlerts: alertsSnap.docs.filter(
            (d) => d.data().severity === "critical"
          ).length,
          warningAlerts: alertsSnap.docs.filter(
            (d) => d.data().severity === "warning"
          ).length,
          sensorReadings: sensorSnap.size,
        };

        const reportData = {
          userId,
          date: dateStr,
          type: "daily",
          period: { from: fromTs, to: toTs },
          stats,
          generatedAt: FieldValue.serverTimestamp(),
        };

        const reportRef = await db.collection("reports").add(reportData);

        // Shrani besedilno poročilo v Storage
        const reportText = buildReportText(dateStr, stats);
        const bucket = admin.storage().bucket();
        await bucket
          .file(`reports/${userId}/${dateStr}_dnevno_porocilo.txt`)
          .save(reportText, {
            contentType: "text/plain; charset=utf-8",
            metadata: { userId, reportDate: dateStr, reportId: reportRef.id },
          });

        functions.logger.info(`Poročilo generirano za: ${userId}`);
      }

      functions.logger.info("Vsa dnevna poročila uspešno generirana");
    } catch (error) {
      functions.logger.error("Napaka pri generiranju poročil:", error);
      throw error;
    }
  });

// HTTP - Pridobi poročila prijavljenega uporabnika
exports.getReports = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    try {
      const { limit = 10 } = req.query;
      const db = admin.firestore();

      const snapshot = await db
        .collection("reports")
        .where("userId", "==", user.uid)
        .orderBy("generatedAt", "desc")
        .limit(parseInt(limit))
        .get();

      const reports = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return res.status(200).json({ reports, count: reports.length });
    } catch (error) {
      functions.logger.error("Napaka pri pridobivanju poročil:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// HTTP - Ročno sproži generiranje poročila (za testiranje)
exports.triggerReportGeneration = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    try {
      const db = admin.firestore();
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const dateStr = today.toISOString().split("T")[0];
      const fromTs = Timestamp.fromDate(startOfDay);

      const [alertsSnap, devicesSnap, sensorSnap] = await Promise.all([
        db.collection("alerts")
          .where("userId", "==", user.uid)
          .where("createdAt", ">=", fromTs)
          .get(),
        db.collection("devices")
          .where("userId", "==", user.uid)
          .get(),
        db.collection("sensorData")
          .where("userId", "==", user.uid)
          .where("timestamp", ">=", fromTs)
          .get(),
      ]);

      const stats = {
        totalDevices: devicesSnap.size,
        onlineDevices: devicesSnap.docs.filter(
          (d) => d.data().status === "online"
        ).length,
        totalAlerts: alertsSnap.size,
        criticalAlerts: alertsSnap.docs.filter(
          (d) => d.data().severity === "critical"
        ).length,
        warningAlerts: alertsSnap.docs.filter(
          (d) => d.data().severity === "warning"
        ).length,
        sensorReadings: sensorSnap.size,
      };

      const reportData = {
        userId: user.uid,
        date: dateStr,
        type: "manual",
        stats,
        generatedAt: FieldValue.serverTimestamp(),
      };

      const reportRef = await db.collection("reports").add(reportData);

      return res.status(200).json({
        message: "Poročilo generirano",
        reportId: reportRef.id,
        date: dateStr,
        stats,
      });
    } catch (error) {
      functions.logger.error("Napaka pri ročnem generiranju poročila:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

function buildReportText(date, stats) {
  return [
    "=".repeat(50),
    `  SMARTDOM - DNEVNO POROCILO`,
    `  Datum: ${date}`,
    "=".repeat(50),
    "",
    "STATISTIKA NAPRAV:",
    `  Skupaj naprav:    ${stats.totalDevices}`,
    `  Online naprav:    ${stats.onlineDevices}`,
    "",
    "STATISTIKA OPOZORIL:",
    `  Skupaj:           ${stats.totalAlerts}`,
    `  Kriticnih:        ${stats.criticalAlerts}`,
    `  Opozoril:         ${stats.warningAlerts}`,
    "",
    "SENZORSKE MERITVE:",
    `  Skupaj meritev:   ${stats.sensorReadings}`,
    "",
    `Generirano: ${new Date().toISOString()}`,
    "=".repeat(50),
  ].join("\n");
}
