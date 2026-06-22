const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message } = req.body;
    const cleanMessage = message?.trim();

    if (!cleanMessage) {
        return res.status(400).json({ success: false, message: 'Empty message.' });
    }

    if (cleanMessage.length > 300) {
        return res.status(400).json({ success: false, message: 'Message too long (max 300 characters).' });
    }

    

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, message: 'Please sign in first to chat.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    
    if (authErr || !user) {
        return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    try {
        // Rate limiting check
        const { data: lastMsg } = await supabase
            .from('chats')
            .select('created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastMsg) {
            const lastTime = new Date(lastMsg.created_at).getTime();
            const now = Date.now();
            if (now - lastTime < 3000) {
                return res.status(429).json({ success: false, message: 'You are sending messages too fast. Please wait 3 seconds.' });
            }
        }

        const username = user.user_metadata?.username || 'User_' + (user.phone || '0000').slice(-4);
        
        const { error } = await supabase.from('chats').insert({
            user_id: user.id,
            username: username,
            message: cleanMessage
        });

        if (error) throw error;

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
