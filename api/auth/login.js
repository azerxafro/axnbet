const { supabase } = require('../../lib/supabaseClient');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, password } = req.body;
    
    // In a real OTP scenario, username would be the phone number and password would be the OTP or actual password.
    // Assuming simple password-based auth for this migration step to keep frontend compatibility.
    // If you're using phone OTP, you'd use supabase.auth.signInWithOtp({ phone: username }) 
    // and a separate verify endpoint. For now, let's use standard email/password or phone/password.
    
    // Let's assume standard Supabase authentication with phone/password or email.
    // Since original used 'username' (which is phone) and 'password':
    
    // Fallback to mock logic if Supabase is not configured properly yet
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL === 'https://your-project.supabase.co') {
        const phone = username || '9876543210';
        const displayUser = 'User_' + phone.substring(6);
        return res.send(`
            <script>
                // Fallback mock logic
                document.cookie = "mock_auth=true; path=/";
                document.cookie = "mock_phone=${phone}; path=/";
                document.cookie = "mock_username=${displayUser}; path=/";
                alert("Signed in successfully as ${displayUser}!");
                window.location.href = '/';
            </script>
        `);
    }

    try {
        // Attempt Supabase Auth login (assuming email/password for simplicity, or custom phone auth)
        // Note: Supabase phone auth typically requires an OTP verification step.
        // If password is used with phone, ensure the Supabase project has phone auth with passwords enabled.
        const { data, error } = await supabase.auth.signInWithPassword({
            phone: username,
            password: password,
        });

        if (error) {
            return res.send(`
                <script>
                    alert("Login failed: ${error.message}");
                    window.history.back();
                </script>
            `);
        }

        // Set auth cookies for the frontend to use (or return JSON and let frontend handle it)
        // The original returned a script block redirect.
        const user = data.user;
        const displayUser = user.user_metadata?.username || 'User_' + (user.phone || '0000').slice(-4);
        
        return res.send(`
            <script>
                // We would typically set HTTP-only cookies here, or store token in localStorage
                localStorage.setItem('supabase.auth.token', '${data.session.access_token}');
                alert("Signed in successfully as ${displayUser}!");
                window.location.href = '/';
            </script>
        `);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
