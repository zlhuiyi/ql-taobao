/*
 * 淘宝店铺收藏有礼自动化脚本 for 青龙面板
 * 功能：自动收藏店铺、领取奖励，定期取消收藏
 * 使用方法：
 * 1. 配置环境变量 TB_COOKIE，填入淘宝Cookie
 * 2. 青龙面板添加定时任务：0 10 * * * node /scripts/taobao_shop_favorites.js
 */

const axios = require('axios');
const notify = require('./sendNotify');
const Env = require('./Env');
const $ = new Env('淘宝店铺收藏有礼');

// 从环境变量获取Cookie
const cookie = process.env.TB_COOKIE;
// 保存收藏店铺的信息，用于后续取消收藏
const favoriteShops = [];
// 日志和通知相关变量
let message = '';
let sucNum = 0;
let failNum = 0;

// 请求头设置
const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Connection': 'keep-alive',
    'Cookie': cookie,
    'Referer': 'https://www.taobao.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

// 主函数
!(async () => {
    if (!cookie) {
        $.msg($.name, '⚠️ 未获取到Cookie，请先配置环境变量TB_COOKIE');
        return;
    }
    
    console.log(`\n✅ 获取到Cookie，开始执行任务`);
    
    // 检查登录状态
    if (!await checkLogin()) {
        console.log('⚠️ Cookie已失效，请重新获取');
        await notify.sendNotify($.name, '⚠️ Cookie已失效，请重新获取');
        return;
    }
    
    try {
        // 搜索收藏有礼的店铺
        await searchFavoriteShops();
        
        // 收藏店铺并领取奖励
        await collectAndReceiveRewards();
        
        // 清理之前收藏的店铺（可选，避免收藏太多）
        await cleanFavorites();
        
        // 汇总消息
        const resultMsg = `✅ 成功：${sucNum}个店铺收藏和奖励领取\n❌ 失败：${failNum}个任务\n\n${message}`;
        console.log('\n' + resultMsg);
        
        // 发送通知
        if (message) {
            await notify.sendNotify($.name, resultMsg);
        }
    } catch (e) {
        console.log(`❌ 运行异常: ${e}`);
        await notify.sendNotify($.name, `❌ 运行异常: ${e}`);
    }
})()
    .catch((e) => {
        $.log('', `❌ ${$.name}, 失败! 原因: ${e}!`, '')
    })
    .finally(() => {
        $.done();
    })

// 检查登录状态
async function checkLogin() {
    try {
        const url = 'https://i.taobao.com/my_taobao.htm';
        const response = await axios.get(url, { headers });
        if (response.data.includes('亲，请登录')) {
            return false;
        }
        return true;
    } catch (e) {
        console.log(`❌ 检查登录状态异常: ${e}`);
        return false;
    }
}

// 搜索收藏有礼的店铺
async function searchFavoriteShops() {
    try {
        console.log('\n开始【搜索收藏有礼的店铺】...');
        
        // 搜索关键词
        const keywords = ['收藏有礼', '收藏送红包', '收藏优惠', '关注有礼'];
        
        for (const keyword of keywords) {
            console.log(`🔍 搜索关键词: ${keyword}`);
            
            const url = 'https://s.taobao.com/api';
            const params = {
                _ksTS: `${Date.now()}_1000`,
                ajax: 'true',
                q: keyword,
                js: '1',
                stats_click: 'search_radio_all',
                initiative_id: 'staobaoz_20201217',
                ie: 'utf8',
                sort: 'default',
            };
            
            const response = await axios.get(url, { 
                params,
                headers 
            });
            
            // 解析搜索结果
            if (response.data && response.data.mods && response.data.mods.shop) {
                const shops = response.data.mods.shop.data.result;
                
                if (shops && shops.length > 0) {
                    console.log(`✅ 找到 ${shops.length} 个可能有收藏礼的店铺`);
                    
                    // 添加到候选店铺列表
                    for (const shop of shops) {
                        favoriteShops.push({
                            nid: shop.nid,
                            title: shop.title,
                            userId: shop.user_id,
                            nick: shop.nick,
                            reward: false, // 标记是否已领取奖励
                            collected: false // 标记是否已收藏
                        });
                    }
                } else {
                    console.log(`⚠️ 未找到关键词 ${keyword} 的相关店铺`);
                }
            } else {
                console.log(`❌ 搜索店铺失败`);
            }
            
            // 等待一下，避免请求过快
            await $.wait(1000);
        }
        
        // 去重
        const uniqueShops = [];
        const shopIds = new Set();
        
        for (const shop of favoriteShops) {
            if (!shopIds.has(shop.nid)) {
                shopIds.add(shop.nid);
                uniqueShops.push(shop);
            }
        }
        
        // 更新店铺列表
        favoriteShops.length = 0;
        favoriteShops.push(...uniqueShops);
        
        console.log(`✅ 去重后共找到 ${favoriteShops.length} 个候选店铺`);
    } catch (e) {
        console.log(`❌ 搜索店铺异常: ${e}`);
        message += `❌ 搜索店铺异常: ${e}\n`;
        failNum++;
    }
}

// 收藏店铺并领取奖励
async function collectAndReceiveRewards() {
    try {
        console.log('\n开始【收藏店铺并领取奖励】...');
        
        // 最多处理30个店铺，避免一次收藏太多
        const maxShops = Math.min(favoriteShops.length, 30);
        let collectedCount = 0;
        let rewardCount = 0;
        
        for (let i = 0; i < maxShops; i++) {
            const shop = favoriteShops[i];
            console.log(`\n🔄 处理店铺 ${i+1}/${maxShops}: ${shop.title}`);
            
            // 检查是否已收藏
            const checkResult = await checkFavorite(shop.userId);
            if (checkResult) {
                console.log(`✓ 店铺 ${shop.title} 已收藏，跳过`);
                shop.collected = true;
                continue;
            }
            
            // 收藏店铺
            const collectResult = await collectShop(shop.userId);
            if (collectResult) {
                console.log(`✅ 收藏店铺 ${shop.title} 成功`);
                shop.collected = true;
                collectedCount++;
                
                // 尝试领取奖励
                const rewardResult = await getCollectReward(shop.userId);
                if (rewardResult) {
                    console.log(`✅ 领取店铺 ${shop.title} 收藏奖励成功`);
                    shop.reward = true;
                    rewardCount++;
                } else {
                    console.log(`⚠️ 店铺 ${shop.title} 可能没有收藏奖励`);
                }
            } else {
                console.log(`❌ 收藏店铺 ${shop.title} 失败`);
                failNum++;
            }
            
            // 等待一下，避免请求过快
            await $.wait(2000);
        }
        
        message += `✅ 成功收藏 ${collectedCount} 个店铺\n`;
        message += `✅ 成功领取 ${rewardCount} 个店铺的收藏奖励\n`;
        sucNum += (collectedCount + rewardCount);
    } catch (e) {
        console.log(`❌ 收藏店铺异常: ${e}`);
        message += `❌ 收藏店铺异常: ${e}\n`;
        failNum++;
    }
}

// 检查店铺是否已收藏
async function checkFavorite(userId) {
    try {
        const url = 'https://favorite.taobao.com/popup/add_collection.htm';
        const params = {
            id: userId,
            type: 'shop',
            _tb_token_: '',
        };
        
        const response = await axios.get(url, { 
            params,
            headers 
        });
        
        return response.data.includes('您已收藏过该店铺');
    } catch (e) {
        console.log(`❌ 检查店铺收藏状态异常: ${e}`);
        return false;
    }
}

// 收藏店铺
async function collectShop(userId) {
    try {
        const url = 'https://favorite.taobao.com/popup/add_collection.htm';
        const data = {
            id: userId,
            type: 'shop',
            _tb_token_: '',
        };
        
        const response = await axios.post(url, data, { headers });
        
        return response.data.includes('收藏成功') || response.data.includes('您已收藏过该店铺');
    } catch (e) {
        console.log(`❌ 收藏店铺异常: ${e}`);
        return false;
    }
}

// 领取收藏奖励
async function getCollectReward(userId) {
    try {
        const url = 'https://shop.m.taobao.com/shop/shop_activity_page.htm';
        const params = {
            userId: userId,
            type: 'favorite',
        };
        
        const response = await axios.get(url, { 
            params,
            headers 
        });
        
        // 判断是否有收藏奖励
        if (response.data.includes('领取奖励') || response.data.includes('收藏有礼') || response.data.includes('优惠券')) {
            // 领取奖励
            const rewardUrl = 'https://shop.m.taobao.com/shop/favorite_reward.htm';
            const rewardParams = {
                userId: userId,
            };
            
            const rewardResponse = await axios.get(rewardUrl, { 
                params: rewardParams,
                headers 
            });
            
            return rewardResponse.data.includes('成功') || rewardResponse.data.includes('领取');
        }
        
        return false;
    } catch (e) {
        console.log(`❌ 领取收藏奖励异常: ${e}`);
        return false;
    }
}

// 清理之前收藏的店铺
async function cleanFavorites() {
    try {
        console.log('\n开始【清理之前收藏的店铺】...');
        
        // 获取收藏的店铺列表
        const url = 'https://favorite.taobao.com/json/shop_json.htm';
        const params = {
            page: 1,
            pageSize: 20,
        };
        
        const response = await axios.get(url, { 
            params,
            headers 
        });
        
        // 解析收藏店铺列表
        let shopList = [];
        try {
            if (response.data) {
                const data = JSON.parse(response.data.match(/data\s*:\s*(\[.+?\])/s)[1]);
                shopList = data;
            }
        } catch (e) {
            console.log(`❌ 解析收藏店铺列表异常: ${e}`);
            return;
        }
        
        if (shopList.length === 0) {
            console.log(`✓ 没有需要清理的店铺`);
            return;
        }
        
        console.log(`✅ 找到 ${shopList.length} 个已收藏的店铺`);
        
        // 保留最近10天收藏的店铺，清理更早的
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        
        let cleanCount = 0;
        for (const shop of shopList) {
            // 跳过今天新收藏的店铺
            if (favoriteShops.some(s => s.userId === shop.userId && s.collected)) {
                continue;
            }
            
            // 判断收藏时间
            const collectTime = new Date(shop.collectTime);
            if (collectTime < tenDaysAgo) {
                console.log(`🔄 清理店铺: ${shop.title}`);
                
                const unfavoriteResult = await unfavoriteShop(shop.userId);
                if (unfavoriteResult) {
                    console.log(`✅ 取消收藏店铺 ${shop.title} 成功`);
                    cleanCount++;
                } else {
                    console.log(`❌ 取消收藏店铺 ${shop.title} 失败`);
                }
                
                // 等待一下，避免请求过快
                await $.wait(1000);
            }
        }
        
        message += `✅ 清理了 ${cleanCount} 个已收藏的店铺\n`;
    } catch (e) {
        console.log(`❌ 清理店铺异常: ${e}`);
        message += `❌ 清理店铺异常: ${e}\n`;
    }
}

// 取消收藏店铺
async function unfavoriteShop(userId) {
    try {
        const url = 'https://favorite.taobao.com/json/shop_unfavorite.htm';
        const data = {
            ids: userId,
            _tb_token_: '',
        };
        
        const response = await axios.post(url, data, { headers });
        
        return response.data.includes('成功');
    } catch (e) {
        console.log(`❌ 取消收藏店铺异常: ${e}`);
        return false;
    }
}

// 请求等待
$.wait = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout));