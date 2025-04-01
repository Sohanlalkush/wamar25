const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const fs = require('fs');
const pino = require('pino');
const QRCode = require('qrcode');
const { MongoClient } = require('mongodb');  // Import MongoDB Client
const { messageHandler } = require('./messageHandler');
const logger = require('./logger');
const config = require('./config');

const app = express();
const PORT = config.webPort || 3000;
app.use(express.json());

let sock;
let qrCodeData = null;
let messageLog = [];

// MongoDB Atlas Connection URL and Database/Collection
const mongoUrl = "mongodb+srv://wa_render:wa_render123@wasession.ldgdf2h.mongodb.net/?retryWrites=true&w=majority&appName=wasession";  // MongoDB Atlas URI
const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });

async function startBot() {
    const { state, saveCreds } = await useMongoAuthState();
    
    const baileysLogger = pino({ level: 'silent' });
    
    sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: baileysLogger,
        browser: [config.botName, "Chrome", config.botVersion],
        getMessage: async () => undefined
    });
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeData = await QRCode.toDataURL(qr);
        }
        
        if (connection === 'close') {
            if (lastDisconnect.error instanceof Boom && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut) {
                startBot();
            }
        }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const message of messages) {
            if (!message.key.fromMe) {
                messageLog.push({ direction: 'incoming', message });
                await messageHandler(sock, message);
            }
        }
    });
    
    sock.ev.on('messages.update', (updates) => {
        updates.forEach(update => {
            messageLog.push({ direction: 'outgoing', update });
        });
    });
}

// MongoDB-based authentication state storage
async function useMongoAuthState() {
    try {
        await client.connect();
        const db = client.db('whatsapp_sessions');  // The database name for sessions
        const collection = db.collection('sessions');  // The collection name for session data
        
        // Load credentials from MongoDB
        const credentials = await collection.findOne({ botName: config.botName });

        // If no credentials found, initialize the session
        if (!credentials) {
            const { state, saveCreds } = await useMultiFileAuthState('/tmp/sessions');  // Temporary local file for the first time setup
            await collection.insertOne({ botName: config.botName, state });
            return { state, saveCreds };
        }

        // If credentials exist, return them
        return {
            state: credentials.state,
            saveCreds: async (newCreds) => {
                // Update session in MongoDB
                await collection.updateOne({ botName: config.botName }, { $set: { state: newCreds } }, { upsert: true });
            }
        };
    } catch (error) {
        logger.error('Error in MongoDB connection or session retrieval:', error);
        throw new Error('Unable to retrieve session state from MongoDB');
    }
}

// MongoDB disconnection on app shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down the bot and closing MongoDB connection...');
    await client.close();
    process.exit();
});

// Web Route to Show Status and QR Code
app.get('/status', (req, res) => {
    res.send(`<h1>${config.botName} Status</h1>
        <p>Connection: ${sock?.user ? "Connected" : "Disconnected"}</p>
        ${qrCodeData ? `<img src='${qrCodeData}'/>` : '<p>No QR Code Available</p>'}`);
});

// Web Route to View Messages
app.get('/see', (req, res) => {
    res.json(messageLog);
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
    logger.info(`Web interface running at http://localhost:${PORT}`);
});

// Start Bot
startBot();
