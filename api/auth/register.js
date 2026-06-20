const { supabase } = require('../../lib/supabaseClient');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { mobile, password, referBy } = req.body;

    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL === 'https://your-project.supabase.co') {
        const phone = mobile || '9876543210';
        const displayUser = 'User_' + phone.substring(6);
        return res.send(`
            <script>
                document.cookie = "mock_auth=true; path=/";
                document.cookie = "mock_phone=${phone}; path=/";
                document.cookie = "mock_username=${displayUser}; path=/";
                alert("Account registered and signed in successfully as ${displayUser}!");
                window.location.href = '/';
            </script>
        `);
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            phone: mobile,
            password: password,
            options: {
                data: {
                    username: 'User_' + mobile.substring(6),
                    referred_by: referBy || null
                }
            }
        });

        if (error) {
            return res.send(`
                <script>
                    alert("Registration failed: ${error.message}");
                    window.history.back();
                </script>
            `);
        }

        const displayUser = data.user?.user_metadata?.username || 'User_' + mobile.substring(6);

        return res.send(`
            <script>
                localStorage.setItem('supabase.auth.token', '${data.session?.access_token || ''}');
                alert("Account registered successfully as ${displayUser}!");
                window.location.href = '/';
            </script>
        `);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
