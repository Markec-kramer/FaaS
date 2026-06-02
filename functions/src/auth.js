// ============================================================
// AVTENTIKACIJA - Auth Triggers (User Events)
// Dogodki: Firebase Auth spremembe (registracija, brisanje)
// ============================================================

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

// EVENT TIP: User Events - Auth Trigger
// Sproži se samodejno ob registraciji novega uporabnika
exports.onUserRegistered = functions.auth.user().onCreate(async (user) => {
  const db = admin.firestore();

  try {
    await db.collection("users").doc(user.uid).set({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || "",
      phoneNumber: user.phoneNumber || "",
      role: "user",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.collection("logs").add({
      type: "USER_REGISTERED",
      userId: user.uid,
      email: user.email,
      timestamp: FieldValue.serverTimestamp(),
      message: `Nov uporabnik registriran: ${user.email}`,
    });

    functions.logger.info(`Profil ustvarjen za: ${user.email}`);
  } catch (error) {
    functions.logger.error("Napaka pri ustvarjanju profila:", error);
  }
});

// EVENT TIP: User Events - Auth Trigger
// Sproži se samodejno ob izbrisu uporabnika
exports.onUserDeleted = functions.auth.user().onDelete(async (user) => {
  const db = admin.firestore();

  try {
    await db.collection("users").doc(user.uid).delete();

    // Izbriši vse naprave tega uporabnika
    const devicesSnapshot = await db
      .collection("devices")
      .where("userId", "==", user.uid)
      .get();

    const batch = db.batch();
    devicesSnapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    await db.collection("logs").add({
      type: "USER_DELETED",
      userId: user.uid,
      email: user.email,
      deletedDevices: devicesSnapshot.size,
      timestamp: FieldValue.serverTimestamp(),
      message: `Uporabnik izbrisan: ${user.email}`,
    });

    functions.logger.info(`Profil in naprave izbrisani za: ${user.email}`);
  } catch (error) {
    functions.logger.error("Napaka pri brisanju profila:", error);
  }
});
