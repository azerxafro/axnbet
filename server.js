const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// GET /5d.html dynamic session injector
app.get('/5d.html', (req, res) => {
    try {
        let html = fs.readFileSync(path.join(__dirname, '5d.html'), 'utf8');
        const sessionScript = `<script>window.userSession = ${JSON.stringify(userSession)};</script>`;
        html = html.replace('<head>', '<head>\n      ' + sessionScript);
        res.send(html);
    } catch (err) {
        res.sendFile(path.join(__dirname, '5d.html'));
    }
});

// Serve static assets from the root directory
app.use(express.static(path.join(__dirname)));

// Mock Database State (in-memory)
let userSession = {
    isAuthenticated: false,
    phone: null,
    username: 'Guest_User',
    balance: 500.00, // Starts with ₹500 free demo balance
};

let tickets = [];
let chats = [
    { username: 'Lottery_King', message: 'Got a 3D win on Dear Lottery 8PM today! 🎉', time: '10 mins ago' },
    { username: 'Rajesh_K', message: 'Is Dear 8PM result out yet?', time: '5 mins ago' },
    { username: 'Admin_Support', message: 'Welcome to bet999x! Live chat is open.', time: 'Just now' }
];

// Draw Results State (Starts with historical data, appends live draws)
let drawResults = [
    { name: 'Dear Lottery 8PM', cycle: 307, numbers: '357', time: 'Yesterday, 8:00 PM' },
    { name: 'Dear Lottery 6PM', cycle: 306, numbers: '241', time: 'Yesterday, 6:00 PM' },
    { name: 'Kerala Lottery 3PM', cycle: 308, numbers: '902', time: 'Yesterday, 3:00 PM' }
];

// Active Cycle Tracking — keyed by lottery name for stable lookups
let activeCycles = {
    'Dear Lottery 6PM': { name: 'Dear Lottery 6PM', price: 12, cycle: 307 },
    'Dear Lottery 8PM': { name: 'Dear Lottery 8PM', price: 12, cycle: 308 },
    'Kerala Lottery 3PM': { name: 'Kerala Lottery 3PM', price: 12, cycle: 309 }
};

// --- Persistence Logic ---
const dbPath = path.join(__dirname, 'database.json');
if (fs.existsSync(dbPath)) {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (data.userSession) userSession = data.userSession;
        if (data.tickets) tickets = data.tickets;
        if (data.chats) chats = data.chats;
        if (data.drawResults) drawResults = data.drawResults;
        if (data.activeCycles) activeCycles = data.activeCycles;
    } catch (e) {
        console.error("Failed to load database.json:", e);
    }
}

function saveState() {
    fs.writeFileSync(dbPath, JSON.stringify({ userSession, tickets, chats, drawResults, activeCycles }, null, 2));
}

app.use((req, res, next) => {
    res.on('finish', () => {
        saveState();
    });
    next();
});
// -------------------------


// Helper to map cycle ID to Lottery details (scans all active cycles)
function getLotteryByCycle(cycle) {
    const cycleNum = parseInt(cycle);
    for (const key of Object.keys(activeCycles)) {
        if (activeCycles[key].cycle === cycleNum) {
            return activeCycles[key];
        }
    }
    return { name: 'bet999x Daily Lottery', price: 12, cycle: cycleNum };
}

// Helper to get all active cycle options for the admin dropdown
function getActiveCycleOptions() {
    return Object.values(activeCycles).map(c => 
        `<option value="${c.cycle}">${c.name} (Cycle #${c.cycle})</option>`
    ).join('');
}

// ========================================================
// PAGE ROUTING & FRAGMENT SERVICES (SPA Tab Integration)
// ========================================================

// 1. Lottery Spin / Login Tab Fragment
app.get('/user/game/lottery_spin', (req, res) => {
    if (!userSession.isAuthenticated) {
        return res.sendFile(path.join(__dirname, 'user', 'login-form', 'index.html'));
    }
    try {
        let html = fs.readFileSync(path.join(__dirname, 'user', 'game', 'lottery_spin.html'), 'utf8');
        const sessionScript = `<script>window.userSession = ${JSON.stringify(userSession)};</script>`;
        html = html.replace('<head>', '<head>\n      ' + sessionScript);
        res.send(html);
    } catch (err) {
        res.sendFile(path.join(__dirname, 'user', 'game', 'lottery_spin.html'));
    }
});

// GET /user/login-form Page Route
app.get('/user/login-form', (req, res) => {
    if (userSession.isAuthenticated) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'user', 'login-form', 'index.html'));
});

// GET /user/register-form Page Route
app.get('/user/register-form', (req, res) => {
    if (userSession.isAuthenticated) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'user', 'register-form', 'index.html'));
});

// POST /user/login-form Action Route
app.post('/user/login-form', (req, res) => {
    const { username, code, password } = req.body;
    
    if (username === 'admin' && password === '1234') {
        userSession.isAuthenticated = true;
        userSession.phone = '9876543210';
        userSession.username = 'admin';
        
        res.send(`
            <script>
                alert("Signed in successfully as ${userSession.username}!");
                window.location.href = '/';
            </script>
        `);
    } else {
        res.send(`
            <script>
                alert("Invalid credentials. Please use Demo Login (Username: admin, Password: 1234)");
                window.history.back();
            </script>
        `);
    }
});

// POST /user/register-form Action Route
app.post('/user/register-form', (req, res) => {
    const { mobile, password, referBy } = req.body;
    
    // Simulate register & login success
    userSession.isAuthenticated = true;
    userSession.phone = mobile || '9876543210';
    userSession.username = 'User_' + userSession.phone.substring(6);
    
    res.send(`
        <script>
            alert("Account registered and signed in successfully as ${userSession.username}!");
            window.location.href = '/';
        </script>
    `);
});

// POST /api/game/spin Wheel Bet Endpoint
app.post('/api/game/spin', (req, res) => {
    if (!userSession.isAuthenticated) {
        return res.status(401).json({ success: false, message: 'Please sign in first to play.' });
    }
    const cost = 50.00;
    if (userSession.balance < cost) {
        return res.status(400).json({ success: false, message: 'Insufficient balance. Cost per spin is ₹50.' });
    }
    
    userSession.balance -= cost;
    
    // Wheel segments (8 segments)
    // 0: ₹10, 1: ₹50, 2: ₹100, 3: ₹500, 4: ₹1000, 5: Try Again, 6: ₹25, 7: ₹75
    const prizes = [
        { index: 0, label: '₹10', value: 10.00 },
        { index: 1, label: '₹50', value: 50.00 },
        { index: 2, label: '₹100', value: 100.00 },
        { index: 3, label: '₹500', value: 500.00 },
        { index: 4, label: '₹1000', value: 1000.00 },
        { index: 5, label: 'Try Again', value: 0.00 },
        { index: 6, label: '₹25', value: 25.00 },
        { index: 7, label: '₹75', value: 75.00 }
    ];
    
    const winIndex = Math.floor(Math.random() * prizes.length);
    const win = prizes[winIndex];
    
    userSession.balance += win.value;
    
    res.json({
        success: true,
        prize: win,
        new_balance: userSession.balance
    });
});

// 2. Dynamic Results List Fragment
app.get('/user/results/index', (req, res) => {
    let resultsCardsHTML = drawResults.map(r => {
        const num1 = r.numbers.charAt(0) || '0';
        const num2 = r.numbers.charAt(1) || '0';
        const num3 = r.numbers.charAt(2) || '0';
        
        let colorClass = 'from-[#8C5BFF] to-[#4400B1]'; // Default Dear purple
        if (r.name.includes('Goa')) colorClass = 'from-[#00A8FF] to-[#0047EC]'; // Goa blue
        
        return `
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray/50 flex flex-col gap-2 mb-3">
                <div class="flex items-center justify-between border-b border-gray/30 pb-2">
                    <span class="font-extrabold text-base text-[#ffbe1a] tracking-wide">${r.name}</span>
                    <span class="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">Completed</span>
                </div>
                <div class="flex items-center justify-between mt-1">
                    <div>
                        <p class="text-xs text-gray-400">Cycle #${r.cycle}</p>
                        <p class="text-xs text-gray-400">Drawn: ${r.time}</p>
                    </div>
                    <div class="flex gap-1.5">
                        <span class="w-8 h-8 rounded-full bg-linear-to-b ${colorClass} text-white flex items-center justify-center font-black shadow-[0_0_12px_rgba(255,215,0,0.3)] border border-[rgba(255,215,0,0.3)]">${num1}</span>
                        <span class="w-8 h-8 rounded-full bg-linear-to-b ${colorClass} text-white flex items-center justify-center font-black shadow-[0_0_12px_rgba(255,215,0,0.3)] border border-[rgba(255,215,0,0.3)]">${num2}</span>
                        <span class="w-8 h-8 rounded-full bg-linear-to-b ${colorClass} text-white flex items-center justify-center font-black shadow-[0_0_12px_rgba(255,215,0,0.3)] border border-[rgba(255,215,0,0.3)]">${num3}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    res.send(`
        <div class="flex flex-col p-4 pb-20 w-full min-h-screen text-main bg-[#F6F9FF]">
            <div class="flex items-center justify-between mb-4 mt-2">
                <span class="text-xl font-extrabold text-[#ffbe1a] tracking-tight">Draw Results</span>
                <button onclick="loadTab('Result', '/user/results/index')" class="p-2 bg-white rounded-full shadow-sm text-amber-500">
                    <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12"/></svg>
                </button>
            </div>
            
            <div class="flex flex-col">
                ${resultsCardsHTML}
            </div>
        </div>
    `);
});

// 3. Dynamic Profile / Wallet Tab Fragment
app.get('/user/tofactor-dashboard-new', (req, res) => {
    if (!userSession.isAuthenticated) {
        return res.sendFile(path.join(__dirname, 'user', 'login-form', 'index.html'));
    }
    const userDisplayPhone = userSession.phone;
    const statusText = 'Verified';
    
    res.send(`
        <div class="flex flex-col p-5 pb-20 w-full min-h-screen text-main bg-[#F6F9FF] font-sans">
            <div class="w-full bg-gradient-to-br from-[#2c1a4d] via-[#1a0f30] to-[#0c0817] rounded-2xl p-5 text-white border border-amber-500/20 shadow-[0_0_20px_rgba(255,215,0,0.15)] flex flex-col gap-4 relative overflow-hidden mb-5">
                <div class="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl"></div>
                <div class="flex items-center gap-3">
                    <div class="size-12 bg-amber-500/20 text-[#ffbe1a] border border-amber-500/30 rounded-full flex items-center justify-center font-extrabold text-xl shadow-[0_0_10px_rgba(255,190,26,0.2)]">
                        👤
                    </div>
                    <div class="flex flex-col">
                        <span class="font-bold text-lg text-white">${userSession.username}</span>
                        <span class="text-xs text-gray-400">${userDisplayPhone} • <span class="text-green-400 font-bold">${statusText}</span></span>
                    </div>
                </div>
                
                <div class="flex justify-between items-end mt-2">
                    <div class="flex flex-col">
                        <span class="text-xs text-gray-400">Available Balance</span>
                        <span class="text-3xl font-black mt-1 text-[#ffbe1a] tracking-tight din">₹${userSession.balance.toFixed(2)}</span>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="handleDeposit()" class="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-600 text-black font-extrabold rounded-lg text-sm shadow-md active:scale-95 transition-all">Deposit</button>
                        <button onclick="handleWithdraw()" class="px-4 py-2 bg-white/10 text-white hover:bg-white/20 border border-white/20 font-bold rounded-lg text-sm active:scale-95 transition-all">Withdraw</button>
                    </div>
                </div>
            </div>

            <div class="flex flex-col gap-3">
                <div class="bg-white rounded-xl p-4 shadow-xs border border-gray/40 flex items-center justify-between cursor-pointer" onclick="loadTab('Tickets', '/user/mybets-3digit')">
                    <div class="flex items-center gap-3">
                        <span class="text-lg">🎟️</span>
                        <span class="font-semibold text-gray-700">My Betting Records</span>
                    </div>
                    <span class="text-gray-400">❯</span>
                </div>
                <div class="bg-white rounded-xl p-4 shadow-xs border border-gray/40 flex items-center justify-between cursor-pointer" onclick="alert('Transaction history is clean.')">
                    <div class="flex items-center gap-3">
                        <span class="text-lg">💳</span>
                        <span class="font-semibold text-gray-700">Transaction History</span>
                    </div>
                    <span class="text-gray-400">❯</span>
                </div>
                <div class="bg-white rounded-xl p-4 shadow-xs border border-gray/40 flex items-center justify-between cursor-pointer" onclick="handleSignOut()">
                    <div class="flex items-center gap-3">
                        <span class="text-lg">🚪</span>
                        <span class="font-semibold text-red-500">Sign Out / Reset Demo</span>
                    </div>
                    <span class="text-red-400">❯</span>
                </div>
            </div>
            
            <script>
                function handleDeposit() {
                    const selectedCode = localStorage.getItem('selectedCurrency') || 'INR';
                    const targetCurrency = (window.CURRENCIES && window.CURRENCIES[selectedCode]) ? window.CURRENCIES[selectedCode] : { symbol: '₹', rate: 1.0, name: 'INR' };
                    const rate = targetCurrency.rate;
                    const amount = prompt("Enter deposit amount (" + selectedCode + "):", (1000 * rate).toFixed(2));
                    if (amount && !isNaN(amount)) {
                        const amountInINR = parseFloat(amount) / rate;
                        fetch('/api/wallet/deposit', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ amount: amountInINR })
                        })
                        .then(res => res.json())
                        .then(data => {
                            alert(window.convertCurrencyText ? window.convertCurrencyText(data.message) : data.message);
                            loadTab('Me', '/user/tofactor-dashboard-new');
                        });
                    }
                }
                
                function handleWithdraw() {
                    const selectedCode = localStorage.getItem('selectedCurrency') || 'INR';
                    const targetCurrency = (window.CURRENCIES && window.CURRENCIES[selectedCode]) ? window.CURRENCIES[selectedCode] : { symbol: '₹', rate: 1.0, name: 'INR' };
                    const rate = targetCurrency.rate;
                    const amount = prompt("Enter withdrawal amount (" + selectedCode + "):");
                    if (amount && !isNaN(amount)) {
                        const amountInINR = parseFloat(amount) / rate;
                        fetch('/api/wallet/withdraw', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ amount: amountInINR })
                        })
                        .then(res => res.json())
                        .then(data => {
                            alert(window.convertCurrencyText ? window.convertCurrencyText(data.message) : data.message);
                            loadTab('Me', '/user/tofactor-dashboard-new');
                        });
                    }
                }

                function handleSignOut() {
                    fetch('/api/auth/signout', { method: 'POST' })
                    .then(res => res.json())
                    .then(data => {
                        alert(data.message);
                        window.location.reload();
                    });
                }
            </script>
        </div>
    `);
});

// 4. Live Chat Tab Fragment
app.get('/chat', (req, res) => {
    if (!userSession.isAuthenticated) {
        return res.sendFile(path.join(__dirname, 'user', 'login-form', 'index.html'));
    }
    let chatMessagesHTML = chats.map(c => `
        <div class="flex flex-col bg-[#24173d]/60 border border-[rgba(255,215,0,0.15)] backdrop-blur-md p-3 rounded-xl shadow-xs max-w-[85%] mb-2">
            <span class="text-xs text-amber-400 font-bold">${c.username}</span>
            <span class="text-sm mt-0.5 text-white">${c.message}</span>
            <span class="text-[10px] text-gray-400 text-right mt-1">${c.time}</span>
        </div>
    `).join('');

    res.send(`
        <div class="flex flex-col p-4 pb-20 w-full min-h-screen text-main bg-[#F6F9FF] font-sans">
            <div class="text-xl font-extrabold text-[#ffbe1a] mb-3">Live Discussion</div>
            
            <div id="chatMessages" class="flex-1 overflow-y-auto mb-4 p-2 flex flex-col items-start min-h-[300px] max-h-[450px]">
                ${chatMessagesHTML}
            </div>

            <form id="chatForm" class="flex gap-2">
                <input id="chatInput" type="text" placeholder="Type a message..." class="flex-1 px-4 py-3 rounded-full border border-gray bg-white outline-none" required />
                <button type="submit" class="px-5 py-3 rounded-full bg-primary text-white font-bold">Send</button>
            </form>

            <script>
                document.getElementById('chatForm').addEventListener('submit', function(e) {
                    e.preventDefault();
                    const input = document.getElementById('chatInput');
                    const msg = input.value.trim();
                    if (!msg) return;

                    fetch('/api/chat/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: msg })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            input.value = '';
                            if (window.loadTab) {
                                window.loadTab('Chat', '/chat');
                            } else {
                                window.location.reload();
                            }
                        } else {
                            alert(data.message);
                        }
                    });
                });
            </script>
        </div>
    `);
});

// ========================================================
// EXPLICIT PAGES (Deep Links / Redirects)
// ========================================================

// 1. Lottery Detail / Purchase Page
// 1. Lottery Detail / Purchase Page Renderer Helper
function renderDetailPage(req, res, name, cycle, price) {
    if (!userSession.isAuthenticated) {
        return res.redirect('/user/login-form');
    }
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${name} - Booking</title>
            <link rel="stylesheet" href="/dd.css">
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;900&display=swap" rel="stylesheet">
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            <script src="/currency.js"></script>
            <style>
                body {
                    font-family: 'Outfit', sans-serif !important;
                    background: radial-gradient(circle at top, #1c0e35 0%, #080512 100%) !important;
                    color: #e2dcfc !important;
                }
                .header-bar {
                    background: rgba(18, 10, 30, 0.9) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border-bottom: 1px solid rgba(255, 215, 0, 0.15) !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                }
                .casino-card {
                    background: rgba(28, 18, 48, 0.65) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(255, 215, 0, 0.15) !important;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), inset 0 0 10px rgba(140, 91, 255, 0.1) !important;
                    border-radius: 16px !important;
                }
                .amount-btn {
                    background: rgba(16, 9, 28, 0.6) !important;
                    border: 1px solid rgba(140, 91, 255, 0.3) !important;
                    color: #ffffff !important;
                    transition: all 0.2s ease-in-out !important;
                }
                .amount-btn:hover {
                    border-color: #ffbe1a !important;
                    box-shadow: 0 0 10px rgba(255, 190, 26, 0.3) !important;
                }
                .amount-btn.active-btn {
                    background: linear-gradient(135deg, #FFE27C 0%, #FFBE1A 30%, #D4AF37 70%, #AA7C11 100%) !important;
                    color: #0c0817 !important;
                    border-color: transparent !important;
                    box-shadow: 0 0 15px rgba(255, 190, 26, 0.5) !important;
                }
                .confirm-btn {
                    background: linear-gradient(135deg, #FFE27C 0%, #FFBE1A 30%, #D4AF37 70%, #AA7C11 100%) !important;
                    color: #0c0817 !important;
                    font-weight: 900 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                    box-shadow: 0 4px 15px rgba(255, 190, 26, 0.4) !important;
                    transition: all 0.2s ease-in-out !important;
                }
                .confirm-btn:hover {
                    transform: translateY(-2px) !important;
                    box-shadow: 0 6px 20px rgba(255, 190, 26, 0.6) !important;
                }
                .confirm-btn:active {
                    transform: translateY(1px) !important;
                }
                input[type="text"], input[type="number"], select {
                    background: rgba(16, 9, 28, 0.8) !important;
                    border: 1px solid rgba(140, 91, 255, 0.4) !important;
                    color: #ffffff !important;
                    border-radius: 10px !important;
                    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.6) !important;
                    outline: none !important;
                }
                input[type="text"]:focus, input[type="number"]:focus, select:focus {
                    border-color: #ffbe1a !important;
                    box-shadow: 0 0 10px rgba(255, 190, 26, 0.5), inset 0 2px 4px rgba(0,0,0,0.6) !important;
                }
            </style>
        </head>
        <body class="min-h-screen pb-10">
            <div class="flex items-center justify-between p-4 header-bar">
                <button onclick="window.location.href='/'" class="p-2 text-white font-bold">❮ Back</button>
                <h1 class="font-extrabold text-lg text-white">${name}</h1>
                <div class="flex items-center gap-2">
                    <select id="currencySelector" onchange="changeCurrency(this.value)" class="h-8 px-2 font-bold cursor-pointer">
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="CAD">CAD (C$)</option>
                        <option value="SGD">SGD (S$)</option>
                        <option value="AED">AED (AED)</option>
                    </select>
                    <span class="text-xs bg-amber-500/20 text-[#ffbe1a] border border-amber-500/30 px-3 py-1 rounded-full font-bold">Cycle #${cycle}</span>
                </div>
            </div>

            <div class="p-5 flex flex-col gap-5 max-w-md mx-auto">
                <div class="casino-card p-5 flex flex-col gap-3">
                    <span class="text-xs text-amber-400 font-bold uppercase tracking-wider">Balance & Limits</span>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-300">Your Wallet:</span>
                        <span class="font-extrabold text-lg text-[#ffbe1a]">₹${userSession.balance.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-300">Base Price:</span>
                        <span class="font-semibold text-white">₹${price.toFixed(2)}</span>
                    </div>
                </div>

                <div class="casino-card p-5 flex flex-col gap-4">
                    <label class="font-bold text-gray-200">Enter Your 3-Digit Guess:</label>
                    <input id="betNumbers" type="text" maxlength="3" placeholder="e.g. 579" class="w-full text-center text-3xl font-black p-3 tracking-widest outline-none" />
                    
                    <label class="font-bold text-gray-200 mt-2">Bet Amount (INR):</label>
                    <div class="grid grid-cols-5 gap-2">
                        <button onclick="selectAmount(10, event)" class="amount-btn p-2 text-sm rounded-lg font-bold transition-all">₹10</button>
                        <button onclick="selectAmount(50, event)" class="amount-btn p-2 text-sm rounded-lg font-bold transition-all">₹50</button>
                        <button onclick="selectAmount(100, event)" class="amount-btn active-btn p-2 text-sm rounded-lg font-bold transition-all">₹100</button>
                        <button onclick="selectAmount(500, event)" class="amount-btn p-2 text-sm rounded-lg font-bold transition-all">₹500</button>
                        <button onclick="selectAmount(1000, event)" class="amount-btn p-2 text-sm rounded-lg font-bold transition-all">₹1000</button>
                    </div>
                    <input id="customAmount" type="number" value="${price}" class="w-full text-center p-2 mt-2 font-bold" />
                </div>

                <button onclick="submitBet()" class="w-full py-4 rounded-xl confirm-btn shadow-lg active:scale-[0.98] transition-all">
                    Confirm Ticket Booking
                </button>
            </div>

            <script>
                let currentBetAmount = ${price};

                (function() {
                    const selectedCode = localStorage.getItem('selectedCurrency') || 'INR';
                    const rate = (window.CURRENCIES && window.CURRENCIES[selectedCode]) ? window.CURRENCIES[selectedCode].rate : 1.0;
                    document.getElementById('customAmount').value = (${price} * rate).toFixed(2);
                })();

                function selectAmount(val, e) {
                    currentBetAmount = val;
                    const selectedCode = localStorage.getItem('selectedCurrency') || 'INR';
                    const rate = (window.CURRENCIES && window.CURRENCIES[selectedCode]) ? window.CURRENCIES[selectedCode].rate : 1.0;
                    document.getElementById('customAmount').value = (val * rate).toFixed(2);
                    const btns = document.querySelectorAll('.amount-btn');
                    btns.forEach(b => {
                        b.classList.remove('active-btn');
                    });
                    if (e && e.target) {
                        e.target.classList.add('active-btn');
                    }
                }

                function submitBet() {
                    const numbers = document.getElementById('betNumbers').value.trim();
                    const amountInput = parseFloat(document.getElementById('customAmount').value);
                    
                    if (numbers.length !== 3 || isNaN(numbers)) {
                        Swal.fire('Error', 'Please enter a valid 3-digit number.', 'error');
                        return;
                    }
                    if (isNaN(amountInput) || amountInput <= 0) {
                        Swal.fire('Error', 'Please enter a valid bet amount.', 'error');
                        return;
                    }

                    const selectedCode = localStorage.getItem('selectedCurrency') || 'INR';
                    const rate = (window.CURRENCIES && window.CURRENCIES[selectedCode]) ? window.CURRENCIES[selectedCode].rate : 1.0;
                    const amountInINR = amountInput / rate;

                    fetch('/api/tickets/buy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            cycle_id: ${cycle},
                            numbers: numbers,
                            amount: amountInINR
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            Swal.fire({
                                title: 'Success!',
                                text: data.message,
                                icon: 'success'
                            }).then(() => {
                                window.location.href = '/user/mybets-3digit';
                            });
                        } else {
                            Swal.fire('Failed', data.message, 'error');
                        }
                    });
                }
            </script>
        </body>
        </html>
    `);
}

// Map explicit details page requests
app.get([
    '/user/lottery/details',
    '/user/tenone/lottery/details',
    '/user/twentyone/lottery/details',
    '/user/dubai/lottery/details'
], (req, res) => {
    const cycle = req.query.cycle || '268';
    const lottery = getLotteryByCycle(cycle);
    renderDetailPage(req, res, lottery.name, cycle, lottery.price);
});

// GET Quick3D Details Page
app.get('/user/game/quick_three_digits', (req, res) => {
    const cycle = req.query.cycle || '3';
    const pickName = req.query.pickName || 'Quick3D 3Min';
    renderDetailPage(req, res, pickName, cycle, 50.00);
});

// GET Run Guess Details Page
app.get('/user/game/run_guess', (req, res) => {
    if (!userSession.isAuthenticated) {
        return res.redirect('/user/login-form');
    }
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Run Guess - AXN</title>
            <link rel="stylesheet" href="/dd.css">
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            <script src="/currency.js"></script>
        </head>
        <body class="bg-[#F6F9FF] font-sans min-h-screen pb-10">
            <div class="flex items-center justify-between p-4 bg-white border-b border-gray/30 shadow-xs">
                <button onclick="window.location.href='/'" class="p-2 text-gray-600 font-bold">❮ Back</button>
                <h1 class="font-extrabold text-lg">Run Guess</h1>
                <div class="flex items-center gap-2">
                    <select id="currencySelector" onchange="changeCurrency(this.value)" class="bg-[#F2F4FF] text-main border border-none text-xs rounded-sm h-8 px-2 font-bold focus:outline-none shadow-sm cursor-pointer hover:bg-gray-200 transition-all">
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="CAD">CAD (C$)</option>
                        <option value="SGD">SGD (S$)</option>
                        <option value="AED">AED (AED)</option>
                    </select>
                    <span class="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">Cycle #88</span>
                </div>
            </div>

            <div class="p-5 flex flex-col gap-5 max-w-md mx-auto">
                <div class="bg-white rounded-2xl p-5 shadow-md flex flex-col gap-3">
                    <span class="text-xs text-gray-400 font-bold uppercase">Balance & Limits</span>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Your Wallet:</span>
                        <span class="font-extrabold text-lg text-primary">₹${userSession.balance.toFixed(2)}</span>
                    </div>
                </div>

                <div class="bg-white rounded-2xl p-5 shadow-md flex flex-col gap-4">
                    <label class="font-bold text-gray-700">Choose Your Guess:</label>
                    <div class="grid grid-cols-2 gap-4">
                        <button onclick="selectGuess('Odd', event)" class="guess-btn py-4 text-lg bg-gray-100 rounded-xl hover:bg-primary hover:text-white font-bold transition-all border border-gray/30">Odd</button>
                        <button onclick="selectGuess('Even', event)" class="guess-btn py-4 text-lg bg-gray-100 rounded-xl hover:bg-primary hover:text-white font-bold transition-all border border-gray/30">Even</button>
                    </div>
                    
                    <label class="font-bold text-gray-700 mt-2">Bet Amount (INR):</label>
                    <div class="grid grid-cols-5 gap-2">
                        <button onclick="selectAmount(10, event)" class="amount-btn p-2 text-sm bg-gray-100 rounded-lg hover:bg-primary hover:text-white font-bold transition-all">₹10</button>
                        <button onclick="selectAmount(50, event)" class="amount-btn p-2 text-sm bg-gray-100 rounded-lg hover:bg-primary hover:text-white font-bold transition-all">₹50</button>
                        <button onclick="selectAmount(100, event)" class="amount-btn p-2 text-sm bg-primary text-white rounded-lg font-bold transition-all">₹100</button>
                        <button onclick="selectAmount(500, event)" class="amount-btn p-2 text-sm bg-gray-100 rounded-lg hover:bg-primary hover:text-white font-bold transition-all">₹500</button>
                        <button onclick="selectAmount(1000, event)" class="amount-btn p-2 text-sm bg-gray-100 rounded-lg hover:bg-primary hover:text-white font-bold transition-all">₹1000</button>
                    </div>
                    <input id="customAmount" type="number" value="50" class="w-full text-center p-2 mt-2 border border-gray rounded-lg bg-gray-50 font-bold" />
                </div>

                <button onclick="submitBet()" class="w-full py-4 rounded-xl text-white font-extrabold text-lg bg-linear-to-r from-[#0984e3] to-[#00D4FF] shadow-lg active:scale-[0.98] transition-all">
                    Confirm Run Booking
                </button>
            </div>

            <script>
                let currentBetAmount = 50;
                let currentGuess = '';

                (function() {
                    const selectedCode = localStorage.getItem('selectedCurrency') || 'INR';
                    const rate = (window.CURRENCIES && window.CURRENCIES[selectedCode]) ? window.CURRENCIES[selectedCode].rate : 1.0;
                    document.getElementById('customAmount').value = (50 * rate).toFixed(2);
                })();

                function selectGuess(val, e) {
                    currentGuess = val;
                    const btns = document.querySelectorAll('.guess-btn');
                    btns.forEach(b => {
                        b.classList.remove('bg-primary', 'text-white');
                        b.classList.add('bg-gray-100');
                    });
                    if (e && e.target) {
                        e.target.classList.remove('bg-gray-100');
                        e.target.classList.add('bg-primary', 'text-white');
                    }
                }

                function selectAmount(val, e) {
                    currentBetAmount = val;
                    const selectedCode = localStorage.getItem('selectedCurrency') || 'INR';
                    const rate = (window.CURRENCIES && window.CURRENCIES[selectedCode]) ? window.CURRENCIES[selectedCode].rate : 1.0;
                    document.getElementById('customAmount').value = (val * rate).toFixed(2);
                    const btns = document.querySelectorAll('.amount-btn');
                    btns.forEach(b => {
                        b.classList.remove('bg-primary', 'text-white');
                        b.classList.add('bg-gray-100');
                    });
                    if (e && e.target) {
                        e.target.classList.remove('bg-gray-100');
                        e.target.classList.add('bg-primary', 'text-white');
                    }
                }

                function submitBet() {
                    if (!currentGuess) {
                        Swal.fire('Error', 'Please select Odd or Even.', 'error');
                        return;
                    }
                    const amountInput = parseFloat(document.getElementById('customAmount').value);
                    if (isNaN(amountInput) || amountInput <= 0) {
                        Swal.fire('Error', 'Please enter a valid bet amount.', 'error');
                        return;
                    }

                    const selectedCode = localStorage.getItem('selectedCurrency') || 'INR';
                    const rate = (window.CURRENCIES && window.CURRENCIES[selectedCode]) ? window.CURRENCIES[selectedCode].rate : 1.0;
                    const amountInINR = amountInput / rate;

                    fetch('/api/tickets/buy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            cycle_id: 88,
                            numbers: currentGuess,
                            amount: amountInINR
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            Swal.fire({
                                title: 'Success!',
                                text: data.message,
                                icon: 'success'
                            }).then(() => {
                                window.location.href = '/user/mybets-3digit';
                            });
                        } else {
                            Swal.fire('Failed', data.message, 'error');
                        }
                    });
                }
            </script>
        </body>
        </html>
    `);
});

// 2. Ticket booking list / mybets page
app.get('/user/mybets-3digit', (req, res) => {
    if (!userSession.isAuthenticated) {
        return res.sendFile(path.join(__dirname, 'user', 'login-form', 'index.html'));
    }
    let ticketsHTML = tickets.length === 0 
        ? `<div class="text-center text-gray-400 py-12 px-4 border border-dashed border-gray-300 rounded-xl bg-white mt-10">No bets placed yet. Go book some tickets!</div>`
        : tickets.map(t => {
            let statusBadge = `<span class="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full capitalize">${t.status}</span>`;
            if (t.status === 'win') {
                statusBadge = `<span class="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full capitalize">Won (₹${(t.amount * 90).toFixed(2)}) 🏆</span>`;
            } else if (t.status === 'lose') {
                statusBadge = `<span class="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full capitalize">No Match</span>`;
            }

            return `
                <div class="bg-white rounded-xl p-4 border border-gray/50 shadow-xs flex flex-col gap-1.5 mb-3">
                    <div class="flex justify-between items-center border-b border-gray/30 pb-2">
                        <span class="font-bold text-gray-800">${t.lotteryName}</span>
                        ${statusBadge}
                    </div>
                    <div class="flex justify-between text-sm text-gray-600 mt-1">
                        <span>Selected Numbers: <strong class="text-gray-900">${t.numbers}</strong></span>
                        <span>Amount: <strong class="text-gray-900">₹${t.amount.toFixed(2)}</strong></span>
                    </div>
                    <div class="text-[10px] text-gray-400 mt-1 flex justify-between">
                        <span>Booked at: ${t.date}</span>
                        <span>Cycle #${t.cycle}</span>
                    </div>
                </div>
            `;
        }).join('');

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>My Bets</title>
            <link rel="stylesheet" href="/dd.css">
        </head>
        <body class="bg-[#F6F9FF] min-h-screen pb-10">
            <div class="flex items-center justify-between p-4 bg-white border-b border-gray/30 shadow-xs">
                <button onclick="window.location.href='/'" class="p-2 text-gray-600 font-bold">❮ Home</button>
                <h1 class="font-extrabold text-lg">My Betting Records</h1>
                <span class="size-6 opacity-0"></span>
            </div>

            <div class="p-4 flex flex-col max-w-md mx-auto">
                ${ticketsHTML}
            </div>
        </body>
        </html>
    `);
});

// ========================================================
// ADMIN INTERFACES (Dashboard & Controllers)
// ========================================================

// Admin Dashboard UI Page
app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>bet999x Admin Dashboard</title>
            <link rel="stylesheet" href="/dd.css">
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            <style>
                .stats-card {
                    background: white;
                    border: 1px solid rgba(0,0,0,0.08);
                    border-radius: 16px;
                    padding: 20px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
                }
            </style>
        </head>
        <body class="bg-[#F3F7FA] font-sans pb-10 min-h-screen">
            <!-- Header bar -->
            <div class="bg-slate-900 text-white p-5 flex justify-between items-center shadow-md">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">⚙️</span>
                    <h1 class="text-xl font-black tracking-wide">bet999x ADMIN</h1>
                </div>
                <button onclick="window.location.href='/'" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-bold rounded-lg border border-slate-700">Client Panel ❯</button>
            </div>

            <div class="max-w-6xl mx-auto p-5 flex flex-col gap-6">
                <!-- Metrics Grid -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="stats-card">
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Users</span>
                        <h2 id="metricUsers" class="text-3xl font-black mt-2 text-slate-800">1</h2>
                    </div>
                    <div class="stats-card">
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Balances</span>
                        <h2 id="metricBalances" class="text-3xl font-black mt-2 text-primary">₹0.00</h2>
                    </div>
                    <div class="stats-card">
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Volume Bet</span>
                        <h2 id="metricVolume" class="text-3xl font-black mt-2 text-slate-800">₹0.00</h2>
                    </div>
                    <div class="stats-card">
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Tickets Booked</span>
                        <h2 id="metricTickets" class="text-3xl font-black mt-2 text-slate-800">0</h2>
                    </div>
                </div>

                <!-- Admin Action Sections -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Section 1: User Credit Control -->
                    <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4">
                        <h3 class="font-extrabold text-lg text-slate-800 flex items-center gap-2">💳 Adjust User Wallet</h3>
                        
                        <div class="flex flex-col gap-3 mt-2">
                            <label class="text-xs font-bold text-slate-500">Select User (Session User / Phone):</label>
                            <input id="adjustPhone" type="text" placeholder="e.g. 9876543210" class="p-3 border rounded-xl bg-slate-50 outline-none focus:border-primary" />
                            
                            <label class="text-xs font-bold text-slate-500">Amount (Use positive to add, negative to subtract):</label>
                            <input id="adjustAmount" type="number" placeholder="e.g. 5000" class="p-3 border rounded-xl bg-slate-50 outline-none focus:border-primary font-bold" />
                            
                            <button onclick="submitBalanceAdjustment()" class="py-3 bg-primary text-white font-extrabold rounded-xl shadow-md active:scale-98 transition-all mt-2">
                                Apply Wallet Adjustment
                            </button>
                        </div>
                    </div>

                    <!-- Section 2: Custom Lottery Draw Control -->
                    <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4">
                        <h3 class="font-extrabold text-lg text-slate-800 flex items-center gap-2">🎰 Force Draw Results</h3>
                        
                        <div class="flex flex-col gap-3 mt-2">
                            <label class="text-xs font-bold text-slate-500">Select Active Lottery Cycle:</label>
                            <select id="drawCycle" class="p-3 border rounded-xl bg-slate-50 outline-none focus:border-primary font-semibold">
                                ${getActiveCycleOptions()}
                            </select>

                            <label class="text-xs font-bold text-slate-500">Enter Winning Number (3-digits):</label>
                            <input id="drawNumber" type="text" maxlength="3" placeholder="e.g. 777" class="p-3 border rounded-xl bg-slate-50 outline-none focus:border-primary tracking-widest text-center text-xl font-black" />

                            <button onclick="triggerManualDraw()" class="py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl shadow-md active:scale-98 transition-all mt-2">
                                Execute Manual Draw & Settle Bets
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Ledger/Queue View -->
                <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4">
                    <h3 class="font-extrabold text-lg text-slate-800">🎟️ Live Tickets List</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="border-b border-slate-200 text-slate-400 text-xs font-bold uppercase">
                                    <th class="py-3 px-4">Ticket ID</th>
                                    <th class="py-3 px-4">User Details</th>
                                    <th class="py-3 px-4">Game</th>
                                    <th class="py-3 px-4">Numbers</th>
                                    <th class="py-3 px-4">Bet Amount</th>
                                    <th class="py-3 px-4">Status</th>
                                </tr>
                            </thead>
                            <tbody id="ticketsTableBody" class="text-sm text-slate-700">
                                <tr>
                                    <td colspan="6" class="text-center text-slate-400 py-6">No tickets recorded in system memory.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <script>
                // Fetch stats when dashboard page loads
                document.addEventListener('DOMContentLoaded', fetchDashboardStats);

                function fetchDashboardStats() {
                    fetch('/api/admin/dashboard-stats')
                        .then(res => res.json())
                        .then(data => {
                            document.getElementById('metricUsers').innerText = data.totalUsers;
                            document.getElementById('metricBalances').innerText = '₹' + data.totalBalance.toFixed(2);
                            document.getElementById('metricVolume').innerText = '₹' + data.totalBetsAmount.toFixed(2);
                            document.getElementById('metricTickets').innerText = data.totalTickets;

                            // Fill tickets table
                            const table = document.getElementById('ticketsTableBody');
                            if (data.recentTickets.length > 0) {
                                table.innerHTML = data.recentTickets.map(t => {
                                    let badgeColor = 'bg-yellow-100 text-yellow-700';
                                    if(t.status === 'win') badgeColor = 'bg-green-100 text-green-700';
                                    if(t.status === 'lose') badgeColor = 'bg-slate-100 text-slate-600';
                                    
                                    return \`
                                        <tr class="border-b border-slate-100 hover:bg-slate-50">
                                            <td class="py-3 px-4 font-bold">#\${t.id}</td>
                                            <td class="py-3 px-4">\${t.username || 'Demo User'}</td>
                                            <td class="py-3 px-4">\${t.lotteryName} (Cycle #\${t.cycle})</td>
                                            <td class="py-3 px-4 tracking-wider font-extrabold text-[#0984e3]">\${t.numbers}</td>
                                            <td class="py-3 px-4 font-semibold">₹\${t.amount.toFixed(2)}</td>
                                            <td class="py-3 px-4"><span class="px-2 py-0.5 text-xs font-bold rounded-full \${badgeColor}">\${t.status}</span></td>
                                        </tr>
                                    \`;
                                }).join('');
                            } else {
                                table.innerHTML = '<tr><td colspan="6" class="text-center text-slate-400 py-6">No tickets recorded in system memory.</td></tr>';
                            }
                        });
                }

                function submitBalanceAdjustment() {
                    const phone = document.getElementById('adjustPhone').value.trim();
                    const amount = parseFloat(document.getElementById('adjustAmount').value);

                    if (!amount || isNaN(amount)) {
                        Swal.fire('Error', 'Please enter a valid numeric amount.', 'error');
                        return;
                    }

                    fetch('/api/admin/user/adjust-balance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: phone, amount: amount })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            Swal.fire('Success', data.message, 'success').then(() => {
                                fetchDashboardStats();
                            });
                        } else {
                            Swal.fire('Failed', data.message, 'error');
                        }
                    });
                }

                function triggerManualDraw() {
                    const cycleId = document.getElementById('drawCycle').value;
                    const numbers = document.getElementById('drawNumber').value.trim();

                    if (numbers && (numbers.length !== 3 || isNaN(numbers))) {
                        Swal.fire('Error', 'Winning numbers must be exactly 3 digits.', 'error');
                        return;
                    }

                    fetch('/api/admin/draw', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cycle_id: cycleId, winning_numbers: numbers })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            Swal.fire({
                                title: 'Draw Succeeded!',
                                html: \`Winning Number: <strong>\${numbers || 'Random'}</strong><br>Winners: <strong>\${data.winners}</strong><br>Total Payout: <strong>₹\${data.total_payout.toFixed(2)}</strong>\`,
                                icon: 'success'
                            }).then(() => {
                                fetchDashboardStats();
                            });
                        } else {
                            Swal.fire('Failed', data.message, 'error');
                        }
                    });
                }
            </script>
        </body>
        </html>
    `);
});

// GET Endpoint for Dashboard stats
app.get('/api/admin/dashboard-stats', (req, res) => {
    const totalBetsAmount = tickets.reduce((sum, t) => sum + t.amount, 0);
    const dashboardStats = {
        totalUsers: userSession.isAuthenticated ? 1 : 0,
        totalBalance: userSession.balance,
        totalBetsAmount: totalBetsAmount,
        totalTickets: tickets.length,
        recentTickets: tickets.map(t => ({
            id: t.id,
            username: userSession.phone || 'Guest_User',
            lotteryName: t.lotteryName,
            cycle: t.cycle,
            numbers: t.numbers,
            amount: t.amount,
            status: t.status
        })),
        recentChats: chats
    };
    res.json(dashboardStats);
});

// POST Endpoint for Wallet Balances adjustments
app.post('/api/admin/user/adjust-balance', (req, res) => {
    const { phone, amount } = req.body;
    const value = parseFloat(amount);
    
    // In our single-session simulation, we check if the adjustment is targeted to the active user
    if (userSession.isAuthenticated && phone && phone !== userSession.phone) {
        return res.status(404).json({ success: false, message: `User phone ${phone} is not active in current session.` });
    }
    
    userSession.balance += value;
    res.json({
        success: true,
        message: `Wallet balance successfully adjusted by ₹${value.toFixed(2)}. New Balance: ₹${userSession.balance.toFixed(2)}`
    });
});

// ========================================================
// API BACKEND ENDPOINTS (Demo State Handlers)
// ========================================================

// Purchase Ticket Endpoint
app.post('/api/tickets/buy', (req, res) => {
    const { cycle_id, numbers, amount } = req.body;
    
    if (!userSession.isAuthenticated) {
        return res.status(401).json({ success: false, message: 'Please sign in first to book a ticket.' });
    }

    const totalCost = parseFloat(amount);
    if (userSession.balance < totalCost) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
    }

    // Deduct balance and register ticket
    userSession.balance -= totalCost;
    const lottery = getLotteryByCycle(cycle_id);
    const newTicket = {
        id: tickets.length + 1,
        lotteryName: lottery.name,
        cycle: cycle_id,
        numbers: numbers,
        amount: totalCost,
        status: 'pending',
        date: new Date().toLocaleString()
    };
    tickets.unshift(newTicket);

    res.json({
        success: true,
        message: `Successfully booked ticket for ${lottery.name} with numbers [${numbers}]!`,
        new_balance: userSession.balance
    });
});

// Mock 5D Game active cycle & history endpoint
app.get('/api/5d/draw', (req, res) => {
    const now = Date.now();
    const drawInterval = 120000;
    const nextDrawTimestamp = Math.ceil(now / drawInterval) * drawInterval;
    
    const activeDraw = {
        id: activeCycles['5D'].cycle,
        name: '5D',
        cycle_number: activeCycles['5D'].cycle,
        draw_time: new Date(nextDrawTimestamp).toISOString(),
        status: 'open'
    };

    const history = drawResults
        .filter(r => r.name === '5D')
        .map(r => ({
            cycle_number: r.cycle,
            winning_numbers: r.numbers,
            draw_time: r.time
        }));

    res.json({
        success: true,
        activeDraw,
        history
    });
});

// Mock 5D Game bet submission endpoint
app.post('/api/5d/bet', (req, res) => {
    const { cycle_id, bet_numbers, bet_amount, multiplier } = req.body;

    if (!userSession.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'Please sign in first to place a bet.' });
    }

    const pricePerTicket = parseFloat(bet_amount) || 10;
    const count = parseInt(multiplier) || 1;
    const totalCost = pricePerTicket * count;

    if (userSession.balance < totalCost) {
        return res.status(400).json({ success: false, error: 'Insufficient wallet balance.' });
    }

    userSession.balance -= totalCost;
    
    const newTicket = {
        id: tickets.length + 1,
        lotteryName: '5D',
        cycle: cycle_id,
        numbers: bet_numbers,
        amount: totalCost,
        status: 'pending',
        date: new Date().toLocaleString()
    };
    tickets.unshift(newTicket);

    res.json({
        success: true,
        message: 'Ticket purchased successfully (Local Simulation).',
        new_balance: userSession.balance
    });
});

// Verify / Login Form Endpoint
app.post('/user/lottery_spin.html', (req, res) => {
    const { username, code, password } = req.body;
    
    // Simulate login success
    userSession.isAuthenticated = true;
    userSession.phone = username || '9876543210';
    userSession.username = 'User_' + userSession.phone.substring(6);
    
    res.send(`
        <script>
            alert("Signed in successfully as ${userSession.username}!");
            window.location.href = '/';
        </script>
    `);
});

// OTP Request Simulator
app.post('/user/send-otp', (req, res) => {
    const { mobile } = req.body;
    console.log(`[Demo API] OTP request received for: ${mobile}. Generated code: 123456`);
    res.json({ success: true, message: 'OTP sent successfully! Use code 123456 for demo login.' });
});

// Device Token Registration Endpoint
app.post('/api/devicetoken', (req, res) => {
    res.json({ success: true, message: 'Device registered for push notifications.' });
});

// Provider Games list endpoint
app.get('/provider-games/:provider', (req, res) => {
    const provider = req.params.provider.toLowerCase();
    const filePath = path.join(__dirname, 'assets', 'provider-games', `${provider}.json`);
    
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return res.json(JSON.parse(data));
        } catch (err) {
            console.error(`Error reading cached provider file for ${provider}:`, err);
        }
    }
    
    res.json({ success: true, code: 0, msg: "Fallback", data: [] });
});

// Coupon Code Application Endpoint
app.post('/user/coupon-code', (req, res) => {
    if (!userSession.isAuthenticated) {
        return res.status(401).json({ success: false, msg: 'Please sign in first to apply coupons.' });
    }
    const { code } = req.body;
    const upperCode = (code || '').toUpperCase().trim();
    
    if (upperCode === 'WELCOME50') {
        const bonus = 50.00;
        userSession.balance += bonus;
        return res.json({
            success: true,
            msg: 'Coupon WELCOME50 applied successfully!',
            data: {
                discountType: 'percentage',
                discountValue: 10,
                discountGiven: bonus
            }
        });
    } else if (upperCode === 'AXN100' || upperCode === 'BET999X100') {
        const bonus = 100.00;
        userSession.balance += bonus;
        return res.json({
            success: true,
            msg: `Coupon ${upperCode} applied successfully!`,
            data: {
                discountType: 'fixed',
                discountValue: bonus,
                discountGiven: bonus
            }
        });
    } else {
        return res.json({ success: false, msg: 'Invalid or expired coupon code.' });
    }
});

// Daily Check-In Reward Claim Endpoint
app.post('/user/daily-reward/claim', (req, res) => {
    if (!userSession.isAuthenticated) {
        return res.status(401).json({ status: false, message: 'Please sign in first to claim daily rewards.' });
    }
    
    // Check if claimed already (demo resets, so we let them claim ₹5 demo coins)
    const rewardVal = 5.00;
    userSession.balance += rewardVal;
    
    res.json({
        status: true,
        type: 'amount',
        value: rewardVal.toFixed(2),
        message: `Successfully claimed daily reward of ₹${rewardVal.toFixed(2)}!`
    });
});

// Wallet Deposit simulator
app.post('/api/wallet/deposit', (req, res) => {
    const { amount } = req.body;
    if (amount > 0) {
        userSession.balance += amount;
        res.json({ success: true, message: `Deposited ₹${amount.toFixed(2)} successfully!` });
    } else {
        res.status(400).json({ success: false, message: 'Invalid amount.' });
    }
});

// Wallet Withdrawal simulator
app.post('/api/wallet/withdraw', (req, res) => {
    const { amount } = req.body;
    if (amount > 0 && userSession.balance >= amount) {
        userSession.balance -= amount;
        res.json({ success: true, message: `Withdrew ₹${amount.toFixed(2)} successfully!` });
    } else {
        res.status(400).json({ success: false, message: 'Insufficient funds or invalid amount.' });
    }
});

// Chat Send Message API
app.post('/api/chat/send', (req, res) => {
    const { message } = req.body;
    if (message) {
        chats.push({
            username: userSession.isAuthenticated ? userSession.username : 'Anonymous',
            message: message,
            time: 'Just now'
        });
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, message: 'Empty message.' });
    }
});

// Sign Out API
app.post('/api/auth/signout', (req, res) => {
    userSession.isAuthenticated = false;
    userSession.phone = null;
    userSession.username = 'Guest_User';
    userSession.balance = 500.00;
    res.json({ success: true, message: 'Reset session. Authenticate again!' });
});

// ========================================================
// SYSTEM DRAW ENGINE (Simulated Cron Worker)
// ========================================================
app.post('/api/admin/draw', (req, res) => {
    const { cycle_id, winning_numbers } = req.body;
    
    if (!cycle_id) {
        return res.status(400).json({ success: false, message: 'Cycle ID required.' });
    }

    const drawResult = executeDraw(cycle_id, winning_numbers);
    res.json({
        success: true,
        message: `Draw completed for cycle ${cycle_id}. Winning numbers: ${drawResult.winningNumbers}`,
        winners: drawResult.winnersCount,
        total_payout: drawResult.totalPayout
    });
});

function executeDraw(cycleId, specificNumbers = null) {
    const cycleStr = cycleId.toString();
    const lottery = getLotteryByCycle(cycleId);
    
    // 1. Determine Winning numbers
    let winningNumbers = specificNumbers;
    if (!winningNumbers) {
        if (lottery.name === '5D') {
            const generateNumber = () => Math.floor(Math.random() * 10);
            winningNumbers = [
                generateNumber(), generateNumber(), generateNumber(),
                generateNumber(), generateNumber()
            ].join(',');
        } else {
            winningNumbers = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        }
    }
    
    // 2. Scan tickets and calculate wins
    let winnersCount = 0;
    let totalPayout = 0;
    
    tickets.forEach(t => {
        if (t.cycle.toString() === cycleStr && t.status === 'pending') {
            if (lottery.name === 'Run Guess') {
                const drawVal = (parseInt(winningNumbers, 10) % 2 === 0) ? 'Even' : 'Odd';
                if (t.numbers === drawVal) {
                    t.status = 'win';
                    const payout = t.amount * 1.9;
                    userSession.balance += payout;
                    winnersCount++;
                    totalPayout += payout;
                } else {
                    t.status = 'lose';
                }
            } else if (lottery.name === '5D') {
                const betNums = t.numbers.split(',');
                const winNums = winningNumbers.split(',');
                let isWin = false;
                let multiplier = 90;
                
                if (betNums.length === 4) {
                    isWin = (t.numbers === winNums.slice(0, 4).join(','));
                    multiplier = 2000;
                } else if (betNums.length === 5) {
                    isWin = (t.numbers === winningNumbers);
                    multiplier = 15000;
                }
                
                if (isWin) {
                    t.status = 'win';
                    const payout = t.amount * multiplier;
                    userSession.balance += payout;
                    winnersCount++;
                    totalPayout += payout;
                } else {
                    t.status = 'lose';
                }
            } else {
                if (t.numbers === winningNumbers) {
                    t.status = 'win';
                    const payout = t.amount * 90; // 90x payout
                    userSession.balance += payout;
                    winnersCount++;
                    totalPayout += payout;
                } else {
                    t.status = 'lose';
                }
            }
        }
    });

    // 3. Save to results history
    drawResults.unshift({
        name: lottery.name,
        cycle: cycleId,
        numbers: winningNumbers,
        time: new Date().toLocaleTimeString()
    });

    console.log(`[Draw Engine] Drawn cycle #${cycleId} for ${lottery.name}. Winning number: [${winningNumbers}]. Winners: ${winnersCount}. Payout: ₹${totalPayout}`);

    // 4. Update the active cycle state (increment cycle for next rounds)
    // Find the lottery by name (stable key) and increment its cycle number
    if (activeCycles[lottery.name]) {
        activeCycles[lottery.name].cycle = parseInt(cycleId) + 1;
    }

    return { winningNumbers, winnersCount, totalPayout };
}

// Background Cron Scheduler (Runs a simulated draw every 2 minutes for testing)
setInterval(() => {
    const lotteryNames = Object.keys(activeCycles);
    const randomName = lotteryNames[Math.floor(Math.random() * lotteryNames.length)];
    const cycleInfo = activeCycles[randomName];
    
    console.log(`[Auto-Draw Worker] Triggering draw for ${cycleInfo.name} (Cycle #${cycleInfo.cycle})`);
    executeDraw(cycleInfo.cycle);
}, 120000); // 120,000 ms = 2 minutes


// ========================================================
// Wildcard Page Fallback: Serve index.html for undefined routes so clean page paths function
// ========================================================
app.get('*', (req, res) => {
    const normalizedPath = req.path.replace(/\/$/, "");
    if (normalizedPath === '/user/login-form') {
        return res.sendFile(path.join(__dirname, 'user', 'login-form', 'index.html'));
    }
    if (normalizedPath === '/user/register-form') {
        return res.sendFile(path.join(__dirname, 'user', 'register-form', 'index.html'));
    }

    try {
        let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
        const sessionScript = `<script>window.userSession = ${JSON.stringify(userSession)};</script>`;
        html = html.replace('<head>', '<head>\n      ' + sessionScript);
        res.send(html);
    } catch (err) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// Start the express server
app.listen(PORT, () => {
    console.log(`========================================================`);
    console.log(` bet999x Server is running on: http://localhost:${PORT}`);
    console.log(` Open this link in your browser to test the full site.`);
    console.log(`========================================================`);
});
