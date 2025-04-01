const mongoose = require('mongoose');
const { MongoStore } = require('@whiskeysockets/baileys'); // Use Baileys MongoStore
const config = require('./config');

// Define MongoDB Connection URL
const MONGO_URI = "mongodb+srv://wa_render:wa_render123@wasession.uikatku.mongodb.net/?retryWrites=true&w=majority&appName=wasession";

// Define and Connect to MongoDB
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("✅ Connected to MongoDB for session storage"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

async function useMongoAuthState() {
    const store = new MongoStore(mongoose.connection.db, 'whatsapp_sessions'); // Collection name
    const state = await store.read(); // Load existing session

    return {
        state,
        saveCreds: store.write // Save session data
    };
}

module.exports = { useMongoAuthState };
