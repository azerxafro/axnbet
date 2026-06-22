const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { phone, amount } = req.body;
    const adjustValue = parseFloat(amount);

    

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
        if (isNaN(adjustValue)) {
            return res.status(400).json({ success: false, message: 'Invalid adjustment amount.' });
        }

        // Find user by phone to get their ID
        const { data: targetProfile } = await supabaseAdmin.from('profiles').select('id').eq('phone_number', phone).single();
        if (!targetProfile) {
            return res.status(404).json({ success: false, message: `User phone ${phone} not found.` });
        }

        const { data, error } = await supabaseAdmin.rpc('process_wallet_transaction', {
            p_user_id: targetProfile.id,
            p_amount: adjustValue,
            p_type: adjustValue > 0 ? 'deposit' : 'withdrawal',
            p_reference: 'Admin Adjustment'
        });

        if (error) {
            if (error.message.includes('Insufficient funds')) {
                return res.status(400).json({ success: false, message: 'Insufficient funds for deduction.' });
            }
            throw error;
        }

        res.json({ success: true, message: `Wallet balance successfully adjusted by ₹${adjustValue.toFixed(2)}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
