const { getBaseURL } = require("../js/lib");

async function getURL(title, browserName) {
    try {
        browserName = browserName.toLowerCase();
        let url= null;
        let base_url = null;
        let is_newtab = 0;
        let is_private = 0;
        let is_titleAsURL = 0;
        const formatedTitle = await formatTitle(title);

        is_newtab = await checkNewTab(title);
        is_private = await checkPrivate(title);
        is_titleAsURL = await checkTitleAsURL(formatedTitle);
        if (is_titleAsURL) {
            url = formatedTitle;
            base_url = await getBaseURL(url);
        }

        if (is_newtab == 0 || is_titleAsURL == 0) {
            let browserModule;
            if (browserName.includes('chrome')) {
                browserModule = require('./chrome');
            } else if (browserName.includes('edge')) {
                browserModule = require('./edge');
            } else if (browserName.includes('firefox')) {
                browserModule = require('./firefox');
            } else {
                return {
                    formatted_title : formatedTitle,
                    url: 'unsupported browser',
                    base_url : "unsupported-browser",
                    is_newtab: is_newtab,
                    is_private: is_private,
                };
            }

            const windowDetailsByTitle = await browserModule.fetchWindowDetailsByTitle(formatedTitle);
            url = windowDetailsByTitle ? windowDetailsByTitle.url : null;
            base_url = (windowDetailsByTitle.url) ? await getBaseURL(windowDetailsByTitle.url) : null;
            if ( url == null && is_newtab == 0 && browserName.includes('google-chrome')) {
                is_private = 1;
            }
        }

        return {
            formatted_title : formatedTitle,
            url: url,
            base_url : base_url,
            is_newtab: is_newtab,
            is_private: is_private,
        };

    } catch (error) {
        console.log(error);
    }
}

//check if window is private windoe. will work for firefox nad edge only
async function checkPrivate(title) {
    const isPrivate = /New Incognito tab - Google Chrome$| — Mozilla Firefox Private Browsing$| - Mozilla Firefox Private Browsing$|Mozilla Firefox Private Browsing$| - \[InPrivate\] - Microsoft Edge$| - \[InPrivate\] - Microsoft​ Edge$/.test(title);
    return isPrivate ? 1 : 0;
}

// check if window is new tab
async function checkNewTab(title) {
    let isNewTab = 0;
    const newTabRegex = /\bnew (tab|incognito tab|inprivate tab)\b/i; // Matches "new tab", "new incognito tab", etc.
    const firefoxStandaloneRegex = /^Mozilla Firefox(?:\s*-\s*)?$/i; // Matches "Mozilla Firefox" if it’s standalone
    isNewTab = newTabRegex.test(title) || firefoxStandaloneRegex.test(title) ? 1 : 0;

    // Ensure "Mozilla Firefox" with extra content is NOT treated as a new tab
    if (/Mozilla Firefox/i.test(title) && !firefoxStandaloneRegex.test(title)) {
        isNewTab = 0;
    }

    // Ensure "Mozilla Firefox Private Browsing" is treated as a new tab
    if (title == 'Mozilla Firefox Private Browsing') {
        isNewTab = 1;
    }
    return isNewTab;
}

// check if window title is same as url
async function checkTitleAsURL(title) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const matches = title.match(urlPattern);
    return matches ? 1 : 0;
}

// format title
async function formatTitle(title) {
    return title
    .replace(/\s*and \d+ more pages?/, '') // Remove "and X more pages" or "and X more page"
    .replace(/\s*[-—]\s*(Profile \d+|Personal)\s*/, '') // Remove "Profile X" or "Personal"
    .replace(/\s*[-—]?\s*(Mozilla Firefox|Google Chrome|Safari|Microsoft Edge|Microsoft​ Edge|Opera)\s*$/, '')// Remove browser name
    .replace(/\s*[-—]?\s*(Mozilla Firefox Private Browsing|\[InPrivate\])\s*$/,'')
    .trim();
}

async function isBrowserWindow(processName) {
    processName = processName.toLowerCase();
    const browserNames = ['firefox', 'chrome', 'edge', 'safari', 'opera'];
    return browserNames.some(browser => processName.includes(browser));
}

module.exports = { 
    getURL,
    isBrowserWindow
};
