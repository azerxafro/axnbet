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
        const { data: profile } = await supabaseAdmin.from('profiles').select('balance').eq('id', user.id).single();
        
        if (parseFloat(profile.balance) < withdrawAmt) {
            return res.status(400).json({ success: false, message: 'Insufficient funds.' });
        }

        const newBalance = parseFloat(profile.balance) - withdrawAmt;

        const { error: updateErr } = await supabaseAdmin.from('profiles').update({ balance: newBalance }).eq('id', user.id);
        
        if (updateErr) throw updateErr;

        await supabaseAdmin.from('ledger_transactions').insert({
            user_id: user.id,
            type: 'withdrawal',
            amount: -withdrawAmt,
            status: 'completed',
            reference_id: 'User Withdrawal'
        });

        res.json({ success: true, message: `Withdrew ₹${withdrawAmt.toFixed(2)} successfully!` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
