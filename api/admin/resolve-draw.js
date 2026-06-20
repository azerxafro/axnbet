const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service key needed to bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // In a real app, you'd add a secret token check here to ensure only cron or admins can call this
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { cycle_id } = req.body;

        if (!cycle_id) {
            return res.status(400).json({ error: 'Missing cycle_id' });
        }

        // 1. Get cycle details
        const { data: cycle, error: cycleError } = await supabase
            .from('lottery_cycles')
            .select('*')
            .eq('id', cycle_id)
            .single();

        if (cycleError || !cycle) {
            return res.status(404).json({ error: 'Cycle not found' });
        }

        if (cycle.status === 'completed') {
            return res.status(400).json({ error: 'Cycle is already completed' });
        }

        // 2. Generate random winning numbers based on game type (e.g. 5 digits for 5D)
        // Here we simulate 5 random digits (0-9)
        const generateNumber = () => Math.floor(Math.random() * 10);
        const winningNumbers = [
            generateNumber(), generateNumber(), generateNumber(),
            generateNumber(), generateNumber()
        ].join(',');

        // 3. Update cycle status and winning numbers
        await supabase
            .from('lottery_cycles')
            .update({ status: 'completed', winning_numbers: winningNumbers })
            .eq('id', cycle_id);

        // 4. Resolve tickets
        const { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select('*')
            .eq('cycle_id', cycle_id)
            .eq('status', 'pending');

        if (ticketsError) throw ticketsError;

        let processed = 0;
        for (const ticket of tickets) {
            // Simple logic: if ticket.bet_numbers exactly matches winningNumbers, they win.
            // In a real 5D game, logic can be complex (box, individual digits, etc).
            // For now, let's just do an exact match or simply mark it.
            const isWin = (ticket.bet_numbers === winningNumbers);
            const payoutAmount = isWin ? (ticket.bet_amount * 9000 * ticket.multiplier) : 0;
            const newStatus = isWin ? 'win' : 'lose';

            // Update ticket
            await supabase
                .from('tickets')
                .update({ status: newStatus, payout_amount: payoutAmount })
                .eq('id', ticket.id);

            // If win, update balance
            if (isWin) {
                // Fetch current balance
                const { data: profile } = await supabase.from('profiles').select('balance').eq('id', ticket.user_id).single();
                
                await supabase
                    .from('profiles')
                    .update({ balance: Number(profile.balance) + payoutAmount })
                    .eq('id', ticket.user_id);

                // Add to ledger
                await supabase.from('ledger_transactions').insert({
                    user_id: ticket.user_id,
                    type: 'win_payout',
                    amount: payoutAmount,
                    status: 'completed',
                    reference_id: ticket.id.toString()
                });
            }
            processed++;
        }

        // 5. Create the next cycle
        const nextDrawTime = new Date(new Date(cycle.draw_time).getTime() + 300000); // +5 mins
        await supabase.from('lottery_cycles').insert({
            name: cycle.name,
            draw_time: nextDrawTime.toISOString(),
            cycle_number: cycle.cycle_number + 1,
            status: 'open'
        });

        return res.status(200).json({
            success: true,
            message: `Draw resolved. Winning numbers: ${winningNumbers}. Tickets processed: ${processed}`
        });
    } catch (error) {
        console.error('Error resolving draw:', error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}
