// ============================================================
// SHRAMBA IN SLIKE - Storage & Camera Images
// Dogodki: Shramba in datoteke (Storage Trigger) + HTTP Events
// Funkcije: getUploadUrl, onImageUploaded, getCameraImages
// ============================================================

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const corsHandler = require("../utils/cors");
const { verifyToken } = require("../utils/authMiddleware");

// HTTP - Pridobi predpodpisani URL za nalaganje slike kamere
exports.getUploadUrl = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    const { deviceId, fileName } = req.body;

    if (!deviceId || !fileName) {
      return res
        .status(400)
        .json({ error: "Obvezna polja: deviceId, fileName" });
    }

    try {
      const db = admin.firestore();
      const deviceDoc = await db.collection("devices").doc(deviceId).get();

      if (!deviceDoc.exists || deviceDoc.data().userId !== user.uid) {
        return res.status(404).json({ error: "Naprava ni najdena" });
      }

      const bucket = admin.storage().bucket();
      const timestamp = Date.now();
      const filePath = `cameras/${user.uid}/${deviceId}/${timestamp}_${fileName}`;
      const file = bucket.file(filePath);

      const [uploadUrl] = await file.getSignedUrl({
        action: "write",
        expires: Date.now() + 15 * 60 * 1000,
        contentType: "image/jpeg",
      });

      return res.status(200).json({
        uploadUrl,
        filePath,
        expiresIn: "15 minut",
        usage: "Pošlji PUT request na uploadUrl z binarno sliko in Content-Type: image/jpeg",
      });
    } catch (error) {
      functions.logger.error("Napaka pri generiranju URL-ja:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// EVENT TIP: Shramba in datoteke - Storage Trigger
// Samodejno se sproži ob nalaganju katere koli datoteke v Firebase Storage
exports.onImageUploaded = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    const contentType = object.contentType;

    // Obdelaj samo slike kamer
    if (!filePath || !filePath.startsWith("cameras/")) return null;
    if (!contentType || !contentType.startsWith("image/")) return null;

    const db = admin.firestore();

    try {
      functions.logger.info(`Nova slika naložena: ${filePath}`);

      // Razčleni pot: cameras/{userId}/{deviceId}/{fileName}
      const pathParts = filePath.split("/");
      if (pathParts.length < 4) return null;

      const userId = pathParts[1];
      const deviceId = pathParts[2];
      const fileName = pathParts[3];

      // Pridobi podpisani URL za prenos
      const bucket = admin.storage().bucket();
      const file = bucket.file(filePath);
      const [downloadUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });

      // Shrani zapis o sliki v Firestore
      const imageRef = await db.collection("cameraImages").add({
        userId,
        deviceId,
        filePath,
        fileName,
        downloadUrl,
        contentType,
        size: parseInt(object.size) || 0,
        uploadedAt: FieldValue.serverTimestamp(),
        analyzed: false,
      });

      // Ustvari opozorilo za novo sliko (simulacija zaznave gibanja)
      await db.collection("alerts").add({
        userId,
        deviceId,
        type: "CAMERA_IMAGE_CAPTURED",
        severity: "info",
        message: `Nova slika posneta: ${fileName}`,
        imageId: imageRef.id,
        imageUrl: downloadUrl,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Slika procesirana: ${filePath}`);
      return null;
    } catch (error) {
      functions.logger.error("Napaka pri procesiranju slike:", error);
      return null;
    }
  });

// HTTP - Pridobi seznam slik kamer
exports.getCameraImages = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    try {
      const { deviceId, limit = 10 } = req.query;
      const db = admin.firestore();

      let query;

      if (deviceId) {
        query = db
          .collection("cameraImages")
          .where("userId", "==", user.uid)
          .where("deviceId", "==", deviceId)
          .orderBy("uploadedAt", "desc")
          .limit(parseInt(limit));
      } else {
        query = db
          .collection("cameraImages")
          .where("userId", "==", user.uid)
          .orderBy("uploadedAt", "desc")
          .limit(parseInt(limit));
      }

      const snapshot = await query.get();
      const images = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return res.status(200).json({ images, count: images.length });
    } catch (error) {
      functions.logger.error("Napaka pri pridobivanju slik:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});
