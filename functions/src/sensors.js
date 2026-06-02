// ============================================================
// SENZORSKI PODATKI - IoT Sensor Data Processing
// Dogodki: IoT Events (HTTP) + Sporočila (Pub/Sub Trigger)
// Funkcije: sendSensorData, processSensorData, getSensorHistory
// ============================================================

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const corsHandler = require("../utils/cors");
const { verifyToken } = require("../utils/authMiddleware");
const { publishMessage } = require("../utils/pubsub");

// Mejne vrednosti za različne tipe senzorjev
const THRESHOLDS = {
  temperature: { min: -10, max: 40, unit: "°C" },
  humidity: { min: 20, max: 80, unit: "%" },
  co2: { min: 0, max: 1000, unit: "ppm" },
  pressure: { min: 950, max: 1050, unit: "hPa" },
};

// EVENT TIP: IoT Events - HTTP endpoint za IoT naprave
// IoT naprave pošiljajo meritve na ta endpoint (brez avtentikacije)
exports.sendSensorData = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const { deviceId, value, unit, type } = req.body;

    if (!deviceId || value === undefined || !unit || !type) {
      return res.status(400).json({
        error: "Obvezna polja: deviceId, value, unit, type",
        example: {
          deviceId: "abc123",
          type: "temperature",
          value: 23.5,
          unit: "°C",
        },
      });
    }

    try {
      const db = admin.firestore();
      const deviceDoc = await db.collection("devices").doc(deviceId).get();

      if (!deviceDoc.exists) {
        return res.status(404).json({ error: "Naprava ni najdena" });
      }

      const device = deviceDoc.data();
      const parsedValue = parseFloat(value);

      // Shrani senzorske podatke v Firestore
      const dataRef = await db.collection("sensorData").add({
        deviceId,
        deviceName: device.name,
        userId: device.userId,
        type,
        value: parsedValue,
        unit,
        timestamp: FieldValue.serverTimestamp(),
        processed: false,
      });

      // Posodobi zadnjo vrednost na napravi
      await db.collection("devices").doc(deviceId).update({
        lastValue: parsedValue,
        lastValueUnit: unit,
        lastUpdated: FieldValue.serverTimestamp(),
        status: "online",
      });

      // Objavi sporočilo v Pub/Sub za asinhrono procesiranje
      try {
        await publishMessage("sensor-data", {
          sensorDataId: dataRef.id,
          deviceId,
          userId: device.userId,
          deviceName: device.name,
          type,
          value: parsedValue,
          unit,
        });
      } catch (pubsubError) {
        // Pub/Sub napaka ne ustavi odgovora
        functions.logger.warn("Pub/Sub ni dosegljiv:", pubsubError.message);
      }

      return res.status(201).json({
        message: "Senzorski podatki prejeti",
        dataId: dataRef.id,
      });
    } catch (error) {
      functions.logger.error("Napaka pri sprejemu senzorskih podatkov:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// EVENT TIP: Sporočila - Pub/Sub Trigger
// Samodejno se sproži ob objavi sporočila v temo "sensor-data"
exports.processSensorData = functions.pubsub
  .topic("sensor-data")
  .onPublish(async (message) => {
    const db = admin.firestore();

    try {
      const data = message.json;
      functions.logger.info("Procesiranje senzorskih podatkov:", data);

      const threshold = THRESHOLDS[data.type];
      let alertCreated = false;

      // Preveri prekoračitev mejnih vrednosti
      if (
        threshold &&
        (data.value > threshold.max || data.value < threshold.min)
      ) {
        const direction = data.value > threshold.max ? "previsoka" : "prenizka";

        await db.collection("alerts").add({
          userId: data.userId,
          deviceId: data.deviceId,
          deviceName: data.deviceName,
          type: "THRESHOLD_VIOLATION",
          severity: "critical",
          message: `${data.type} vrednost ${direction}: ${data.value}${data.unit} (meje: ${threshold.min}–${threshold.max}${threshold.unit})`,
          sensorDataId: data.sensorDataId,
          isRead: false,
          createdAt: FieldValue.serverTimestamp(),
        });
        alertCreated = true;

        functions.logger.warn(
          `Prekoračitev meje za ${data.type}: ${data.value}${data.unit}`
        );
      }

      // Označi senzorske podatke kot procesirane
      await db.collection("sensorData").doc(data.sensorDataId).update({
        processed: true,
        alertCreated,
        processedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      functions.logger.error("Napaka pri procesiranju senzorskih podatkov:", error);
      throw error;
    }
  });

// HTTP - Pridobi zgodovino senzorskih meritev
exports.getSensorHistory = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    try {
      const { deviceId, limit = 50 } = req.query;
      const db = admin.firestore();

      let query;

      if (deviceId) {
        query = db
          .collection("sensorData")
          .where("userId", "==", user.uid)
          .where("deviceId", "==", deviceId)
          .orderBy("timestamp", "desc")
          .limit(parseInt(limit));
      } else {
        query = db
          .collection("sensorData")
          .where("userId", "==", user.uid)
          .orderBy("timestamp", "desc")
          .limit(parseInt(limit));
      }

      const snapshot = await query.get();
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return res.status(200).json({ data, count: data.length });
    } catch (error) {
      functions.logger.error("Napaka pri pridobivanju zgodovine:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});
