const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Find the active 5D draw
        const { data: activeDraw, error: drawError } = await supabase
            .from('lottery_cycles')
            .select('*')
            .eq('name', '5D')
            .eq('status', 'open')
            .order('draw_time', { ascending: true })
            .limit(1)
            .single();

        if (drawError && drawError.code !== 'PGRST116') {
            throw drawError;
        }

        // Find recent history
        const { data: history, error: historyError } = await supabase
            .from('lottery_cycles')
            .select('cycle_number, draw_time, winning_numbers')
            .eq('name', '5D')
            .eq('status', 'completed')
            .order('draw_time', { ascending: false })
            .limit(10);

        if (historyError) {
            throw historyError;
        }

        return res.status(200).json({
            success: true,
            activeDraw: activeDraw || null,
            history: history || []
        });
    } catch (error) {
        console.error('Error fetching 5D draw:', error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}
