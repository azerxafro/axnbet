const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { cycle_id, winning_numbers } = req.body;

    if (!cycle_id) {
        return res.status(400).json({ success: false, message: 'Cycle ID required.' });
    }

    if (supabaseUrl === 'https://your-project.supabase.co') {
        return res.json({
            success: true,
            message: `Draw completed for cycle ${cycle_id}. Winning numbers: 777 (MOCK)`,
            winners: 0,
            total_payout: 0
        });
    }

    // Verify Admin via auth header or cron secret
    const authHeader = req.headers.authorization;
    const cronSecret = req.headers['x-cron-secret'];
    
    if (cronSecret !== process.env.CRON_SECRET && !authHeader) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (!cronSecret) {
        const supabaseAnon = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } }
        });
        const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser();
        if (authErr || !user) return res.status(401).json({ success: false, message: 'Invalid session' });

        const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required.' });
        }
    }

    try {
        const drawNumber = winning_numbers || Math.floor(Math.random() * 1000).toString().padStart(3, '0');

        // 1. Mark cycle as completed and set winning numbers
        await supabaseAdmin.from('lottery_cycles')
            .update({ status: 'completed', winning_numbers: drawNumber })
            .eq('id', cycle_id);

        // 2. Fetch pending tickets for this cycle
        const { data: tickets } = await supabaseAdmin.from('tickets')
            .select('*')
            .eq('cycle_id', cycle_id)
            .eq('status', 'pending');

        let winnersCount = 0;
        let totalPayout = 0;

        // Process tickets (Note: In production with many tickets, this should be done in a PostgreSQL RPC)
        if (tickets && tickets.length > 0) {
            for (const ticket of tickets) {
                // Determine if win
                // If Run Guess, it checks Even/Odd. For demo, we just assume direct match for numbers unless we fetch lottery name.
                // Assuming standard 90x payout for exact match for now as a simple example
                const isWin = (ticket.bet_numbers === drawNumber);
                const payout = isWin ? parseFloat(ticket.bet_amount) * 90 : 0;

                const status = isWin ? 'win' : 'lose';

                await supabaseAdmin.from('tickets')
                    .update({ status, payout_amount: payout })
                    .eq('id', ticket.id);

                if (isWin) {
                    winnersCount++;
                    totalPayout += payout;

                    // Update user balance
                    const { data: profile } = await supabaseAdmin.from('profiles').select('balance').eq('id', ticket.user_id).single();
                    await supabaseAdmin.from('profiles')
                        .update({ balance: parseFloat(profile.balance) + payout })
                        .eq('id', ticket.user_id);

                    // Add ledger entry
                    await supabaseAdmin.from('ledger_transactions').insert({
                        user_id: ticket.user_id,
                        type: 'win_payout',
                        amount: payout,
                        status: 'completed',
                        reference_id: ticket.id.toString()
                    });
                }
            }
        }

        // 3. Create next cycle (if needed)
        // ... (This logic depends on how cycles are managed. Can be omitted or added based on requirements)

        res.json({
            success: true,
            message: `Draw completed for cycle ${cycle_id}. Winning numbers: ${drawNumber}`,
            winners: winnersCount,
            total_payout: totalPayout
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
