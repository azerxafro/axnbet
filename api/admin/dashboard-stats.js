const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (supabaseUrl === 'https://your-project.supabase.co') {
        return res.json({
            totalUsers: 1,
            totalBalance: 500,
            totalBetsAmount: 100,
            totalTickets: 2,
            recentTickets: [],
            recentChats: []
        });
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
        const { count: totalUsers } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true });
        
        const { data: balanceData } = await supabaseAdmin.from('profiles').select('balance');
        const totalBalance = balanceData?.reduce((sum, p) => sum + parseFloat(p.balance || 0), 0) || 0;

        const { data: betsData } = await supabaseAdmin.from('tickets').select('bet_amount');
        const totalBetsAmount = betsData?.reduce((sum, t) => sum + parseFloat(t.bet_amount || 0), 0) || 0;

        const { count: totalTickets } = await supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true });

        const { data: recentTickets } = await supabaseAdmin.from('tickets')
            .select('*, profiles(username), lottery_cycles(name, cycle_number)')
            .order('created_at', { ascending: false })
            .limit(10);

        const { data: recentChats } = await supabaseAdmin.from('chats')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

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
