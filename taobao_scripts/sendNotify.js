/**
 * 青龙面板消息通知工具
 * 支持多种通知方式：server酱、pushplus、企业微信等
 */

const querystring = require('querystring');
const $ = new Env();
const timeout = 15000; // 超时时间(单位毫秒)

// =======================================微信server酱通知设置区域===========================================
// SCKEY微信通知
const SCKEY = process.env.PUSH_KEY || '';

// =======================================Bark App通知设置区域===========================================
// 此处填你BarkAPP的信息(IP/设备码，例如：https://api.day.app/XXXXXXXX)
let BARK_PUSH = process.env.BARK_PUSH || '';
// BARK APP推送铃声,铃声列表去APP查看复制填写
let BARK_SOUND = process.env.BARK_SOUND || '';
// BARK APP推送消息的分组, 默认为"QingLong"
let BARK_GROUP = process.env.BARK_GROUP || 'QingLong';

// =======================================PushPlus通知设置区域===========================================
// PUSHPLUS设置区域
const PUSH_PLUS_TOKEN = process.env.PUSH_PLUS_TOKEN || '';
// PUSHPLUS一对多推送的'群组'(数字) 一对一推送不用群组
const PUSH_PLUS_USER = process.env.PUSH_PLUS_USER || '';

// =======================================企业微信机器人通知设置区域===========================================
// 此处填你企业微信机器人的webhook(详见文档 https://work.weixin.qq.com/api/doc/90000/90136/91770)
const QYWX_KEY = process.env.QYWX_KEY || '';

// =======================================企业微信应用消息通知设置区域===========================================
/*
 此处填你企业微信应用消息的值(详见文档 https://work.weixin.qq.com/api/doc/90000/90135/90236)
 环境变量名: QYWX_AM  
 值:  corpid,corpsecret,touser(注:多个成员ID使用|隔开),agentid,消息类型(选填,不填默认文本消息类型)
 注意用,号隔开(英文输入法的逗号)
*/
const QYWX_AM = process.env.QYWX_AM || '';

// =======================================telegram机器人通知设置区域===========================================
// TG_BOT_TOKEN
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || '';
// TG_USER_ID
const TG_USER_ID = process.env.TG_USER_ID || '';
// TG代理设置
const TG_PROXY_HOST = process.env.TG_PROXY_HOST || '';
const TG_PROXY_PORT = process.env.TG_PROXY_PORT || '';
const TG_PROXY_AUTH = process.env.TG_PROXY_AUTH || '';

// =======================================钉钉机器人通知设置区域===========================================
// 此处填你钉钉 webhook 的链接
const DD_BOT_TOKEN = process.env.DD_BOT_TOKEN || '';
// 密钥，机器人安全设置页面，加签一栏下面显示的SEC开头的字符串
const DD_BOT_SECRET = process.env.DD_BOT_SECRET || '';

/**
 * sendNotify 推送通知功能
 * @param text 通知标题
 * @param desp 通知内容
 * @param params 某些推送通知方式点击消息时的跳转链接
 * @param author 作者仓库等信息  例：本通知 By：https://github.com/name/repo
 * @returns {Promise<unknown>}
 */
async function sendNotify(
    text,
    desp,
    params = {},
    author = '\n\n本通知 By：青龙面板'
) {
    // 提供6种通知
    desp += author; // 添加作者信息
    await Promise.all([
        serverNotify(text, desp), // server酱
        pushPlusNotify(text, desp), // pushplus
        qywxBotNotify(text, desp), // 企业微信机器人
        qywxamNotify(text, desp), // 企业微信应用
        tgBotNotify(text, desp), // telegram
        ddBotNotify(text, desp), // 钉钉
        barkNotify(text, desp, params) // bark
    ]);
}

function serverNotify(text, desp) {
    return new Promise((resolve) => {
        if (SCKEY) {
            // server酱2.0/3.0
            const apiUrl = `https://sctapi.ftqq.com/${SCKEY}.send`;
            const body = {
                text,
                desp
            };
            const options = {
                url: apiUrl,
                body: body,
                json: true,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout
            };
            $.post(options, (err, resp, data) => {
                try {
                    if (err) {
                        console.log('server酱发送通知消息失败！！\n', err);
                    } else {
                        data = JSON.parse(data);
                        if (data.code === 0) {
                            console.log('server酱发送通知消息成功🎉\n');
                        } else if (data.code === 40001) {
                            console.log('server酱SCKEY错误或为空\n');
                        } else {
                            console.log(`server酱发送通知消息异常\n${JSON.stringify(data)}`);
                        }
                    }
                } catch (e) {
                    $.logErr(e, resp);
                } finally {
                    resolve(data);
                }
            });
        } else {
            resolve();
        }
    });
}

function pushPlusNotify(text, desp) {
    return new Promise((resolve) => {
        if (PUSH_PLUS_TOKEN) {
            desp = desp.replace(/[\n\r]/g, '<br>'); // 默认为html, 不支持plaintext
            const body = {
                token: `${PUSH_PLUS_TOKEN}`,
                title: `${text}`,
                content: `${desp}`,
                topic: `${PUSH_PLUS_USER}`
            };
            const options = {
                url: 'http://www.pushplus.plus/send',
                body: JSON.stringify(body),
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout
            };
            $.post(options, (err, resp, data) => {
                try {
                    if (err) {
                        console.log(`push+发送${PUSH_PLUS_USER ? '一对多' : '一对一'}通知消息失败！！\n`, err);
                    } else {
                        data = JSON.parse(data);
                        if (data.code === 200) {
                            console.log(`push+发送${PUSH_PLUS_USER ? '一对多' : '一对一'}通知消息完成。\n`);
                        } else {
                            console.log(`push+发送${PUSH_PLUS_USER ? '一对多' : '一对一'}通知消息失败：${data.msg}\n`);
                        }
                    }
                } catch (e) {
                    $.logErr(e, resp);
                } finally {
                    resolve(data);
                }
            });
        } else {
            resolve();
        }
    });
}

function tgBotNotify(text, desp) {
    return new Promise((resolve) => {
        if (TG_BOT_TOKEN && TG_USER_ID) {
            const options = {
                url: `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
                json: {
                    chat_id: TG_USER_ID,
                    text: `${text}\n\n${desp}`,
                    disable_web_page_preview: true
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout
            };
            if (TG_PROXY_HOST && TG_PROXY_PORT) {
                const tunnel = require('tunnel');
                const agent = {
                    https: tunnel.httpsOverHttp({
                        proxy: {
                            host: TG_PROXY_HOST,
                            port: TG_PROXY_PORT * 1,
                            proxyAuth: TG_PROXY_AUTH
                        }
                    })
                };
                Object.assign(options, { agent });
            }
            $.post(options, (err, resp, data) => {
                try {
                    if (err) {
                        console.log('telegram发送通知消息失败！！\n', err);
                    } else {
                        data = JSON.parse(data);
                        if (data.ok) {
                            console.log('Telegram发送通知消息成功🎉\n');
                        } else if (data.error_code === 400) {
                            console.log('请主动给bot发送一条消息并检查接收用户ID是否正确。\n');
                        } else if (data.error_code === 401) {
                            console.log('Telegram bot token 填写错误。\n');
                        }
                    }
                } catch (e) {
                    $.logErr(e, resp);
                } finally {
                    resolve(data);
                }
            });
        } else {
            resolve();
        }
    });
}

function ddBotNotify(text, desp) {
    return new Promise((resolve) => {
        if (DD_BOT_TOKEN) {
            const options = {
                url: `https://oapi.dingtalk.com/robot/send?access_token=${DD_BOT_TOKEN}`,
                json: {
                    msgtype: 'text',
                    text: {
                        content: `${text}\n\n${desp}`
                    }
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout
            };
            if (DD_BOT_SECRET) {
                const crypto = require('crypto');
                const dateNow = Date.now();
                const hmac = crypto.createHmac('sha256', DD_BOT_SECRET);
                hmac.update(`${dateNow}\n${DD_BOT_SECRET}`);
                const result = encodeURIComponent(hmac.digest('base64'));
                options.url = `${options.url}&timestamp=${dateNow}&sign=${result}`;
            }
            $.post(options, (err, resp, data) => {
                try {
                    if (err) {
                        console.log('钉钉发送通知消息失败！！\n', err);
                    } else {
                        data = JSON.parse(data);
                        if (data.errcode === 0) {
                            console.log('钉钉发送通知消息成功🎉\n');
                        } else {
                            console.log(`${data.errmsg}\n`);
                        }
                    }
                } catch (e) {
                    $.logErr(e, resp);
                } finally {
                    resolve(data);
                }
            });
        } else {
            resolve();
        }
    });
}

function qywxBotNotify(text, desp) {
    return new Promise((resolve) => {
        if (QYWX_KEY) {
            const options = {
                url: `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${QYWX_KEY}`,
                json: {
                    msgtype: 'text',
                    text: {
                        content: `${text}\n\n${desp}`
                    }
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout
            };
            $.post(options, (err, resp, data) => {
                try {
                    if (err) {
                        console.log('企业微信机器人发送通知消息失败！！\n', err);
                    } else {
                        data = JSON.parse(data);
                        if (data.errcode === 0) {
                            console.log('企业微信机器人发送通知消息成功🎉\n');
                        } else {
                            console.log(`${data.errmsg}\n`);
                        }
                    }
                } catch (e) {
                    $.logErr(e, resp);
                } finally {
                    resolve(data);
                }
            });
        } else {
            resolve();
        }
    });
}

function qywxamNotify(text, desp) {
    return new Promise((resolve) => {
        if (QYWX_AM) {
            const QYWX_AM_AY = QYWX_AM.split(',');
            const options = {
                url: `https://qyapi.weixin.qq.com/cgi-bin/gettoken`,
                json: {
                    corpid: `${QYWX_AM_AY[0]}`,
                    corpsecret: `${QYWX_AM_AY[1]}`
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout
            };
            $.post(options, (err, resp, data) => {
                try {
                    if (err) {
                        console.log('企业微信应用发送通知消息失败！！\n', err);
                    } else {
                        data = JSON.parse(data);
                        if (data.errcode === 0) {
                            const accesstoken = data.access_token;
                            const options = {
                                url: `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accesstoken}`,
                                json: {
                                    touser: `${QYWX_AM_AY[2]}`,
                                    agentid: `${QYWX_AM_AY[3]}`,
                                    msgtype: 'text',
                                    text: {
                                        content: `${text}\n\n${desp}`
                                    }
                                },
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            };
                            $.post(options, (err, resp, data) => {
                                try {
                                    if (err) {
                                        console.log('企业微信应用发送通知消息失败！！\n', err);
                                    } else {
                                        data = JSON.parse(data);
                                        if (data.errcode === 0) {
                                            console.log('企业微信应用发送通知消息成功🎉\n');
                                        } else {
                                            console.log(`${data.errmsg}\n`);
                                        }
                                    }
                                } catch (e) {
                                    $.logErr(e, resp);
                                } finally {
                                    resolve(data);
                                }
                            });
                        }
                    }
                } catch (e) {
                    $.logErr(e, resp);
                }
            });
        } else {
            resolve();
        }
    });
}

function barkNotify(text, desp, params = {}) {
    return new Promise((resolve) => {
        if (BARK_PUSH) {
            const options = {
                url: BARK_PUSH,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify({
                    title: text,
                    body: desp,
                    sound: BARK_SOUND,
                    group: BARK_GROUP,
                    ...params
                }),
                timeout
            };
            $.post(options, (err, resp, data) => {
                try {
                    if (err) {
                        console.log('Bark APP发送通知消息失败！！\n', err);
                    } else {
                        data = JSON.parse(data);
                        if (data.code === 200) {
                            console.log('Bark APP发送通知消息成功🎉\n');
                        } else {
                            console.log(`${data.message}\n`);
                        }
                    }
                } catch (e) {
                    $.logErr(e, resp);
                } finally {
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
}

function Env() {
    return new class {
        constructor() {}
        
        post(options, callback = () => {}) {
            const method = options.method ? options.method.toLocaleLowerCase() : 'post';
            
            // 如果指定了请求体, 但没指定`Content-Type`, 则自动生成
            if (options.body && options.headers && !options.headers['Content-Type']) {
                options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }
            
            if (options.headers) delete options.headers['Content-Length'];
            
            try {
                require('request')[method](options, callback);
            } catch (e) {
                this.logErr(e, options);
                callback(e);
            }
        }
        
        logErr(err, options) {
            console.log(err);
        }
    }
}

module.exports = {
    sendNotify,
    BARK_PUSH,
    BARK_SOUND,
    BARK_GROUP,
    TG_BOT_TOKEN,
    TG_USER_ID,
    TG_PROXY_HOST,
    TG_PROXY_PORT,
    TG_PROXY_AUTH,
    DD_BOT_TOKEN,
    DD_BOT_SECRET,
    QYWX_KEY,
    QYWX_AM,
    PUSH_PLUS_TOKEN,
    PUSH_PLUS_USER,
    SCKEY
};