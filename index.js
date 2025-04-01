const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const pino = require('pino');
const QRCode = require('qrcode');
const { MongoClient } = require('mongodb');
const { messageHandler } = require('./messageHandler');
const logger = require('./logger');
const config = require('./config');

const app = express();
const PORT = config.webPort || 3000;
app.use(express.json());

let sock;
let qrCodeData = null;

// MongoDB Connection
const mongoUrl = "mongodb+srv://wa_render:wa_render123@wasession.ldgdf2h.mongodb.net/?retryWrites=true&w=majority&appName=wasession";
const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });

async function startBot() {
    const { state, saveCreds } = await useMongoAuthState();

    sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: [config.botName, "Chrome", config.botVersion],
        getMessage: async () => undefined
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCodeData = await QRCode.toDataURL(qr);
            console.log("🔄 New QR Code Generated!");
        }

        if (connection === 'open') {
            console.log("✅ Bot Connected!");
            qrCodeData = null; // Clear QR code after successful login
        }

        if (connection === 'close') {
            if (lastDisconnect?.error instanceof Boom) {
                const reason = lastDisconnect.error.output.statusCode;
                console.log(`⚠️ Bot Disconnected: ${reason}`);
                if (reason !== DisconnectReason.loggedOut) {
                    console.log("🔄 Reconnecting...");
                    startBot();
                }
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const message of messages) {
            if (!message.key.fromMe) {
                await messageHandler(sock, message);
            }
        }
    });
}

// MongoDB-based session storage
async function useMongoAuthState() {
    await client.connect();
    const db = client.db('whatsapp_sessions');
    const collection = db.collection('sessions');

    const credentials = await collection.findOne({ botName: config.botName });

    if (!credentials) {
        const { state, saveCreds } = await useMultiFileAuthState('/tmp/sessions');
        await collection.insertOne({ botName: config.botName, state });
        return { state, saveCreds };
    }

    return {
        state: credentials.state,
        saveCreds: async (newCreds) => {
            await collection.updateOne({ botName: config.botName }, { $set: { state: newCreds } }, { upsert: true });
        }
    };
}

// Web Route to Show QR Code & Status
app.get('/status', async (req, res) => {
    let qrImg = qrCodeData
        ? `<img src="${qrCodeData}" width="200"/>`
        : "<p>No QR Code Available. Refresh if not visible.</p>";

    res.send(`
        <h1>${config.botName} Status</h1>
        <p>Connection: ${sock?.user ? "✅ Connected" : "❌ Disconnected"}</p>
        ${qrImg}
    `);
});

// Web Route to Send Messages
app.post('/send', async (req, res) => {
    const { number, message } = req.body;
    if (!number || !message) {
        return res.status(400).json({ error: 'Number and message are required' });
    }
    try {
        await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
        res.json({ success: true, message: 'Message sent' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message', details: error });
    }
});

// Start Express Server
app.listen(PORT, () => {
    logger.info(`🚀 Web interface running at http://localhost:${PORT}`);
});

// Start Bot
startBot();
