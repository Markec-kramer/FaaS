// ============================================================
// AVTOMATIZACIJA - Automation Rules
// Dogodki: HTTP Events + Časovni dogodki (Scheduled/Cron)
// Funkcije: createAutomationRule, getAutomationRules,
//           toggleAutomationRule, deleteAutomationRule,
//           checkAutomations (scheduled - vsako uro)
// ============================================================

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const corsHandler = require("../utils/cors");
const { verifyToken } = require("../utils/authMiddleware");

// HTTP - Ustvari novo pravilo avtomatizacije
exports.createAutomationRule = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    const {
      name,
      deviceId,
      conditionType,
      conditionOperator,
      conditionValue,
      actionType,
      actionValue,
    } = req.body;

    if (
      !name ||
      !deviceId ||
      !conditionType ||
      conditionValue === undefined ||
      !actionType
    ) {
      return res.status(400).json({
        error: "Manjkajo obvezna polja",
        required: ["name", "deviceId", "conditionType", "conditionValue", "actionType"],
        example: {
          name: "Visoka temperatura",
          deviceId: "abc123",
          conditionType: "temperature",
          conditionOperator: ">",
          conditionValue: 30,
          actionType: "create_alert",
          actionValue: "Temperatura je previsoka!",
        },
      });
    }

    const validOperators = [">", "<", ">=", "<=", "=="];
    const validActions = ["create_alert", "send_notification", "turn_off_device"];

    if (!validOperators.includes(conditionOperator || ">")) {
      return res.status(400).json({ error: "Neveljaven operator", validOperators });
    }
    if (!validActions.includes(actionType)) {
      return res.status(400).json({ error: "Neveljavna akcija", validActions });
    }

    try {
      const db = admin.firestore();

      // Preveri, da naprava obstaja in pripada temu uporabniku
      const deviceDoc = await db.collection("devices").doc(deviceId).get();
      if (!deviceDoc.exists || deviceDoc.data().userId !== user.uid) {
        return res.status(404).json({ error: "Naprava ni najdena" });
      }

      const ref = db.collection("automationRules").doc();

      await ref.set({
        id: ref.id,
        name,
        deviceId,
        deviceName: deviceDoc.data().name,
        userId: user.uid,
        condition: {
          type: conditionType,
          operator: conditionOperator || ">",
          value: parseFloat(conditionValue),
        },
        action: {
          type: actionType,
          value: actionValue || null,
        },
        isActive: true,
        triggerCount: 0,
        lastTriggered: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      return res
        .status(201)
        .json({ message: "Pravilo ustvarjeno", ruleId: ref.id });
    } catch (error) {
      functions.logger.error("Napaka pri ustvarjanju pravila:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// HTTP - Pridobi vsa pravila avtomatizacije
exports.getAutomationRules = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    try {
      const db = admin.firestore();
      const snapshot = await db
        .collection("automationRules")
        .where("userId", "==", user.uid)
        .orderBy("createdAt", "desc")
        .get();

      const rules = snapshot.docs.map((doc) => doc.data());

      return res.status(200).json({ rules, count: rules.length });
    } catch (error) {
      functions.logger.error("Napaka pri pridobivanju pravil:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// HTTP - Vklopi ali izklopi pravilo (?ruleId=...)
exports.toggleAutomationRule = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "PUT") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    const ruleId = req.query.ruleId;
    if (!ruleId) {
      return res.status(400).json({ error: "Manjka query param: ruleId" });
    }

    try {
      const db = admin.firestore();
      const ref = db.collection("automationRules").doc(ruleId);
      const doc = await ref.get();

      if (!doc.exists || doc.data().userId !== user.uid) {
        return res.status(404).json({ error: "Pravilo ni najdeno" });
      }

      const newStatus = !doc.data().isActive;
      await ref.update({ isActive: newStatus });

      return res.status(200).json({
        message: `Pravilo ${newStatus ? "aktivirano" : "deaktivirano"}`,
        isActive: newStatus,
      });
    } catch (error) {
      functions.logger.error("Napaka pri preklopu pravila:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// HTTP - Izbriši pravilo (?ruleId=...)
exports.deleteAutomationRule = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "DELETE") {
      return res.status(405).json({ error: "Metoda ni dovoljena" });
    }

    const user = await verifyToken(req, res);
    if (!user) return;

    const ruleId = req.query.ruleId;
    if (!ruleId) {
      return res.status(400).json({ error: "Manjka query param: ruleId" });
    }

    try {
      const db = admin.firestore();
      const ref = db.collection("automationRules").doc(ruleId);
      const doc = await ref.get();

      if (!doc.exists || doc.data().userId !== user.uid) {
        return res.status(404).json({ error: "Pravilo ni najdeno" });
      }

      await ref.delete();

      return res.status(200).json({ message: "Pravilo izbrisano" });
    } catch (error) {
      functions.logger.error("Napaka pri brisanju pravila:", error);
      return res.status(500).json({ error: "Interna napaka strežnika" });
    }
  });
});

// EVENT TIP: Časovni dogodki - Scheduled Function (Cron)
// Samodejno preverja vsa aktivna pravila vsako uro
exports.checkAutomations = functions.pubsub
  .schedule("every 1 hours")
  .timeZone("Europe/Ljubljana")
  .onRun(async () => {
    const db = admin.firestore();

    try {
      functions.logger.info("Zagon preverjanja avtomatizacijskih pravil...");

      const rulesSnapshot = await db
        .collection("automationRules")
        .where("isActive", "==", true)
        .get();

      functions.logger.info(
        `Aktivnih pravil: ${rulesSnapshot.size}`
      );

      let triggeredCount = 0;

      for (const ruleDoc of rulesSnapshot.docs) {
        const rule = ruleDoc.data();

        // Pridobi zadnjo meritev za to napravo in tip senzorja
        const latestDataSnapshot = await db
          .collection("sensorData")
          .where("deviceId", "==", rule.deviceId)
          .where("type", "==", rule.condition.type)
          .orderBy("timestamp", "desc")
          .limit(1)
          .get();

        if (latestDataSnapshot.empty) continue;

        const latestData = latestDataSnapshot.docs[0].data();
        const sensorValue = latestData.value;
        const threshold = rule.condition.value;

        // Evalvacija pogoja
        let conditionMet = false;
        switch (rule.condition.operator) {
          case ">":  conditionMet = sensorValue > threshold;  break;
          case "<":  conditionMet = sensorValue < threshold;  break;
          case ">=": conditionMet = sensorValue >= threshold; break;
          case "<=": conditionMet = sensorValue <= threshold; break;
          case "==": conditionMet = sensorValue === threshold; break;
        }

        if (!conditionMet) continue;

        functions.logger.info(
          `Pogoj izpolnjen: "${rule.name}" (${sensorValue} ${rule.condition.operator} ${threshold})`
        );

        // Izvedi akcijo
        if (rule.action.type === "create_alert") {
          await db.collection("alerts").add({
            userId: rule.userId,
            deviceId: rule.deviceId,
            deviceName: rule.deviceName,
            type: "AUTOMATION_TRIGGERED",
            severity: "warning",
            message:
              rule.action.value ||
              `Pravilo "${rule.name}": ${rule.condition.type} ${rule.condition.operator} ${threshold}`,
            ruleId: ruleDoc.id,
            ruleName: rule.name,
            isRead: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        if (rule.action.type === "turn_off_device") {
          await db.collection("devices").doc(rule.deviceId).update({
            isActive: false,
            lastUpdated: FieldValue.serverTimestamp(),
          });
        }

        // Posodobi statistiko pravila
        await ruleDoc.ref.update({
          triggerCount: FieldValue.increment(1),
          lastTriggered: FieldValue.serverTimestamp(),
        });

        triggeredCount++;
      }

      functions.logger.info(
        `Preverjanje končano. Sproženh pravil: ${triggeredCount}`
      );
    } catch (error) {
      functions.logger.error("Napaka pri preverjanju avtomatizacij:", error);
      throw error;
    }
  });
