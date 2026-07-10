# MQTT Secure Client

## 概述

本项目包含平安证券脚本 (pingan-condition-order.user.js) 使用的 MQTT 安全通信客户端实现。

## MQTT 消息协议

### 消息格式

所有 MQTT 消息均经过 AES 加密传输：

```json
{
  "id": "客户端ID（用于忽略自身消息）",
  "msgId": "消息ID（用于去重）",
  "user": "用户标识",
  "msg": "命令内容（JSON字符串）",
  "time": 1700000000000
}
```

### 加密方式

- 算法：AES（CryptoJS）
- 密钥：与 Broker 配置的 password 一致
- 消息体加密后通过 MQTT Publish 发送

### 心跳机制

- ping/pong 双向检测
- 默认 30 秒心跳间隔
- 5 秒超时判定离线

## 平安证券支持的命令（provider=pingan）

| 命令 | 说明 |
|------|------|
| `get_holdings` | 获取平安证券持仓列表 |
| `list_strategies` | 获取平安证券全部策略单列表 |
| `add` | 添加条件单按钮 |
| `create` | 创建双向条件单 |
| `buy` | 创建买入条件单 |
| `sell` | 创建卖出条件单 |
| `query` | 查询条件单 |
| `cancel` | 取消条件单 |
| `remove` | 移除按钮 |
| `list` | 查询已添加的条件单列表 |

## 平安证券 API

详见 [stock-server/docs/PingAn-API.md](../stock-server/docs/PingAn-API.md)

### 策略单列表 API

`POST https://m.stock.pingan.com/restapi/past/queryMyYmdForPage`

通过 `list_strategies` MQTT 命令获取平安证券的全部策略单数据，包括：
- 网格交易 (strategy_id=12)
- 回落卖出 (strategy_id=7)
- 反弹买入 (strategy_id=8)
- 止盈止损 (strategy_id=23)
- 定期定投 (strategy_id=15)
- ETF网格交易 (strategy_id=34)
- 可转债网格 (strategy_id=35)
- 国债逆回购 (strategy_id=39)
- 涨跌幅条件单 (strategy_id=22)
- 价格条件单 (strategy_id=21)
- 均线条件单 (strategy_id=38)

## 多 Agent 共存

- 通过 `id` 字段区分消息来源
- 自动忽略自身发出的消息
- 所有 Agent 使用相同密码才能互通
