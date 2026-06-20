const express = require('express');
const serverless = require('serverless-http');

const app = express();
app.use(express.json());

// Helper to wrap Vercel (req, res) serverless functions into standard Express routes
const wrapVercelRoute = (vercelHandler) => async (req, res, next) => {
    try {
        await vercelHandler(req, res);
    } catch (err) {
        next(err);
    }
};

// Map all Vercel endpoints
app.all('/api/admin/dashboard-stats', wrapVercelRoute(require('../../api/admin/dashboard-stats')));
app.all('/api/admin/draw', wrapVercelRoute(require('../../api/admin/draw')));
app.all('/api/admin/user/adjust-balance', wrapVercelRoute(require('../../api/admin/user/adjust-balance')));
app.all('/api/auth/login', wrapVercelRoute(require('../../api/auth/login')));
app.all('/api/auth/register', wrapVercelRoute(require('../../api/auth/register')));
app.all('/api/auth/signout', wrapVercelRoute(require('../../api/auth/signout')));
app.all('/api/chat/send', wrapVercelRoute(require('../../api/chat/send')));
app.all('/api/tickets/buy', wrapVercelRoute(require('../../api/tickets/buy')));
app.all('/api/wallet/deposit', wrapVercelRoute(require('../../api/wallet/deposit')));
app.all('/api/wallet/withdraw', wrapVercelRoute(require('../../api/wallet/withdraw')));

// Fallback for missing routes
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found or mapped in Netlify functions' });
});

module.exports.handler = serverless(app);
