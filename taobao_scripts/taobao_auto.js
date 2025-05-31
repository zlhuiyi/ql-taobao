/*
 * 淘宝自动化脚本 for 青龙面板
 * 功能：淘宝每日自动签到、领取淘金币、逛店铺任务
 * 使用方法：
 * 1. 配置环境变量 TB_COOKIE，填入淘宝Cookie
 * 2. 青龙面板添加定时任务：0 9 * * * node /scripts/taobao_auto.js
 */

const axios = require('axios');
const notify = require('./sendNotify');
const Env = require('./Env');
const $ = new Env('淘宝自动化任务');

// 从环境变量获取Cookie
const cookie = process.env.TB_COOKIE;
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
        // 淘宝签到
        await taobaoSignIn();
        
        // 淘金币任务
        await taoGoldCoinTasks();
        
        // 领取店铺签到奖励
        await shopSignInRewards();
        
        // 汇总消息
        const resultMsg = `✅ 成功：${sucNum}个任务\n❌ 失败：${failNum}个任务\n\n${message}`;
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

// 淘宝签到
async function taobaoSignIn() {
    try {
        console.log('\n开始【淘宝每日签到】...');
        const url = 'https://taobao.com';
        await axios.get(url, { headers });
        
        const signUrl = 'https://vip.taobao.com/ajax/signIn.htm';
        const res = await axios.post(signUrl, {}, { headers });
        
        if (res.data && res.data.success) {
            message += `✅ 淘宝签到成功，获得${res.data.data.point}积分\n`;
            sucNum++;
        } else {
            message += `⚠️ 淘宝签到失败，可能已经签到过了\n`;
        }
    } catch (e) {
        console.log(`❌ 淘宝签到异常: ${e}`);
        message += `❌ 淘宝签到异常: ${e}\n`;
        failNum++;
    }
}

// 淘金币任务
async function taoGoldCoinTasks() {
    try {
        console.log('\n开始【淘金币任务】...');
        
        // 获取任务列表
        const taskListUrl = 'https://h5api.m.taobao.com/h5/mtop.taobao.taskcentre.api/1.0/';
        const params = {
            api: 'mtop.taobao.taskcentre.queryavailabletasks',
            v: '1.0',
            type: 'GET',
            dataType: 'json',
            appKey: '12574478',
        };
        
        const taskRes = await axios.get(taskListUrl, { 
            params,
            headers 
        });
        
        if (!taskRes.data || !taskRes.data.data || !taskRes.data.data.items) {
            message += `⚠️ 获取淘金币任务列表失败\n`;
            failNum++;
            return;
        }
        
        const tasks = taskRes.data.data.items;
        console.log(`✅ 获取到${tasks.length}个淘金币任务`);
        
        // 逐个完成任务
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            if (task.status === 'unFinish') {
                console.log(`🔄 开始任务【${task.title}】`);
                
                // 执行任务
                const doTaskUrl = 'https://h5api.m.taobao.com/h5/mtop.taobao.taskcentre.api/1.0/';
                const doTaskParams = {
                    api: 'mtop.taobao.taskcentre.dotask',
                    v: '1.0',
                    type: 'POST',
                    dataType: 'json',
                    appKey: '12574478',
                    data: JSON.stringify({
                        taskId: task.id,
                    }),
                };
                
                const doTaskRes = await axios.post(doTaskUrl, doTaskParams, { headers });
                
                if (doTaskRes.data && doTaskRes.data.data && doTaskRes.data.data.result) {
                    console.log(`✅ 任务【${task.title}】完成，获得${doTaskRes.data.data.result.coin || 0}金币`);
                    message += `✅ 完成【${task.title}】任务，获得${doTaskRes.data.data.result.coin || 0}金币\n`;
                    sucNum++;
                    
                    // 等待一下，避免请求过快
                    await $.wait(2000);
                } else {
                    console.log(`❌ 任务【${task.title}】完成失败`);
                    message += `❌ 任务【${task.title}】完成失败\n`;
                    failNum++;
                }
            } else {
                console.log(`✓ 任务【${task.title}】已完成，跳过`);
            }
        }
    } catch (e) {
        console.log(`❌ 淘金币任务异常: ${e}`);
        message += `❌ 淘金币任务异常: ${e}\n`;
        failNum++;
    }
}

// 领取店铺签到奖励
async function shopSignInRewards() {
    try {
        console.log('\n开始【店铺签到奖励领取】...');
        
        // 获取店铺签到列表
        const shopListUrl = 'https://h5api.m.taobao.com/h5/mtop.taobao.membershop.checkin.h5.checkin/1.0/';
        const params = {
            api: 'mtop.taobao.membershop.checkin.h5.checkin',
            v: '1.0',
            type: 'GET',
            dataType: 'json',
            appKey: '12574478',
            data: JSON.stringify({
                type: '1',
                behavior: 'query',
            }),
        };
        
        const shopRes = await axios.get(shopListUrl, { 
            params,
            headers 
        });
        
        if (!shopRes.data || !shopRes.data.data || !shopRes.data.data.shops) {
            message += `⚠️ 获取店铺签到列表失败\n`;
            failNum++;
            return;
        }
        
        const shops = shopRes.data.data.shops;
        console.log(`✅ 获取到${shops.length}个可签到店铺`);
        
        // 逐个店铺签到
        let shopSuccessCount = 0;
        for (let i = 0; i < shops.length; i++) {
            const shop = shops[i];
            if (!shop.checkined) {
                console.log(`🔄 开始签到店铺【${shop.shopTitle}】`);
                
                // 执行签到
                const signUrl = 'https://h5api.m.taobao.com/h5/mtop.taobao.membershop.checkin.h5.checkin/1.0/';
                const signParams = {
                    api: 'mtop.taobao.membershop.checkin.h5.checkin',
                    v: '1.0',
                    type: 'POST',
                    dataType: 'json',
                    appKey: '12574478',
                    data: JSON.stringify({
                        shopId: shop.shopId,
                        type: '1',
                        behavior: 'checkin',
                    }),
                };
                
                const signRes = await axios.post(signUrl, signParams, { headers });
                
                if (signRes.data && signRes.data.data && signRes.data.data.result === 'success') {
                    console.log(`✅ 店铺【${shop.shopTitle}】签到成功`);
                    shopSuccessCount++;
                    
                    // 等待一下，避免请求过快
                    await $.wait(1000);
                } else {
                    console.log(`❌ 店铺【${shop.shopTitle}】签到失败`);
                }
            } else {
                console.log(`✓ 店铺【${shop.shopTitle}】已签到，跳过`);
            }
        }
        
        message += `✅ 完成${shopSuccessCount}个店铺签到\n`;
        sucNum++;
    } catch (e) {
        console.log(`❌ 店铺签到异常: ${e}`);
        message += `❌ 店铺签到异常: ${e}\n`;
        failNum++;
    }
}

// 请求等待
$.wait = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout));