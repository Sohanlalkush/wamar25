const path = require('path');
const os = require('os');

const config = {
    owner: ['6287736854912'],
    botName: 'Baileys WhatsApp Bot',
    botVersion: '1.0.0',
    prefix: '!',
    
    // Paths
    sessionsDir: path.join(__dirname, 'sessions'),
    logsDir: path.join(__dirname, 'logs'),
    commandsDir: path.join(__dirname, 'commands'),
    uploadsDir: path.join(__dirname, 'uploads'),

    // MongoDB Configuration
    mongo: {
        enabled: true, // Enable MongoDB session storage
        uri: 'mongodb+srv://wa_render:wa_render123@wasession.uikatku.mongodb.net/?retryWrites=true&w=majority&appName=wasession',
        dbName: 'wasession',
        collectionName: 'sessions'
    },

    system: {
        logLevel: 'info',
        maxMemoryUsage: 80,
        cpuThrottle: 90,
        hostname: os.hostname(),
        platform: os.platform()
    }
};

config.ownerNumbers = config.owner.map(num => `${num}@s.whatsapp.net`);

module.exports = config;
