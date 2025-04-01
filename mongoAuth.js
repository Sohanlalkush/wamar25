const { MongoClient } = require('mongodb');
const { useSingleFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const config = require('./config');

async function useMongoAuthState() {
    if (!config.mongo.enabled) {
        throw new Error("MongoDB session storage is disabled in config.");
    }

    const client = new MongoClient(config.mongo.uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    const db = client.db(config.mongo.dbName);
    const collection = db.collection(config.mongo.collectionName);

    async function readData() {
        const session = await collection.findOne({ _id: 'auth' });
        return session ? session.data : {};
    }

    async function writeData(data) {
        await collection.updateOne({ _id: 'auth' }, { $set: { data } }, { upsert: true });
    }

    // Temporary file-based session until MongoDB session is loaded
    const tempFilePath = './tempAuth.json';
    if (!fs.existsSync(tempFilePath)) fs.writeFileSync(tempFilePath, JSON.stringify(await readData()));

    const { state, saveState } = await useSingleFileAuthState(tempFilePath);

    return {
        state,
        saveCreds: async () => {
            await saveState();
            const sessionData = JSON.parse(fs.readFileSync(tempFilePath));
            await writeData(sessionData);
        },
    };
}

module.exports = { useMongoAuthState };
