const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { phone, amount } = req.body;
    const adjustValue = parseFloat(amount);

    if (supabaseUrl === 'https://your-project.supabase.co') {
        return res.json({ success: true, message: `Wallet balance adjusted (MOCK)` });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, message: 'Please sign in as admin.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAnon = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser();
    if (authErr || !user) return res.status(401).json({ success: false, message: 'Invalid session' });

    const { data: adminProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (adminProfile?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    try {
        // Find user by phone
        const { data: targetProfile } = await supabaseAdmin.from('profiles').select('id, balance').eq('phone_number', phone).single();
        if (!targetProfile) {
            return res.status(404).json({ success: false, message: `User phone ${phone} not found.` });
        }

        const newBalance = parseFloat(targetProfile.balance) + adjustValue;

        // Update balance
        await supabaseAdmin.from('profiles').update({ balance: newBalance }).eq('id', targetProfile.id);

        // Ledger entry
        await supabaseAdmin.from('ledger_transactions').insert({
            user_id: targetProfile.id,
            type: adjustValue > 0 ? 'deposit' : 'withdrawal',
            amount: adjustValue,
            status: 'completed',
            reference_id: 'Admin Adjustment'
        });

        res.json({ success: true, message: `Wallet balance successfully adjusted by ₹${adjustValue.toFixed(2)}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
