module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, password } = req.body;
    
    if (username === 'admin' && password === '1234') {
        return res.send(`
            <script>
                document.cookie = "mock_auth=true; path=/";
                document.cookie = "mock_phone=9876543210; path=/";
                document.cookie = "mock_username=admin; path=/";
                alert("Signed in successfully as admin!");
                window.location.href = '/';
            </script>
        `);
    } else {
        return res.send(`
            <script>
                alert("Invalid credentials. Please use Demo Login (Username: admin, Password: 1234)");
                window.history.back();
            </script>
        `);
    }
};
