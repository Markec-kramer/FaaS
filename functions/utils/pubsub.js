const { PubSub } = require("@google-cloud/pubsub");

let client;

function getClient() {
  if (!client) {
    client = new PubSub();
  }
  return client;
}

async function publishMessage(topicName, data, attributes = {}) {
  const pubsub = getClient();
  const topic = pubsub.topic(topicName);

  const stringAttributes = Object.fromEntries(
    Object.entries(attributes).map(([k, v]) => [k, String(v)])
  );

  return topic.publishMessage({
    data: Buffer.from(JSON.stringify(data)),
    attributes: stringAttributes,
  });
}

module.exports = { publishMessage };
