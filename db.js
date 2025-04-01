const { MongoClient } = require('mongodb');

const url = 'mongodb+srv://wa_render:wa_render123@wasession.ldgdf2h.mongodb.net/?retryWrites=true&w=majority';
const dbName = 'sessionDB'; // You can name it whatever you like

let db;

const connectToDB = async () => {
    if (db) return db;

    const client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
    db = client.db(dbName);
    console.log('Connected to MongoDB Atlas');
    return db;
};

const getSessionCollection = async () => {
    const db = await connectToDB();
    return db.collection('sessions'); // 'sessions' is the collection where we'll store session data
};

module.exports = { getSessionCollection };
