import { SNS_SITES } from './js/config.js';

document.addEventListener('DOMContentLoaded', async () => {
    await updateStats();
    await updateTimeSettings(); // 制限時間設定の表示を追加
    setInterval(updateStats, 1000); // 1秒ごとに更新
    setupEventListeners();
});

async function updateStats() {
    const { todayStats, userLimits } = await chrome.storage.local.get(['todayStats', 'userLimits']);
    const stats = document.getElementById('stats');
    stats.innerHTML = '';

    Object.entries(SNS_SITES).forEach(([domain, site]) => {
        const seconds = (todayStats || {})[domain] || 0;
        const minutes = Math.floor(seconds / 60);
        const limit = (userLimits || {})[domain] || site.defaultLimit;
        const percentage = Math.min((minutes / limit) * 100, 100);

        const item = document.createElement('div');
        item.className = 'stat-item';
        if (percentage >= 90) item.classList.add('warning');

        item.innerHTML = `
            <div class="site-info">
                <span>${site.icon} ${site.name}</span>
            </div>
            <div class="time-info">
                <div>${minutes}/${limit}分</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;

        stats.appendChild(item);
    });
}

// 制限時間設定の更新関数を追加
async function updateTimeSettings() {
    const { userLimits } = await chrome.storage.local.get(['userLimits']);
    const timeSettings = document.getElementById('timeSettings');
    timeSettings.innerHTML = '';

    Object.entries(SNS_SITES).forEach(([domain, site]) => {
        const currentLimit = (userLimits || {})[domain] || site.defaultLimit;

        const settingItem = document.createElement('div');
        settingItem.className = 'setting-item';
        settingItem.innerHTML = `
            <div class="site-info">
                <span>${site.icon} ${site.name}</span>
            </div>
            <div class="time-setting">
                <input type="number" 
                       min="1" 
                       max="1440" 
                       value="${currentLimit}" 
                       data-domain="${domain}" 
                       class="time-limit-input">
                <span>分</span>
            </div>
        `;

        timeSettings.appendChild(settingItem);
    });
}

function setupEventListeners() {
    // 制限時間の変更を監視
    document.getElementById('timeSettings').addEventListener('change', async (e) => {
        if (e.target.matches('.time-limit-input')) {
            const domain = e.target.dataset.domain;
            const newLimit = parseInt(e.target.value);

            if (newLimit > 0 && newLimit <= 1440) {
                const { userLimits = {} } = await chrome.storage.local.get('userLimits');
                userLimits[domain] = newLimit;
                await chrome.storage.local.set({ userLimits });
                await updateStats();
            }
        }
    });

    document.getElementById('resetStats').addEventListener('click', async () => {
        if (confirm('今日の統計をリセットしますか？')) {
            await chrome.storage.local.set({ todayStats: {} });
            await updateStats();
        }
    });

    document.getElementById('exportData').addEventListener('click', async () => {
        const data = await chrome.storage.local.get(['todayStats', 'userLimits']);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sns-stats-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
}