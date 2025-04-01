const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const pino = require('pino');
const QRCode = require('qrcode');
const { messageHandler } = require('./messageHandler');
const logger = require('./logger');
const config = require('./config');
const { useMongoAuthState } = require('./mongoAuth'); // Custom MongoDB auth

const app = express();
const PORT = config.webPort || 3000;
app.use(express.json());

let sock;
let qrCodeData = null;
let messageLog = [];
let userState = {}; // Store user state for session tracking

async function startBot() {
    const { state, saveCreds } = await useMongoAuthState();  // Use MongoDB for Auth

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

    sock.ev.on('creds.update', saveCreds); // Save credentials to MongoDB

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const message of messages) {
            if (!message.key.fromMe) {
                messageLog.push({ direction: 'incoming', message });

                const sender = message.key.remoteJid;
                const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

                if (!text) return; // Ignore empty messages

                // Auto-reply logic
                await handleAutoReply(sender, text);
            }
        }
    });

    sock.ev.on('messages.update', (updates) => {
        updates.forEach(update => {
            messageLog.push({ direction: 'outgoing', update });
        });
    });
}

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

// Auto-Reply Handler Function
async function handleAutoReply(sender, text) {
    const menu = `*Welcome to Pharmalite!* 👋\n\nPlease select a service by typing the corresponding number:\n
1️⃣ E-learning  
2️⃣ Blog  
3️⃣ Pharma Jobs  
4️⃣ Pharmalite AI  
5️⃣ GPAT Help (Sponsored)  
6️⃣ YouTube  
7️⃣ Social Media  

Type *0* to go back to this menu.`;

    // Track user session state
    if (!userState[sender]) {
        await sock.sendMessage(sender, { text: menu });
        userState[sender] = 'awaitingResponse';
        return;
    }

    switch (text.toLowerCase().trim()) {
        case '1':
        case '1️⃣ e-learning':
            await sock.sendMessage(sender, { text: '*Pharmalite E-learning:*\n📚 Explore B Pharma resources:\n\n' +
                '- *Books*: https://www.pharmalite.in/p/b-pharma-books.html\n' +
                '- *Video Lectures*: https://www.pharmalite.in/p/select-sem.html?fn=video-lecture\n' +
                '- *Syllabus*: https://www.pharmalite.in/p/select-sem.html?fn=syllabus\n\nType *0* to go back to the menu.' });
            break;
        case '2':
        case '2️⃣ blog':
            await sock.sendMessage(sender, { text: '*Pharmalite Blog:*\n📖 Stay updated with pharma insights:\n' +
                '- *Read Here*: https://blog.pharmalite.in\n\nType *0* to go back to the menu.' });
            break;
        case '3':
        case '3️⃣ pharma jobs':
            await sock.sendMessage(sender, { text: '*Pharma Jobs:*\n🔎 Find pharma job opportunities:\n' +
                '- *Browse Jobs*: https://jobs.pharmalite.in\n\nType *0* to go back to the menu.' });
            break;
        case '4':
        case '4️⃣ pharmalite ai':
            await sock.sendMessage(sender, { text: '*Pharmalite AI:*\n🤖 AI-powered learning & career support:\n' +
                '- *Try Now*: https://ai.pharmalite.in\n\nType *0* to go back to the menu.' });
            break;
        case '5':
        case '5️⃣ gpat help (sponsored)':
            await sock.sendMessage(sender, { text: '*GPAT Help (Sponsored):*\n📚 GPAT study materials & guidance:\n' +
                '- *Join Now*: https://t.me/blackApps_bot\n\nType *0* to go back to the menu.' });
            break;
        case '6':
        case '6️⃣ youtube':
            await sock.sendMessage(sender, { text: '*Pharmalite YouTube:*\n🎥 Watch pharma education videos:\n' +
                '- *Watch Here*: https://youtube.com/@pharmalite\n\nType *0* to go back to the menu.' });
            break;
        case '7':
        case '7️⃣ social media':
            await sock.sendMessage(sender, { text: '*Pharmalite Social Media:*\n📲 Stay connected with us:\n\n' +
                '- *Instagram*: https://instagram.com/pharmalite.in/\n' +
                '- *LinkedIn*: https://www.linkedin.com/company/pharmalite-in\n' +
                '- *Twitter*: https://twitter.com/pharmalite_in\n' +
                '- *Facebook*: https://facebook.com/pharmalite.in/\n' +
                '- *WhatsApp Channel*: https://whatsapp.com/channel/0029Vaehs87AzNc3KC94uT3d\n' +
                '- *Telegram*: https://PharmaLite.t.me/\n\nType *0* to go back to the menu.' });
            break;
        case '0':
            userState[sender] = 'awaitingResponse';
            await sock.sendMessage(sender, { text: menu });
            break;
        default:
            await sock.sendMessage(sender, { text: '❌ Invalid option. Please choose from the menu or type *0* to return to the main menu.' });
            break;
    }
}
