const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { cycle_id, numbers, amount } = req.body;
    
    

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, message: 'Please sign in first to book a ticket.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } }
    });

    try {
        const { data, error } = await supabase.rpc('buy_ticket', {
            p_cycle_id: parseInt(cycle_id),
            p_bet_numbers: numbers,
            p_bet_amount: parseFloat(amount),
            p_multiplier: 1
        });

        if (error) {
            return res.status(400).json({ success: false, message: error.message });
        }

        res.json({
            success: data.success,
            message: data.message,
            new_balance: data.new_balance
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
