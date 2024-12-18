// SNSサイトの設定
const SNS_SITES = {
    'youtube.com': {
        name: 'YouTube',
        defaultLimit: 70,
        icon: '🎥'
    },
    'twitter.com': {
        name: 'X (Twitter)',
        defaultLimit: 60,
        icon: '🐦'
    },
    'facebook.com': {
        name: 'Facebook',
        defaultLimit: 60,
        icon: '👥'
    },
    'instagram.com': {
        name: 'Instagram',
        defaultLimit: 60,
        icon: '📷'
    },
    'tiktok.com': {
        name: 'TikTok',
        defaultLimit: 60,
        icon: '🎵'
    }
};

let activeTab = {
    url: null,
    startTime: null,
    domain: null
};

let todayStats = {};

// 初期化
async function initialize() {
    const data = await chrome.storage.local.get(['todayStats', 'lastResetDate']);
    const today = new Date().toDateString();

    if (data.lastResetDate !== today) {
        todayStats = {};
        await chrome.storage.local.set({
            todayStats: {},
            lastResetDate: today
        });
    } else {
        todayStats = data.todayStats || {};
    }
    console.log('Initialized with stats:', todayStats);
}

// タブのアクティブ状態の変更を監視
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    console.log('Tab activated');
    if (activeTab.startTime) {
        await saveTime();
    }
    const tab = await chrome.tabs.get(activeInfo.tabId);
    updateActiveTab(tab.url);
});

// URLの変更を監視
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        console.log('URL changed:', changeInfo.url);
        updateActiveTab(changeInfo.url);
    }
});

// アクティブなタブの情報を更新
function updateActiveTab(url) {
    if (!url) return;
    
    try {
        const domain = new URL(url).hostname;
        const snsKey = Object.keys(SNS_SITES).find(key => domain.includes(key));
        
        if (snsKey) {
            console.log('SNS detected:', snsKey);
            activeTab = {
                url: url,
                startTime: Date.now(),
                domain: snsKey
            };
        } else {
            activeTab = { url: null, startTime: null, domain: null };
        }
    } catch (e) {
        console.error('URL parsing error:', e);
        activeTab = { url: null, startTime: null, domain: null };
    }
}

// 使用時間を保存
async function saveTime() {
    if (!activeTab.startTime || !activeTab.domain) return;
    
    const duration = Math.floor((Date.now() - activeTab.startTime) / 1000); // 秒単位
    const domain = activeTab.domain;
    
    todayStats[domain] = (todayStats[domain] || 0) + duration;
    console.log('Saving time:', domain, duration, 'Total:', todayStats[domain]);
    
    // 制限時間をチェックして通知
    const { userLimits = {} } = await chrome.storage.local.get('userLimits');
    const limitMinutes = userLimits[domain] || SNS_SITES[domain].defaultLimit;
    const usedMinutes = Math.floor(todayStats[domain] / 60);

    if (usedMinutes >= limitMinutes) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: '使用時間制限に達しました',
            message: `${SNS_SITES[domain].name}の本日の使用時間制限（${limitMinutes}分）に達しました。`
        });
    }
    
    await chrome.storage.local.set({ todayStats });
}

// ウィンドウのフォーカス変更を監視
chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        console.log('Window lost focus');
        if (activeTab.startTime) {
            await saveTime();
            activeTab = { url: null, startTime: null, domain: null };
        }
    }
});

// タブが閉じられたときの処理
chrome.tabs.onRemoved.addListener(async (tabId) => {
    if (activeTab.startTime) {
        await saveTime();
        activeTab = { url: null, startTime: null, domain: null };
    }
});

initialize();