const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { amount } = req.body;
    const withdrawAmt = parseFloat(amount);

    if (supabaseUrl === 'https://your-project.supabase.co') {
        return res.json({ success: true, message: `Withdrew ₹${withdrawAmt.toFixed(2)} successfully! (MOCK)` });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, message: 'Please sign in first.' });
    }

    const supabaseAnon = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser();
    
    if (authErr || !user) {
        return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        if (isNaN(withdrawAmt) || withdrawAmt <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid withdrawal amount.' });
        }

        // Pass -withdrawAmt to properly deduct
        const { data, error } = await supabaseAdmin.rpc('process_wallet_transaction', {
            p_user_id: user.id,
            p_amount: -withdrawAmt,
            p_type: 'withdrawal',
            p_reference: 'User Withdrawal'
        });

        if (error) {
            if (error.message.includes('Insufficient funds')) {
                return res.status(400).json({ success: false, message: 'Insufficient funds.' });
            }
            throw error;
        }

        res.json({ success: true, message: `Withdrew ₹${withdrawAmt.toFixed(2)} successfully!` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
