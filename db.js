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
        { username: 'Lottery_King', message: 'Got a 3D win on Goa King today! 🎉', time: '10 mins ago' },
        { username: 'Rajesh_K', message: 'Is Dear 8PM result out yet?', time: '5 mins ago' },
        { username: 'Admin_Support', message: 'Welcome to AXN Agency! Live chat is open.', time: 'Just now' }
    ],
    drawResults: [
        { name: '5D', cycle: 1000, numbers: '2,4,1,7,8', time: 'Yesterday, 8:15 PM' },
        { name: 'Dear Lottery 8PM', cycle: 267, numbers: '357', time: 'Yesterday, 8:00 PM' },
        { name: 'Goa King Lottery', cycle: 270, numbers: '902', time: 'Yesterday, 7:00 PM' },
        { name: 'Dubai 3Digit Lottery', cycle: 59, numbers: '148', time: 'Yesterday, 6:00 PM' }
    ],
    activeCycles: {
        'Dear Lottery 8PM': { name: 'Dear Lottery 8PM', price: 100, cycle: 268 },
        'Goa King Lottery': { name: 'Goa King Lottery', price: 150, cycle: 271 },
        'Dear Lottery 6PM': { name: 'Dear Lottery 6PM', price: 100, cycle: 272 },
        'Dubai 3Digit Lottery': { name: 'Dubai 3Digit Lottery', price: 200, cycle: 60 },
        'Quick3D 3Min': { name: 'Quick3D 3Min', price: 50, cycle: 3 },
        'Quick3D 5Min': { name: 'Quick3D 5Min', price: 50, cycle: 5 },
        'Run Guess': { name: 'Run Guess', price: 50, cycle: 88 },
        '5D': { name: '5D', price: 10, cycle: 1001 }
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
