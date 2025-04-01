const { MongoStore } = require('@whiskeysockets/baileys'); // Import MongoStore
const mongoose = require('mongoose');
const config = require('./config');

// MongoDB URI (Use your connection string)
const MONGO_URI = "mongodb+srv://wa_render:wa_render123@wasession.uikatku.mongodb.net/?retryWrites=true&w=majority&appName=wasession";

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB for session storage"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

async function useMongoAuthState() {
    // Create an instance of MongoStore
    const store = new MongoStore(mongoose.connection.db, 'whatsapp_sessions'); // Collection name
    
    // Retrieve the current state from MongoDB
    const state = await store.read(); // Read the stored session from MongoDB

    return {
        state, // Current session state
        saveCreds: async (creds) => store.write(creds) // Save session credentials back to MongoDB
    };
}

module.exports = { useMongoAuthState };
