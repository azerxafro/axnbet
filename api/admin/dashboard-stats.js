const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
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
    
    if (authErr || !user) {
        return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    // Check if admin
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    try {
        const [
            { count: totalUsers },
            { count: totalTickets },
            { data: sumsData },
            { data: recentTickets },
            { data: recentChats }
        ] = await Promise.all([
            supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
            supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }),
            supabaseAdmin.rpc('get_dashboard_sums'),
            supabaseAdmin.from('tickets')
                .select('*, profiles(username), lottery_cycles(name, cycle_number)')
                .order('created_at', { ascending: false })
                .limit(10),
            supabaseAdmin.from('chats')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20)
        ]);

        const totalBalance = sumsData?.totalBalance || 0;
        const totalBetsAmount = sumsData?.totalBetsAmount || 0;

        res.json({
            totalUsers,
            totalBalance,
            totalBetsAmount,
            totalTickets,
            recentTickets: recentTickets?.map(t => ({
                id: t.id,
                username: t.profiles?.username || 'Unknown',
                lotteryName: t.lottery_cycles?.name,
                cycle: t.lottery_cycles?.cycle_number,
                numbers: t.bet_numbers,
                amount: t.bet_amount,
                status: t.status
            })) || [],
            recentChats: recentChats || []
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
