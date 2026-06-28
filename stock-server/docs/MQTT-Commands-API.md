# MQTT 命令接口文档

## 概述

本文档描述了系统中 MQTT 命令接口的协议格式和所有支持的命令。

系统通过 MQTT 协议实现远程控制，支持两家券商：
- **方正证券**（founder）：由 `MQTTCommandHandler.js` 处理
- **平安证券**（pingan）：由 `pingan-condition-order.user.js` 处理

## 通信协议

### 消息格式

所有 MQTT 消息都经过 AES 加密传输，解密后的 payload 结构如下：

```json
{
  "id": "客户端ID（用于忽略自己的消息）",
  "msgId": "消息ID（用于去重）",
  "user": "用户标识",
  "msg": "命令内容（JSON字符串）",
  "time": 1700000000000
}
```

### 命令格式

`msg` 字段解析后的命令结构：

```json
{
  "action": "命令名称",
  "data": {
    "provider": "founder|pingan",
    // 其他命令特定参数
  }
}
```

### 响应格式

```json
{
  "action": "response",
  "status": "success|error|partial",
  "data": { },
  "message": "错误信息（仅 error 时）"
}
```

### 命令路由规则

| provider 值 | 处理模块 | 说明 |
|------------|---------|------|
| `pingan` | pingan-condition-order.user.js | 平安证券 |
| `founder` 或未指定 | MQTTCommandHandler.js | 方正证券（缺省） |

---

## 方正证券命令（provider=founder 或未指定）

### 1. get_holdings - 获取持仓列表

获取当前持仓数据。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| provider | string | 否 | 券商类型，缺省为 founder |
| accountType | string | 否 | 账户类型：`normal`（普通）/ `credit`（信用），不传返回全部 |
| forceRefresh | boolean | 否 | 是否强制从服务器刷新，默认 false |

**请求示例：**

```json
{
  "action": "get_holdings",
  "data": {
    "provider": "founder",
    "accountType": "credit",
    "forceRefresh": true
  }
}
```

**响应示例：**

```json
{
  "action": "get_holdings",
  "status": "success",
  "data": {
    "count": 2,
    "accountType": "credit",
    "holdings": [
      {
        "stockCode": "000001",
        "stockName": "平安银行",
        "quantity": 1000,
        "availableQuantity": 800,
        "costPrice": 12.50,
        "currentPrice": 13.00,
        "marketValue": 13000,
        "profit": 500,
        "profitPercent": 4.0,
        "accountType": "credit",
        "provider": "founder"
      }
    ]
  }
}
```

**响应字段说明：**

| 字段 | 类型 | 说明 |
|-----|------|------|
| count | number | 持仓数量 |
| accountType | string | 账户类型 |
| holdings | array | 持仓列表 |
| holdings[].provider | string | 券商来源：`founder`（方正）/ `pingan`（平安） |

---

### 2. list / query - 查询股票列表

查询已添加的股票列表。

**请求参数：** 无

**请求示例：**

```json
{ "action": "list", "data": {} }
```

**响应示例：**

```json
{
  "action": "list",
  "status": "success",
  "data": {
    "stockCount": 2,
    "stockNames": ["平安银行", "浦发银行"],
    "stocks": [
      { "name": "平安银行", "stockCode": "000001", "accountType": "credit" },
      { "name": "浦发银行", "stockCode": "600000", "accountType": "credit" }
    ]
  }
}
```

---

### 3. get_stocks - 获取股票信息

与 `list` 功能相同。

---

### 4. stop - 停止条件单

停止指定股票的所有条件单。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| stockCode | string | 是 | 股票代码 |

**请求示例：**

```json
{ "action": "stop", "data": { "stockCode": "000001" } }
```

**响应示例：**

```json
{
  "action": "stop",
  "status": "success",
  "data": { "success": true },
  "stockCode": "000001"
}
```

---

### 5. buy / create_increase_buy - 创建上涨买入条件单

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| stockCode | string | 是 | 股票代码 |
| percentage | number | 否 | 上涨百分比，默认 0.5 |
| tradeVolume / quantity | number | 否 | 交易数量，默认 100 |
| accountType | string | 否 | 账户类型，默认 credit |
| price | number | 否 | 股票价格 |
| side | string | 否 | 交易方向 |
| endDate | string | 否 | 结束日期（YYYY-MM-DD） |

**请求示例：**

```json
{
  "action": "buy",
  "data": {
    "stockCode": "000001",
    "percentage": 1.0,
    "quantity": 200,
    "accountType": "credit",
    "endDate": "2025-12-31"
  }
}
```

---

### 6. sell / create_decrease_sell - 创建下跌卖出条件单

参数与 `buy` 相同。

---

### 7. create - 创建双向条件单

同时创建上涨买入和下跌卖出条件单。

**请求参数：** 与 `buy` 相同

**请求示例：**

```json
{
  "action": "create",
  "data": {
    "stockCode": "000001",
    "stockName": "平安银行",
    "percentage": 0.5,
    "quantity": 100,
    "accountType": "credit"
  }
}
```

**响应示例：**

```json
{
  "action": "create",
  "status": "success",
  "data": {
    "buy": { "success": true },
    "sell": { "success": true },
    "stockCode": "000001",
    "stockName": "平安银行"
  },
  "stockCode": "000001"
}
```

---

### 8. add - 添加股票并创建条件单

添加股票并创建双向条件单（与 `create` 逻辑相同）。

**请求参数：** 与 `create` 相同

---

### 9. cancel / remove - 取消条件单

取消/移除条件单。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| stockCode | string | 条件 | 股票代码（与 strategyId 二选一） |
| strategyId | string | 条件 | 策略ID（与 stockCode 二选一） |

**请求示例：**

```json
{ "action": "cancel", "data": { "stockCode": "000001" } }
```

或

```json
{ "action": "cancel", "data": { "strategyId": "strategy_123" } }
```

---

### 10. generate_decrease - 批量生成下跌卖出条件单

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| sellPercentage | number | 是 | 卖出百分比 |
| endDate | string | 是 | 结束日期（YYYY-MM-DD） |
| downPercentage | number | 否 | 下跌百分比，默认 1 |

**请求示例：**

```json
{
  "action": "generate_decrease",
  "data": {
    "sellPercentage": 2.0,
    "endDate": "2025-12-31",
    "downPercentage": 1.5
  }
}
```

---

### 11. refresh_grid - 刷新网格策略

从页面 DOM 解析刷新网格策略数据。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| accountType | string | 否 | 账户类型 |

**请求示例：**

```json
{ "action": "refresh_grid", "data": { "accountType": "credit" } }
```

**响应示例：**

```json
{
  "action": "refresh_grid",
  "status": "success",
  "data": {
    "count": 1,
    "strategies": [
      {
        "strategyId": "G001",
        "stockCode": "000001",
        "stockName": "平安银行",
        "taskName": "平安银行网格",
        "status": "运行中",
        "basicPrice": 12.5,
        "priceRange": "11.0-14.0",
        "gridSpacing": 0.5,
        "costFunds": 10000,
        "profit": 500,
        "nowPrice": 13.0
      }
    ]
  }
}
```

---

### 12. list_grid - 查询网格策略列表

**请求参数：** 无

**请求示例：**

```json
{ "action": "list_grid", "data": {} }
```

---

### 13. remove_grid - 删除网格策略

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| id | string | 条件 | 本地策略ID（与 strategyId 二选一） |
| strategyId | string | 条件 | 原始策略ID（与 id 二选一） |

**请求示例：**

```json
{ "action": "remove_grid", "data": { "strategyId": "G001" } }
```

---

### 14. create_grid - 创建网格策略

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| stockCode | string | 是 | 股票代码 |
| stockName | string | 否 | 股票名称 |
| priceLow | number | 是 | 价格区间下限 |
| priceHigh | number | 是 | 价格区间上限 |
| quantityBuy | number | 是 | 每次买入数量 |
| quantitySell | number | 否 | 每次卖出数量 |
| maxFund | number | 否 | 最大资金，默认 50000 |
| expiredTime | string | 否 | 过期时间（YYYY-MM-DD） |
| gridMode | string | 否 | 网格模式：`aggressive`/`balanced`/`conservative`，默认 balanced |

**请求示例：**

```json
{
  "action": "create_grid",
  "data": {
    "stockCode": "000001",
    "stockName": "平安银行",
    "priceLow": 11.0,
    "priceHigh": 14.0,
    "quantityBuy": 100,
    "maxFund": 50000,
    "gridMode": "balanced",
    "expiredTime": "2025-12-31"
  }
}
```

---

## 平安证券命令（provider=pingan）

> 注意：平安证券命令必须指定 `provider: "pingan"`，否则将被忽略。

### 1. get_holdings - 获取持仓列表

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| provider | string | 是 | 必须为 `pingan` |
| forceRefresh | boolean | 否 | 是否强制刷新，默认 false |

**请求示例：**

```json
{
  "action": "get_holdings",
  "data": {
    "provider": "pingan"
  }
}
```

**响应示例：**

```json
{
  "action": "get_holdings",
  "status": "success",
  "data": {
    "count": 1,
    "provider": "pingan",
    "account": "12345678",
    "summary": {
      "dayProfitLossSum": 500.00,
      "totalProfitLossSum": 2000.00
    },
    "holdings": [
      {
        "stockCode": "000001",
        "stockName": "平安银行",
        "quantity": 1000,
        "availableQuantity": 800,
        "costPrice": 12.50,
        "currentPrice": 13.00,
        "marketValue": 13000,
        "profit": 500,
        "profitPercent": 4.0,
        "dayProfitLoss": 100,
        "dayProfitLossPercent": 0.77,
        "accountType": "pingan"
      }
    ]
  }
}
```

---

### 2. add - 添加条件单按钮

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| provider | string | 是 | 必须为 `pingan` |
| stockCode | string | 是 | 股票代码 |
| stockName | string | 否 | 股票名称 |
| tradeVolume | number | 否 | 交易数量，默认 100 |
| percentage | number | 否 | 百分比，默认 0.5 |
| endDate | string | 否 | 结束日期 |
| accountType | string | 否 | 账户类型 |
| seatNo | string | 否 | 席位号 |

**请求示例：**

```json
{
  "action": "add",
  "data": {
    "provider": "pingan",
    "stockCode": "000001",
    "stockName": "平安银行",
    "percentage": 0.5,
    "tradeVolume": 100
  }
}
```

---

### 3. create - 创建条件单

**请求参数：** 与 `add` 相同

---

### 4. buy - 创建买入条件单

**请求参数：** 与 `add` 相同

---

### 5. sell - 创建卖出条件单

**请求参数：** 与 `add` 相同

---

### 6. query - 查询条件单

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| strategyId | string | 否 | 策略ID |
| stockCode | string | 否 | 股票代码 |

---

### 7. cancel - 取消条件单

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| strategyId | string | 否 | 策略ID |
| stockCode | string | 否 | 股票代码 |

---

### 8. remove - 移除按钮

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| stockCode | string | 是 | 股票代码 |

---

### 9. list - 查询条件单列表

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| status | string | 否 | 按状态筛选 |

---

## 心跳机制

### ping 消息

客户端定期发送 ping 消息（默认 30 秒间隔），检测对端是否在线。

```json
{
  "id": "vue_abc123",
  "msgId": "1700000000000_ping",
  "user": "vue_1234",
  "msg": "ping",
  "time": 1700000000000
}
```

### pong 响应

收到 ping 后自动回复 pong：

```json
{
  "id": "mq_def456",
  "msgId": "1700000000001_pong",
  "user": "mq_456",
  "msg": "pong",
  "time": 1700000000001
}
```

**超时机制：** 发送 ping 后 5 秒内未收到 pong，标记对端为离线状态。

---

## 错误处理

所有命令执行失败时返回统一错误格式：

```json
{
  "action": "response",
  "status": "error",
  "message": "错误描述信息"
}
```

常见错误：
- 缺少必要参数
- 股票不存在
- API 调用失败
- 未知命令
