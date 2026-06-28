const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'database.json');

const defaultDb = {
    userSession: {
        isAuthenticated: false,
        phone: null,
        username: 'Guest_User',
        balance: 500.00
    },
    tickets: [],
    chats: [
        { username: 'Lottery_King', message: 'Got a 3D win on Dear Lottery 8PM today! 🎉', time: '10 mins ago' },
        { username: 'Rajesh_K', message: 'Is Dear 8PM result out yet?', time: '5 mins ago' },
        { username: 'Admin_Support', message: 'Welcome to bet999x! Live chat is open.', time: 'Just now' }
    ],
    drawResults: [
        { name: 'Dear Lottery 8PM', cycle: 307, numbers: '357', time: 'Yesterday, 8:00 PM' },
        { name: 'Dear Lottery 6PM', cycle: 306, numbers: '241', time: 'Yesterday, 6:00 PM' },
        { name: 'Kerala Lottery 3PM', cycle: 308, numbers: '902', time: 'Yesterday, 3:00 PM' }
    ],
    activeCycles: {
        'Dear Lottery 6PM': { name: 'Dear Lottery 6PM', price: 12, cycle: 307 },
        'Dear Lottery 8PM': { name: 'Dear Lottery 8PM', price: 12, cycle: 308 },
        'Kerala Lottery 3PM': { name: 'Kerala Lottery 3PM', price: 12, cycle: 309 }
    }
};

function readDb() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDb(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb };
