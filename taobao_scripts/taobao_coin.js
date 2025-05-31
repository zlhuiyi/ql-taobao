/*
 * 淘宝淘金币自动任务脚本 for 青龙面板
 * 功能：自动做淘金币任务、领取奖励
 * 使用方法：
 * 1. 配置环境变量 TB_COOKIE，填入淘宝Cookie
 * 2. 青龙面板添加定时任务：0 8 * * * node /scripts/taobao_coin.js
 */

const axios = require('axios');
const notify = require('./sendNotify');
const Env = require('./Env');
const $ = new Env('淘宝淘金币任务');

// 从环境变量获取Cookie
const cookie = process.env.TB_COOKIE;
// 日志和通知相关变量
let message = '';
let totalCoins = 0;
let completedTasks = 0;

// 请求头设置
const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Connection': 'keep-alive',
    'Cookie': cookie,
    'Referer': 'https://pages.tmall.com/wow/jinbi/hub/zhuliangjin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'x-referer': 'https://pages.tmall.com/wow/jinbi/hub/zhuliangjin'
};

// 主函数
!(async () => {
    if (!cookie) {
        $.msg($.name, '⚠️ 未获取到Cookie，请先配置环境变量TB_COOKIE');
        return;
    }
    
    console.log(`\n✅ 获取到Cookie，开始执行淘金币任务`);
    
    // 检查登录状态
    if (!await checkLogin()) {
        console.log('⚠️ Cookie已失效，请重新获取');
        await notify.sendNotify($.name, '⚠️ Cookie已失效，请重新获取');
        return;
    }
    
    try {
        // 获取淘金币账户信息
        await getCoinInfo();
        
        // 获取任务列表并完成
        await getTaskList();
        
        // 领取每日签到奖励
        await dailySignIn();
        
        // 领取淘金币奖励
        await receiveRewards();
        
        // 再次获取账户信息用于展示结果
        await getCoinInfo();
        
        // 汇总消息
        const resultMsg = `🏆 淘金币任务完成汇总:\n${message}\n✅ 完成了 ${completedTasks} 个任务\n💰 当前淘金币: ${totalCoins}`;
        console.log('\n' + resultMsg);
        
        // 发送通知
        await notify.sendNotify($.name, resultMsg);
        
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

// 获取淘金币账户信息
async function getCoinInfo() {
    try {
        console.log('\n开始【获取淘金币账户信息】...');
        
        const url = 'https://api.m.taobao.com/h5/mtop.alimama.union.uc.zhuliang.user.info/1.0/';
        const params = {
            api: 'mtop.alimama.union.uc.zhuliang.user.info',
            v: '1.0',
            type: 'GET',
            dataType: 'json',
            appKey: '12574478',
        };
        
        const response = await axios.get(url, { 
            params,
            headers 
        });
        
        if (response.data && response.data.data && response.data.data.user) {
            const userInfo = response.data.data.user;
            totalCoins = userInfo.gold || 0;
            console.log(`✅ 当前淘金币: ${totalCoins}`);
            message += `💰 当前淘金币: ${totalCoins}\n`;
        } else {
            console.log(`❌ 获取淘金币账户信息失败`);
            message += `❌ 获取淘金币账户信息失败\n`;
        }
    } catch (e) {
        console.log(`❌ 获取淘金币账户信息异常: ${e}`);
        message += `❌ 获取淘金币账户信息异常\n`;
    }
}

// 获取任务列表并完成
async function getTaskList() {
    try {
        console.log('\n开始【获取淘金币任务列表】...');
        
        const url = 'https://api.m.taobao.com/h5/mtop.alimama.union.uc.zhuliang.task.list/1.0/';
        const params = {
            api: 'mtop.alimama.union.uc.zhuliang.task.list',
            v: '1.0',
            type: 'GET',
            dataType: 'json',
            appKey: '12574478',
        };
        
        const response = await axios.get(url, { 
            params,
            headers 
        });
        
        if (response.data && response.data.data && response.data.data.taskList) {
            const tasks = response.data.data.taskList;
            console.log(`✅ 获取到 ${tasks.length} 个任务`);
            
            // 逐个完成任务
            for (let i = 0; i < tasks.length; i++) {
                const task = tasks[i];
                console.log(`\n任务${i+1}: ${task.title}`);
                
                // 如果任务已完成，跳过
                if (task.taskStatus === 'FINISHED') {
                    console.log(`✓ 任务已完成，跳过`);
                    continue;
                }
                
                // 开始做任务
                console.log(`🔄 开始做任务: ${task.title}`);
                await doTask(task);
                
                // 等待一下，避免请求过快
                await $.wait(2000);
            }
        } else {
            console.log(`❌ 获取任务列表失败`);
            message += `❌ 获取任务列表失败\n`;
        }
    } catch (e) {
        console.log(`❌ 获取任务列表异常: ${e}`);
        message += `❌ 获取任务列表异常\n`;
    }
}

// 做任务
async function doTask(task) {
    try {
        const url = 'https://api.m.taobao.com/h5/mtop.alimama.union.uc.zhuliang.task.process/1.0/';
        const data = {
            api: 'mtop.alimama.union.uc.zhuliang.task.process',
            v: '1.0',
            type: 'POST',
            dataType: 'json',
            appKey: '12574478',
            data: JSON.stringify({
                taskId: task.taskId,
                taskItemId: task.taskItemId
            }),
        };
        
        const response = await axios.post(url, data, { headers });
        
        if (response.data && response.data.data && response.data.data.status === 'TASK_SUCCESS') {
            console.log(`✅ 任务完成，获得 ${response.data.data.goldAmount || 0} 淘金币`);
            message += `✅ 完成任务【${task.title}】，获得 ${response.data.data.goldAmount || 0} 淘金币\n`;
            completedTasks++;
        } else {
            console.log(`❌ 任务完成失败: ${response.data.data?.status || '未知错误'}`);
        }
    } catch (e) {
        console.log(`❌ 做任务异常: ${e}`);
    }
}

// 每日签到
async function dailySignIn() {
    try {
        console.log('\n开始【淘金币每日签到】...');
        
        const url = 'https://api.m.taobao.com/h5/mtop.alimama.union.uc.zhuliang.sign.sign/1.0/';
        const data = {
            api: 'mtop.alimama.union.uc.zhuliang.sign.sign',
            v: '1.0',
            type: 'POST',
            dataType: 'json',
            appKey: '12574478',
        };
        
        const response = await axios.post(url, data, { headers });
        
        if (response.data && response.data.data && response.data.data.status === 'SIGN_SUCCESS') {
            console.log(`✅ 签到成功，获得 ${response.data.data.goldAmount || 0} 淘金币`);
            message += `✅ 每日签到，获得 ${response.data.data.goldAmount || 0} 淘金币\n`;
            completedTasks++;
        } else if (response.data && response.data.data && response.data.data.status === 'REPEAT_SIGN') {
            console.log(`✓ 今日已签到，无需重复签到`);
            message += `✓ 今日已完成签到\n`;
        } else {
            console.log(`❌ 签到失败: ${response.data.data?.status || '未知错误'}`);
        }
    } catch (e) {
        console.log(`❌ 签到异常: ${e}`);
        message += `❌ 签到异常\n`;
    }
}

// 领取奖励
async function receiveRewards() {
    try {
        console.log('\n开始【领取任务奖励】...');
        
        const url = 'https://api.m.taobao.com/h5/mtop.alimama.union.uc.zhuliang.reward.receive/1.0/';
        const data = {
            api: 'mtop.alimama.union.uc.zhuliang.reward.receive',
            v: '1.0',
            type: 'POST',
            dataType: 'json',
            appKey: '12574478',
        };
        
        const response = await axios.post(url, data, { headers });
        
        if (response.data && response.data.data && response.data.data.status === 'RECEIVE_SUCCESS') {
            console.log(`✅ 奖励领取成功，获得 ${response.data.data.goldAmount || 0} 淘金币`);
            message += `✅ 奖励领取成功，获得 ${response.data.data.goldAmount || 0} 淘金币\n`;
        } else if (response.data && response.data.data && response.data.data.status === 'NO_REWARD') {
            console.log(`✓ 当前无可领取的奖励`);
        } else {
            console.log(`❌ 奖励领取失败: ${response.data.data?.status || '未知错误'}`);
        }
    } catch (e) {
        console.log(`❌ 领取奖励异常: ${e}`);
        message += `❌ 领取奖励异常\n`;
    }
}