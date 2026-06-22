import re
from pathlib import Path

# Read exact source code
html = Path('/Users/admin/Downloads/source code.txt').read_text(errors='ignore')

# 1. Update the image URLs to be absolute from domain or relative to /
html = html.replace('="/assets/', '="assets/')
html = html.replace("='/assets/", "='assets/")
html = html.replace('"/assets/', '"assets/')
html = html.replace("'/assets/", "'assets/")

# Ensure the paths to script modules load locally
html = html.replace('src="https://axnagency.com/assets/bz/assets/index-DUlEkQfN.js"', 'src="assets/bz/assets/index-DUlEkQfN.js"')
html = html.replace('href="https://axnagency.com/assets/bz/vendor.css"', 'href="assets/bz/vendor.css"')
html = html.replace('href="https://axnagency.com/assets/bz/pages.css"', 'href="assets/bz/pages.css"')
html = html.replace('href="https://axnagency.com/assets/images/logoIcon/favicon.png"', 'href="assets/images/logoIcon/favicon.png"')
html = html.replace('href="https://axnagency.com/assets/images/logoIcon/logo.png"', 'href="assets/images/logoIcon/logo.png"')

# 2. Inject SPA navigation and Balance Update scripts before </body>
spa_scripts = """
      <script>
        // Store original home content for SPA return
        let _homeContent = null;
        document.addEventListener('DOMContentLoaded', function() {
            _homeContent = document.getElementById('root').innerHTML;
            
            // Sync UI with user session
            if (window.userSession && window.userSession.isAuthenticated) {
                // Find the balance element and update it
                const balanceElements = document.querySelectorAll('.text-xs.font-bold');
                balanceElements.forEach(el => {
                    if (el.textContent.includes('₹')) {
                        el.textContent = '₹ ' + window.userSession.balance.toFixed(2);
                    }
                });
            } else {
                // If not logged in, redirect clicks on wallet to login
                const rechargeBtn = document.querySelector('[onclick*="/user/recharge"]');
                if (rechargeBtn) {
                    rechargeBtn.setAttribute('onclick', 'window.location.href="/user/login-form"');
                }
            }
            
            // Restore tab based on current URL path
            const path = window.location.pathname;
            if (path === '/user/results/index') {
                document.getElementById('footerResultTab').click();
            } else if (path === '/user/game/lottery_spin') {
                // document.getElementById('footerSpinTab').click(); // Adjust if spin tab is defined
            } else if (path === '/chat') {
                // document.getElementById('footerJoinMeTab').click();
            } else if (path === '/user/tofactor-dashboard-new') {
                // document.getElementById('footerMeTab').click();
            }
        });

        // Helper to highlight active footer tab
        function setActiveTab(activeId) {
            ['footerHomeTab','footerResultTab','footerSpinTab','footerJoinMeTab','footerMeTab'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const svg = el.querySelector('svg');
                const span = el.querySelector('span');
                if (id === activeId) {
                    if (svg) svg.classList.add('text-primary');
                    if (span) span.classList.add('text-primary');
                } else {
                    if (svg) svg.classList.remove('text-primary');
                    if (span) span.classList.remove('text-primary');
                }
            });
        }

        // Add event listeners for the footer navigation to avoid page reloads
        setTimeout(() => {
            const homeTab = document.querySelector('[onclick="window.location.href=\'/\'"]');
            if (homeTab) {
                homeTab.id = "footerHomeTab";
                homeTab.removeAttribute('onclick');
                homeTab.addEventListener("click", function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (_homeContent) {
                        document.getElementById("root").innerHTML = _homeContent;
                        if (window.location.pathname !== '/') {
                            history.pushState({}, '', '/');
                        }
                        window.scrollTo(0, 0);
                        setActiveTab('footerHomeTab');
                        
                        // Re-apply balance
                        if (window.userSession && window.userSession.isAuthenticated) {
                            const balanceElements = document.querySelectorAll('.text-xs.font-bold');
                            balanceElements.forEach(el => {
                                if (el.textContent.includes('₹')) {
                                    el.textContent = '₹ ' + window.userSession.balance.toFixed(2);
                                }
                            });
                        }
                    } else {
                        window.location.href = '/';
                    }
                });
            }

            const resultTab = document.querySelector('[onclick="window.location.href=\'/user/results/new-results\'"]');
            if (resultTab) {
                resultTab.id = "footerResultTab";
                resultTab.removeAttribute('onclick');
                resultTab.addEventListener("click", function(e) {
                    e.preventDefault();
                    fetch("/user/results/index", { headers: { "X-Requested-With": "XMLHttpRequest" } })
                        .then(response => response.text())
                        .then(data => {
                            document.getElementById("root").innerHTML = data;
                            if (window.location.pathname !== '/user/results/index') {
                                history.pushState({}, '', '/user/results/index');
                            }
                            window.scrollTo(0, 0);
                            setActiveTab('footerResultTab');
                        })
                        .catch(error => console.error(error));
                });
            }

            const spinTab = document.querySelector('[onclick="window.location.href=\'/user/game/lottery_spin\'"]');
            if (spinTab) {
                spinTab.id = "footerSpinTab";
                spinTab.removeAttribute('onclick');
                spinTab.addEventListener("click", function(e) {
                    e.preventDefault();
                    fetch("/user/game/lottery_spin")
                        .then(response => response.text())
                        .then(data => {
                            document.getElementById("root").innerHTML = data;
                            if (window.location.pathname !== '/user/game/lottery_spin') {
                                history.pushState({}, '', '/user/game/lottery_spin');
                            }
                            window.scrollTo(0, 0);
                            setActiveTab('footerSpinTab');
                        })
                        .catch(error => console.error(error));
                });
            }

            const meTab = document.querySelector('[onclick="window.location.href=\'/user/tofactor-dashboard-new/\'"]');
            if (meTab) {
                meTab.id = "footerMeTab";
                meTab.removeAttribute('onclick');
                meTab.addEventListener("click", function(e) {
                    e.preventDefault();
                    fetch("/user/tofactor-dashboard-new")
                        .then(response => response.text())
                        .then(data => {
                            document.getElementById("root").innerHTML = data;
                            if (window.location.pathname !== '/user/tofactor-dashboard-new') {
                                history.pushState({}, '', '/user/tofactor-dashboard-new');
                            }
                            window.scrollTo(0, 0);
                            setActiveTab('footerMeTab');
                        })
                        .catch(error => console.error(error));
                });
            }
        }, 500);

      </script>
"""

html = html.replace('</body>', spa_scripts + '\n</body>')

# Handle dynamic routing goToPage inside the document
html = html.replace("goToPage('https://axnagency.com", "goToPage('")

# Also, update the actual draw times directly in the HTML to match our current cycle data
replacements = {
    'data-draw-time="1778907540000"': 'data-draw-time="1782131220000"', # Map to current dynamic values if needed
    'data-draw-time="1778907600000"': 'data-draw-time="1782138420000"',
}
# Actually it's best to leave the raw draw times, or maybe just replace them with current logic
# The original source file has 17821... timestamps for some but others are older. We'll leave them exactly as is,
# the `updateCountdown` JS will handle them seamlessly by picking them up or defaulting to `178...`.

Path('/Users/admin/Desktop/xbet/www.axnagency.com/index.html').write_text(html)
print("Done.")
