const { supabase } = require('../../lib/supabaseClient');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL === 'https://your-project.supabase.co') {
        return res.json({ success: true, message: 'Reset mock session. Authenticate again!' });
    }

    try {
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            await supabase.auth.signOut(token);
        }
        res.json({ success: true, message: 'Signed out successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
