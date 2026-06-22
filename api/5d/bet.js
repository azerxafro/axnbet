const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service key needed to update balances via RPC
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

        const { cycle_id, bet_numbers, bet_amount, multiplier } = req.body;

        if (!cycle_id || !bet_numbers || !bet_amount) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Use the buy_ticket RPC to ensure transaction safety
        const { data: result, error: rpcError } = await supabase.rpc('buy_ticket', {
            p_cycle_id: parseInt(cycle_id),
            p_bet_numbers: bet_numbers,
            p_bet_amount: parseFloat(bet_amount),
            p_multiplier: parseInt(multiplier) || 1
        });

        if (rpcError) throw rpcError;

        if (!result.success) {
            return res.status(400).json({ success: false, error: result.message });
        }

        return res.status(200).json({ success: true, message: result.message, new_balance: result.new_balance });
    } catch (error) {
        console.error('Error placing 5D bet:', error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}
