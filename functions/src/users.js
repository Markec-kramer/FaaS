// ============================================================
// UPRAVLJANJE UPORABNIKOV - User Management
// Dogodki: HTTP Events
// Funkcije: register, login, getUserProfile, updateUserProfile
// ============================================================

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");
const corsHandler = require("../utils/cors");
const { verifyToken } = require("../utils/authMiddleware");

// HTTP - Registracija novega uporabnika
// Ustvari Auth uporabnika; onUserRegistered trigger samodejno kreira Firestore profil
exports.register = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Obvezna polja: email, password" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Geslo mora imeti vsaj 6 znakov" });
    }

    try {
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: displayName || "",
      });

      return res.status(201).json({
        message: "Uporabnik uspešno registriran",
        uid: userRecord.uid,
        email: userRecord.email,
        note: "Za prijavo pokliči /login z email in password",
      });
    } catch (error) {
      if (error.code === "auth/email-already-exists") {
        return res.status(409).json({ error: "Email je že registriran" });
      }
      functions.logger.error("Napaka pri registraciji:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// HTTP - Prijava uporabnika (vrne idToken za Postman testiranje)
exports.login = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Obvezna polja: email, password" });
    }

    try {
      // Določi URL glede na okolje (emulator ali produkcija)
      const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
      const baseUrl = authEmulatorHost
        ? `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1`
        : `https://identitytoolkit.googleapis.com/v1`;
      const apiKey = authEmulatorHost
        ? "demo-key"
        : process.env.FIREBASE_API_KEY;

      const response = await axios.post(
        `${baseUrl}/accounts:signInWithPassword?key=${apiKey}`,
        { email, password, returnSecureToken: true }
      );

      const db = admin.firestore();
      await db.collection("logs").add({
        type: "USER_LOGIN",
        userId: response.data.localId,
        email: response.data.email,
        timestamp: FieldValue.serverTimestamp(),
        message: `Prijava: ${email}`,
      });

      return res.status(200).json({
        message: "Prijava uspešna",
        idToken: response.data.idToken,
        uid: response.data.localId,
        email: response.data.email,
        expiresIn: response.data.expiresIn,
        usage: "Uporabi idToken kot: Authorization: Bearer <idToken>",
      });
    } catch (error) {
      if (error.response) {
        const code = error.response.data?.error?.message;
        if (
          code === "EMAIL_NOT_FOUND" ||
          code === "INVALID_PASSWORD" ||
          code === "INVALID_LOGIN_CREDENTIALS"
        ) {
          return res
            .status(401)
            .json({ error: "Napačen email ali geslo" });
        }
      }
      const errMsg = error.response?.data || error.message || error;
      functions.logger.error("Napaka pri prijavi:", errMsg);
      return res.status(500).json({
        error: "Interna napaka strežnika",
        detail: JSON.stringify(errMsg),
        authHost: process.env.FIREBASE_AUTH_EMULATOR_HOST || "ni nastavljen",
      });
    }
  });
});

// HTTP - Pridobi profil prijavljenega uporabnika
exports.getUserProfile = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    try {
      const db = admin.firestore();
      const doc = await db.collection("users").doc(user.uid).get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Profil ni najden" });
      }

      return res.status(200).json({ user: doc.data() });
    } catch (error) {
      functions.logger.error("Napaka pri pridobivanju profila:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// HTTP - Posodobi profil uporabnika
exports.updateUserProfile = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "PUT") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    try {
      const { displayName, phoneNumber } = req.body;
      const db = admin.firestore();

      const updateData = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (displayName !== undefined) updateData.displayName = displayName;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

      await db.collection("users").doc(user.uid).update(updateData);

      if (displayName) {
        await admin.auth().updateUser(user.uid, { displayName });
      }

      await db.collection("logs").add({
        type: "USER_PROFILE_UPDATED",
        userId: user.uid,
        timestamp: FieldValue.serverTimestamp(),
        message: `Profil posodobljen: ${user.email}`,
      });

      return res.status(200).json({ message: "Profil uspešno posodobljen" });
    } catch (error) {
      functions.logger.error("Napaka pri posodabljanju profila:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// HTTP - Pridobi sistemske loge prijavljenega uporabnika
exports.getLogs = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    try {
      const { limit = 50 } = req.query;
      const db = admin.firestore();

      const snapshot = await db
        .collection("logs")
        .where("userId", "==", user.uid)
        .orderBy("timestamp", "desc")
        .limit(parseInt(limit))
        .get();

      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return res.status(200).json({ logs, count: logs.length });
    } catch (error) {
      functions.logger.error("Napaka pri pridobivanju logov:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});
