// ============================================================
// UPRAVLJANJE NAPRAV - IoT Device Management
// Dogodki: HTTP Events + Podatkovne spremembe (Firestore Trigger)
// Funkcije: addDevice, getDevices, updateDevice, deleteDevice,
//           onDeviceStatusChanged
// ============================================================

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const corsHandler = require("../utils/cors");
const { verifyToken } = require("../utils/authMiddleware");

const VALID_TYPES = [
  "temperature_sensor",
  "humidity_sensor",
  "motion_sensor",
  "camera",
  "smart_light",
  "smart_lock",
  "co2_sensor",
  "pressure_sensor",
];

// HTTP - Dodaj IoT napravo
exports.addDevice = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    const { name, type, location, description } = req.body;

    if (!name || !type) {
      return res
        .status(400)
        .json({ error: "Obvezna polja: name, type", validTypes: VALID_TYPES });
    }
    if (!VALID_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ error: "Neveljaven tip naprave", validTypes: VALID_TYPES });
    }

    try {
      const db = admin.firestore();
      const ref = db.collection("devices").doc();

      await ref.set({
        id: ref.id,
        name,
        type,
        location: location || "",
        description: description || "",
        userId: user.uid,
        status: "online",
        isActive: true,
        lastValue: null,
        lastValueUnit: null,
        lastUpdated: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });

      return res
        .status(201)
        .json({ message: "Naprava dodana", deviceId: ref.id });
    } catch (error) {
      functions.logger.error("Napaka pri dodajanju naprave:", error);
      return res.status(500).json({ error: "Interna napaka strežnika", detail: error.message });
    }
  });
});

// HTTP - Pridobi vse naprave uporabnika
exports.getDevices = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    try {
      const db = admin.firestore();
      const snapshot = await db
        .collection("devices")
        .where("userId", "==", user.uid)
        .orderBy("createdAt", "desc")
        .get();

      const devices = snapshot.docs.map((doc) => doc.data());

      return res.status(200).json({ devices, count: devices.length });
    } catch (error) {
      functions.logger.error("Napaka pri pridobivanju naprav:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// HTTP - Posodobi napravo (?deviceId=...)
exports.updateDevice = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "PUT") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    const deviceId = req.query.deviceId;
    if (!deviceId) {
      return res.status(400).json({ error: "Manjka query param: deviceId" });
    }

    try {
      const db = admin.firestore();
      const ref = db.collection("devices").doc(deviceId);
      const doc = await ref.get();

      if (!doc.exists || doc.data().userId !== user.uid) {
        return res.status(404).json({ error: "Naprava ni najdena" });
      }

      const { name, location, description, isActive, status } = req.body;
      const updateData = {
        lastUpdated: FieldValue.serverTimestamp(),
      };
      if (name !== undefined) updateData.name = name;
      if (location !== undefined) updateData.location = location;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (status !== undefined) updateData.status = status;

      await ref.update(updateData);

      return res.status(200).json({ message: "Naprava posodobljena" });
    } catch (error) {
      functions.logger.error("Napaka pri posodabljanju naprave:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// HTTP - Izbriši napravo (?deviceId=...)
exports.deleteDevice = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "DELETE") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    const deviceId = req.query.deviceId;
    if (!deviceId) {
      return res.status(400).json({ error: "Manjka query param: deviceId" });
    }

    try {
      const db = admin.firestore();
      const ref = db.collection("devices").doc(deviceId);
      const doc = await ref.get();

      if (!doc.exists || doc.data().userId !== user.uid) {
        return res.status(404).json({ error: "Naprava ni najdena" });
      }

      await ref.delete();

      return res.status(200).json({ message: "Naprava izbrisana" });
    } catch (error) {
      functions.logger.error("Napaka pri brisanju naprave:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// EVENT TIP: Podatkovne spremembe - Firestore Trigger
// Sproži se samodejno ob vsaki spremembi dokumenta naprave
exports.onDeviceStatusChanged = functions.firestore
  .document("devices/{deviceId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const deviceId = context.params.deviceId;

    // Reagiraj samo na spremembo statusa ali aktivnosti
    if (
      before.status === after.status &&
      before.isActive === after.isActive
    ) {
      return null;
    }

    const db = admin.firestore();

    await db.collection("logs").add({
      type: "DEVICE_STATUS_CHANGED",
      deviceId,
      deviceName: after.name,
      userId: after.userId,
      oldStatus: before.status,
      newStatus: after.status,
      timestamp: FieldValue.serverTimestamp(),
      message: `Naprava "${after.name}": ${before.status} → ${after.status}`,
    });

    // Ustvari opozorilo, če naprava šla offline
    if (before.status === "online" && after.status === "offline") {
      await db.collection("alerts").add({
        userId: after.userId,
        deviceId,
        deviceName: after.name,
        type: "DEVICE_OFFLINE",
        severity: "warning",
        message: `Naprava "${after.name}" je šla offline`,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      functions.logger.warn(
        `Naprava offline: ${after.name} (${deviceId})`
      );
    }

    // Ustvari obvestilo, če naprava prišla online
    if (before.status === "offline" && after.status === "online") {
      await db.collection("alerts").add({
        userId: after.userId,
        deviceId,
        deviceName: after.name,
        type: "DEVICE_ONLINE",
        severity: "info",
        message: `Naprava "${after.name}" je spet online`,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return null;
  });
