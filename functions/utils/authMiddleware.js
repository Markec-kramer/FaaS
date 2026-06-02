const admin = require("firebase-admin");

async function verifyToken(req, res) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Manjka Authorization header. Uporabi: Bearer <idToken>",
    });
    return null;
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Neveljaven ali potekel žeton",
      detail: error.message,
      authEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST || "NI NASTAVLJEN",
    });
    return null;
  }
}

module.exports = { verifyToken };
