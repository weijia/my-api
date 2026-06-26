/**
 * MQTT Secure Client
 * 基于 MQTT.js + CryptoJS 的加密通信封装
 *
 * 特性：
 * - WebSocket 连接（支持 wss://）
 * - AES-256-CBC 加密（兼容 CryptoJS）
 * - 自动重连
 * - 消息去重
 *
 * 依赖：mqtt, crypto-js
 * npm install mqtt crypto-js
 */

import mqtt from 'mqtt';
import CryptoJS from 'crypto-js';

class MqttSecureClient {
    /**
     * @param {Object} options
     * @param {string} options.broker - MQTT broker URL, e.g. 'wss://broker.emqx.io:8084/mqtt'
     * @param {string} options.topic - 订阅/发布的主题
     * @param {string} options.password - AES 加密密码
     * @param {string} [options.clientId] - 自定义 clientId
     * @param {number} [options.reconnectPeriod=5000] - 重连间隔(ms)
     * @param {Function} [options.onMessage] - 收到消息回调 (sender, text, metadata) => void
     * @param {Function} [options.onConnect] - 连接成功回调 () => void
     * @param {Function} [options.onDisconnect] - 断开连接回调 () => void
     * @param {Function} [options.onError] - 错误回调 (error) => void
     */
    constructor(options) {
        this.broker = options.broker;
        this.topic = options.topic;
        this.password = options.password;
        this.clientId = options.clientId || 'msc_' + Math.random().toString(16).slice(2, 8);
        this.reconnectPeriod = options.reconnectPeriod || 5000;

        this.onMessage = options.onMessage || (() => {});
        this.onConnect = options.onConnect || (() => {});
        this.onDisconnect = options.onDisconnect || (() => {});
        this.onError = options.onError || (() => {});

        this.client = null;
        this.pendingMessages = new Set();
        this.connected = false;
    }

    /** 建立连接 */
    connect() {
        if (this.client) {
            this.client.end(true);
        }

        this.connected = false;

        try {
            this.client = mqtt.connect(this.broker, {
                clientId: this.clientId,
                reconnectPeriod: this.reconnectPeriod,
                connectTimeout: 30000,
                clean: true
            });

            this.client.on('connect', () => {
                this.connected = true;
                this.client.subscribe(this.topic, { qos: 1 }, (err) => {
                    if (err) {
                        this.onError(new Error('Subscribe failed: ' + err.message));
                    } else {
                        this.onConnect();
                    }
                });
            });

            this.client.on('message', (topic, payload) => {
                this._handleMessage(payload.toString());
            });

            this.client.on('close', () => {
                this.connected = false;
                this.onDisconnect();
            });

            this.client.on('error', (err) => {
                this.onError(err);
            });

        } catch (err) {
            this.onError(err);
        }
    }

    /** 断开连接 */
    disconnect() {
        if (this.client) {
            this.client.end(true);
            this.client = null;
            this.connected = false;
        }
    }

    /**
     * 发送加密消息
     * @param {string} text - 要发送的明文
     * @param {Object} [metadata] - 额外元数据
     * @returns {boolean} 是否发送成功
     */
    send(text, metadata = {}) {
        if (!this.connected || !this.client) {
            console.warn('[MqttSecureClient] Not connected');
            return false;
        }

        const msgId = Date.now() + '_' + Math.random().toString(16).slice(2, 6);

        const payload = {
            id: this.clientId,
            msgId: msgId,
            user: metadata.user || 'User_' + this.clientId.slice(-4),
            msg: text,
            time: Date.now(),
            ...metadata
        };

        const cipher = CryptoJS.AES.encrypt(
            JSON.stringify(payload),
            this.password
        ).toString();

        // 防止消息过长
        if (cipher.length > 60000) {
            this.onError(new Error('Message too long after encryption'));
            return false;
        }

        // 记录已发送的消息 ID（防止回环显示）
        this.pendingMessages.add(msgId);
        setTimeout(() => this.pendingMessages.delete(msgId), 5000);

        this.client.publish(this.topic, cipher, { qos: 1 });
        return true;
    }

    /** 内部：处理收到的加密消息 */
    _handleMessage(encryptedData) {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, this.password);
            const raw = bytes.toString(CryptoJS.enc.Utf8);

            if (!raw) {
                console.warn('[MqttSecureClient] Decryption failed - wrong password?');
                return;
            }

            const data = JSON.parse(raw);

            // 忽略自己发送的消息
            if (data.id === this.clientId) {
                return;
            }

            // 忽略已处理的消息
            if (data.msgId && this.pendingMessages.has(data.msgId)) {
                return;
            }

            this.onMessage(data.user || 'Unknown', data.msg, {
                senderId: data.id,
                msgId: data.msgId,
                time: data.time,
                raw: data
            });

        } catch (e) {
            console.warn('[MqttSecureClient] Failed to process message:', e);
        }
    }
}

export default MqttSecureClient;
