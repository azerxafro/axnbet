(function() {
    window.CURRENCIES = {
        INR: { symbol: '₹', rate: 1.0, name: 'INR' },
        USD: { symbol: '$', rate: 0.012, name: 'USD' },
        CAD: { symbol: 'C$', rate: 0.016, name: 'CAD' },
        SGD: { symbol: 'S$', rate: 0.016, name: 'SGD' },
        AED: { symbol: 'AED ', rate: 0.044, name: 'AED' }
    };

    const symbols = ['C\\$', 'S\\$', '₹', '\\$', 'AED\\s*'];
    const regex = new RegExp(`(${symbols.join('|')})\\s*(\\d+(?:,\\d{3})*(?:\\.\\d+)?|\\d+)`, 'g');

    window.changeCurrency = function(val) {
        if (!window.CURRENCIES[val]) return;
        localStorage.setItem('selectedCurrency', val);
        
        // Update all selectors on the page
        const selectors = document.querySelectorAll('#currencySelector');
        selectors.forEach(s => s.value = val);
        
        // Reload page to re-render all elements correctly under the new rate
        window.location.reload();
    };

    window.convertCurrencyText = function(text) {
        return text.replace(regex, (match, sym, amtStr) => {
            const amt = parseFloat(amtStr.replace(/,/g, ''));
            if (isNaN(amt)) return match;
            
            // Find matched currency
            let matchedCurrency = null;
            const cleanSym = sym.trim();
            for (const code in window.CURRENCIES) {
                if (window.CURRENCIES[code].symbol.trim() === cleanSym) {
                    matchedCurrency = window.CURRENCIES[code];
                    break;
                }
            }
            
            if (!matchedCurrency) return match;
            
            // Convert to base INR
            const baseAmount = amt / matchedCurrency.rate;
            
            // Convert to selected target currency
            const selectedCode = localStorage.getItem('selectedCurrency') || 'INR';
            const targetCurrency = window.CURRENCIES[selectedCode] || window.CURRENCIES.INR;
            const targetAmount = baseAmount * targetCurrency.rate;
            
            // Format
            let formatted;
            if (selectedCode === 'INR') {
                if (amtStr.indexOf('.') === -1 && targetAmount % 1 === 0) {
                    formatted = Math.round(targetAmount).toString();
                } else {
                    formatted = targetAmount.toFixed(2);
                }
            } else {
                formatted = targetAmount.toFixed(2);
            }
            
            return `${targetCurrency.symbol}${formatted}`;
        });
    };

    window.walkAndConvert = function(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (regex.test(node.nodeValue)) {
                regex.lastIndex = 0;
                const newVal = window.convertCurrencyText(node.nodeValue);
                if (newVal !== node.nodeValue) {
                    node.nodeValue = newVal;
                }
            }
        } else {
            const tag = node.nodeName.toLowerCase();
            if (tag !== 'script' && tag !== 'style' && tag !== 'textarea' && tag !== 'input') {
                for (let child of node.childNodes) {
                    window.walkAndConvert(child);
                }
            }
        }
    };

    const observer = new MutationObserver((mutations) => {
        observer.disconnect();
        for (let mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    window.walkAndConvert(node);
                });
            } else if (mutation.type === 'characterData') {
                const node = mutation.target;
                if (regex.test(node.nodeValue)) {
                    regex.lastIndex = 0;
                    const newVal = window.convertCurrencyText(node.nodeValue);
                    if (newVal !== node.nodeValue) {
                        node.nodeValue = newVal;
                    }
                }
            }
        }
        observe();
    });

    function observe() {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function init() {
        // Set selector state on load
        const selected = localStorage.getItem('selectedCurrency') || 'INR';
        const selectors = document.querySelectorAll('#currencySelector');
        selectors.forEach(s => s.value = selected);
        
        window.walkAndConvert(document.body);
        observe();
    }

    document.addEventListener('DOMContentLoaded', init);
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    }
})();
