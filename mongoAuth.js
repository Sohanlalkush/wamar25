const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');
const config = require('./config');

// MongoDB connection URI
const MONGO_URI = "mongodb+srv://wa_render:wa_render123@wasession.uikatku.mongodb.net/?retryWrites=true&w=majority&appName=wasession";

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB for session storage"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Use Multi-File Auth State to store session in MongoDB
async function useMongoAuthState() {
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionsDir);  // Or you can use MongoStore here.
    
    // For storing credentials in MongoDB, you can write them to your MongoDB collection manually, if needed:
    const saveToMongoDB = (creds) => {
        // Store credentials in a MongoDB collection here if you need to manage sessions in your DB
        // Example:
        // mongoose.connection.db.collection('whatsapp_sessions').insertOne(creds);
    };
    
    return {
        state,
        saveCreds: (creds) => {
            saveToMongoDB(creds);  // Save credentials to MongoDB or any custom store
            saveCreds(creds);      // Additionally use the default saveCreds method for multi-file
        }
    };
}

module.exports = { useMongoAuthState };
