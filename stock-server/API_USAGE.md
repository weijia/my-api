# 股票实时价格 HTTP 服务 — API 调用文档

> 本文档面向 AI Agent 和开发者，描述如何调用股票价格 HTTP 服务的所有接口。
> 服务基于 Python 标准库 `http.server` 构建，零外部依赖。

## 启动服务

```bash
cd stock/trend
python stock_price_server.py --port 8080
```

服务默认监听 `0.0.0.0:8080`。

---

## 统一响应格式

所有接口返回相同的 JSON 结构：

```json
{
  "code": 200,
  "data": { ... },
  "message": "success",
  "timestamp": "2026-06-19T10:00:00"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | int | 业务状态码（与 HTTP 状态码一致） |
| data | object/null | 业务数据，错误时为 null |
| message | string | 状态描述 |
| timestamp | string | ISO 8601 时间戳 |

### 错误码

| code | 含义 | 说明 |
|------|------|------|
| 200 | 成功 | 正常返回数据 |
| 400 | 参数错误 | 缺少必填参数或参数格式错误 |
| 404 | 路径不存在 | 返回可用接口列表 |
| 500 | 服务器错误 | 内部异常（不暴露堆栈） |
| 503 | 数据源不可用 | Provider 异常或超时 |

---

## 接口列表

### 1. 健康检查

```
GET /api/health
```

检查服务是否正常运行，返回运行时长和 Provider 统计。

**curl 示例：**

```bash
curl http://localhost:8080/api/health
```

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "uptime": "2h 15m 30s",
    "uptime_seconds": 8130,
    "provider_total": 8,
    "provider_available": 6
  },
  "message": "success",
  "timestamp": "2026-06-19T10:00:00"
}
```

---

### 2. Provider 状态

```
GET /api/providers
```

返回所有数据 Provider 的列表和状态信息。

**curl 示例：**

```bash
curl http://localhost:8080/api/providers
```

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "count": 8,
    "providers": [
      {"name": "腾讯批量实时Provider", "priority": 0, "available": true},
      {"name": "通达信TCP行情Provider", "priority": 1, "available": true},
      {"name": "新浪A股数据Provider", "priority": 2, "available": true}
    ]
  },
  "message": "success",
  "timestamp": "2026-06-19T10:00:00"
}
```

---

### 3. 单只股票实时行情

```
GET /api/realtime/{code}
```

获取单只股票的实时行情快照。数据源为腾讯财经批量接口，回退到 Provider 架构。

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| code | string | 股票代码（6位数字，如 000001、600036） |

**curl 示例：**

```bash
# 查询平安银行
curl http://localhost:8080/api/realtime/000001

# 查询招商银行
curl http://localhost:8080/api/realtime/600036

# 查询上证50ETF
curl http://localhost:8080/api/realtime/510050
```

**Python 调用示例：**

```python
import urllib.request
import json

def get_realtime(code: str) -> dict:
    url = f"http://localhost:8080/api/realtime/{code}"
    resp = urllib.request.urlopen(url, timeout=10)
    return json.loads(resp.read().decode('utf-8'))

result = get_realtime("000001")
print(f"平安银行: {result['data']['price']}元, 涨跌幅: {result['data']['change_pct']}%")
```

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "name": "平安银行",
    "price": 10.78,
    "last_close": 10.62,
    "open": 10.65,
    "high": 10.99,
    "low": 10.55,
    "change_amt": 0.16,
    "change_pct": 1.51,
    "volume": 523438.0,
    "amount": 56782.0,
    "turnover_pct": 0.27,
    "pe_ttm": 4.82,
    "amplitude_pct": 4.14,
    "mcap_yi": 2098.5,
    "float_mcap_yi": 2098.5,
    "pb": 0.52,
    "limit_up": 11.68,
    "limit_down": 9.56,
    "vol_ratio": 0.85,
    "pe_static": 4.65
  },
  "message": "success",
  "timestamp": "2026-06-19T10:00:00"
}
```

**返回字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 股票名称 |
| price | float | 当前价格（元） |
| last_close | float | 昨日收盘价 |
| open | float | 今日开盘价 |
| high | float | 今日最高价 |
| low | float | 今日最低价 |
| change_amt | float | 涨跌额（元） |
| change_pct | float | 涨跌幅（%） |
| volume | float | 成交量（手） |
| amount | float | 成交额（万元） |
| turnover_pct | float | 换手率（%） |
| pe_ttm | float | 滚动市盈率 |
| pb | float | 市净率 |
| mcap_yi | float | 总市值（亿元） |
| float_mcap_yi | float | 流通市值（亿元） |
| limit_up | float | 涨停价 |
| limit_down | float | 跌停价 |

---

### 4. 批量实时行情

```
GET /api/realtime/batch?codes={codes}
```

一次请求获取多只股票的实时行情。基于腾讯财经批量接口，单次最多 800 只，响应时间 < 1 秒。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| codes | string | 是 | 逗号分隔的股票代码列表，最多 800 只 |

**curl 示例：**

```bash
# 批量查询3只股票
curl "http://localhost:8080/api/realtime/batch?codes=000001,600036,510050"

# 批量查询10只股票
curl "http://localhost:8080/api/realtime/batch?codes=000001,600036,510050,300476,002594,601318,000858,600519,300750,002415"
```

**Python 调用示例：**

```python
import urllib.request
import json

def get_realtime_batch(codes: list) -> dict:
    codes_str = ",".join(codes)
    url = f"http://localhost:8080/api/realtime/batch?codes={codes_str}"
    resp = urllib.request.urlopen(url, timeout=10)
    return json.loads(resp.read().decode('utf-8'))

result = get_realtime_batch(["000001", "600036", "510050"])
print(f"成功获取 {result['data']['count']}/{result['data']['total_requested']} 只")

for code, info in result['data']['data'].items():
    print(f"  {info['name']}({code}): {info['price']}元 ({info['change_pct']:+.2f}%)")
```

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "count": 3,
    "total_requested": 3,
    "data": {
      "000001": {
        "name": "平安银行",
        "price": 10.78,
        "change_pct": 1.51,
        "pe_ttm": 4.82,
        "pb": 0.52,
        "mcap_yi": 2098.5
      },
      "600036": {
        "name": "招商银行",
        "price": 35.20,
        "change_pct": -0.45,
        "pe_ttm": 6.12,
        "pb": 0.85,
        "mcap_yi": 8865.0
      },
      "510050": {
        "name": "上证50ETF",
        "price": 2.543,
        "change_pct": 0.32,
        "pe_ttm": 10.85,
        "pb": 1.12,
        "mcap_yi": 1526.0
      }
    }
  },
  "message": "success",
  "timestamp": "2026-06-19T10:00:00"
}
```

---

### 5. 历史K线数据

```
GET /api/kline/{code}?days={days}
```

获取股票的历史日K线数据。数据源按优先级自动选择：腾讯批量 → mootdx TCP → 新浪 → akshare。

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| code | string | 股票代码 |

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 范围 | 说明 |
|------|------|------|--------|------|------|
| days | int | 否 | 30 | 1-500 | 获取最近N天的日线数据 |

**curl 示例：**

```bash
# 获取最近30天K线
curl "http://localhost:8080/api/kline/000001?days=30"

# 获取最近90天K线
curl "http://localhost:8080/api/kline/600036?days=90"

# 获取最近1年K线
curl "http://localhost:8080/api/kline/510050?days=250"
```

**Python 调用示例：**

```python
import urllib.request
import json

def get_kline(code: str, days: int = 30) -> dict:
    url = f"http://localhost:8080/api/kline/{code}?days={days}"
    resp = urllib.request.urlopen(url, timeout=15)
    return json.loads(resp.read().decode('utf-8'))

result = get_kline("000001", days=30)
data = result['data']
print(f"平安银行: {data['count']}条K线数据")

# 取最近一条
latest = data['data'][-1]
print(f"  最新: {latest['date']} 收盘{latest['close']}")

# 取最早一条
earliest = data['data'][0]
print(f"  最早: {earliest['date']} 收盘{earliest['close']}")
```

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "code": "000001",
    "count": 30,
    "days": 30,
    "data": [
      {
        "date": "2026-05-11",
        "open": 10.50,
        "high": 10.80,
        "low": 10.45,
        "close": 10.72,
        "volume": 456789
      },
      {
        "date": "2026-05-12",
        "open": 10.72,
        "high": 10.95,
        "low": 10.60,
        "close": 10.88,
        "volume": 523456
      }
    ]
  },
  "message": "success",
  "timestamp": "2026-06-19T10:00:00"
}
```

**data 数组每条记录字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| date | string | 日期（YYYY-MM-DD） |
| open | float | 开盘价 |
| high | float | 最高价 |
| low | float | 最低价 |
| close | float | 收盘价 |
| volume | float | 成交量 |

---

### 6. 趋势判定

```
GET /api/trend/{code}?days={days}
```

获取股票的趋势判定结果，包含趋势方向、波动率、价格下跌指标等。

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| code | string | 股票代码 |

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 范围 | 说明 |
|------|------|------|--------|------|------|
| days | int | 否 | 90 | 5-500 | 用于计算趋势的历史天数 |

**curl 示例：**

```bash
# 获取趋势判定（默认90天）
curl "http://localhost:8080/api/trend/000001"

# 获取趋势判定（30天）
curl "http://localhost:8080/api/trend/600036?days=30"
```

**Python 调用示例：**

```python
import urllib.request
import json

def get_trend(code: str, days: int = 90) -> dict:
    url = f"http://localhost:8080/api/trend/{code}?days={days}"
    resp = urllib.request.urlopen(url, timeout=20)
    return json.loads(resp.read().decode('utf-8'))

result = get_trend("000001", days=90)
trend = result['data']['trend']
print(f"平安银行 趋势: {trend['trend']}")
print(f"  日波动率: {trend.get('volatility_daily', 'N/A')}")
print(f"  当前价: {trend.get('current_price', 'N/A')}")
print(f"  最高价: {trend.get('max_high_price', 'N/A')}")
print(f"  下跌比率: {trend.get('price_drop_ratio', 'N/A')}%")
```

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "code": "000001",
    "days": 90,
    "data_points": 85,
    "trend": {
      "trend": "下降",
      "volatility_daily": 1.82,
      "price_range_volatility": 15.6,
      "current_price": 10.78,
      "max_high_price": 12.50,
      "price_drop_value": 1.72,
      "price_drop_ratio": 13.76
    }
  },
  "message": "success",
  "timestamp": "2026-06-19T10:00:00"
}
```

**trend 对象字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| trend | string | 趋势方向：上升/下降/震荡/unknown |
| volatility_daily | float/null | 日波动率（%） |
| price_range_volatility | float/null | 价格区间波动率（%） |
| current_price | float/null | 当前价格 |
| max_high_price | float/null | 区间最高价 |
| price_drop_value | float/null | 从最高价的下跌值 |
| price_drop_ratio | float/null | 从最高价的下跌比率（%） |

> 注意：当数据不足时，波动率和下跌指标可能为 null。

---

## AI Agent 调用指南

### 快速开始

其他 AI Agent 可以通过以下步骤调用本服务：

1. **确认服务可用**：先调用 `/api/health` 检查服务状态
2. **获取实时价格**：调用 `/api/realtime/{code}` 或 `/api/realtime/batch`
3. **获取历史数据**：调用 `/api/kline/{code}?days=N`
4. **获取趋势分析**：调用 `/api/trend/{code}?days=N`

### 推荐调用模式

```
1. GET /api/health                    → 确认服务在线
2. GET /api/realtime/batch?codes=...  → 批量获取价格（最快，<1秒）
3. GET /api/kline/{code}?days=30      → 按需获取历史K线
4. GET /api/trend/{code}?days=90      → 按需获取趋势判定
```

### 性能参考

| 接口 | 响应时间 | 说明 |
|------|---------|------|
| /api/health | < 10ms | 本地计算 |
| /api/providers | < 10ms | 本地缓存 |
| /api/realtime/{code} | < 1s | 腾讯接口 |
| /api/realtime/batch | < 1s | 腾讯批量（800只） |
| /api/kline/{code} | 1-5s | 取决于 Provider |
| /api/trend/{code} | 2-10s | 需先获取数据再计算 |

### 错误处理建议

```python
import urllib.request
import json

def call_api(url: str, timeout: int = 10) -> dict:
    try:
        resp = urllib.request.urlopen(url, timeout=timeout)
        result = json.loads(resp.read().decode('utf-8'))
        if result['code'] == 200:
            return result
        else:
            print(f"API 错误 [{result['code']}]: {result['message']}")
            return result
    except Exception as e:
        print(f"请求失败: {e}")
        return {"code": -1, "data": None, "message": str(e)}

# 使用示例
result = call_api("http://localhost:8080/api/realtime/000001")
if result['code'] == 200 and result['data']:
    price = result['data'].get('price', 0)
    print(f"价格: {price}")
```

---

## 股票代码格式

| 市场 | 代码格式 | 示例 |
|------|---------|------|
| 深圳A股 | 0xxxxx | 000001（平安银行）、002594（比亚迪） |
| 上海A股 | 6xxxxx | 600036（招商银行）、601318（中国平安） |
| 创业板 | 3xxxxx | 300750（宁德时代）、300476（胜宏科技） |
| ETF | 1xxxxx / 5xxxxx | 510050（上证50ETF）、159915（创业板ETF） |
| 北交所 | 8xxxxx | 830799（艾融软件） |
| 港股 | 5位数字 | 01810（小米集团） |

> 注意：港股代码目前仅支持通过 akshare 获取，不支持腾讯批量接口。

---

### 7. 服务器配置信息

```
GET /api/config[?section={section}]
```

获取服务器全局配置信息，包括版本、数据源可用性、支持的市场、API 能力、操作限制等。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| section | string | 否 | 过滤指定部分：`server`、`sources`、`markets`、`capabilities`、`limits` |

**curl 示例：**

```bash
# 获取完整配置
curl http://localhost:8080/api/config

# 只获取数据源状态
curl "http://localhost:8080/api/config?section=sources"

# 只获取 API 能力
curl "http://localhost:8080/api/config?section=capabilities"
```

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "server": {
      "version": "1.1.0",
      "start_time": "2026-06-25T10:00:00",
      "uptime_seconds": 3600,
      "data_source": "mootdx"
    },
    "sources": {
      "mootdx_tcp": true,
      "tushare": false
    },
    "markets": ["A股", "ETF", "港股"],
    "capabilities": {
      "realtime_single": true,
      "kline_historical": true,
      "intraday_minutes": true,
      "health_check": true,
      "config_query": true
    },
    "limits": {
      "kline_max_days": 500,
      "kline_min_days": 1,
      "intraday_max_minutes": 240
    }
  },
  "message": "success",
  "timestamp": "2026-06-25T11:00:00"
}
```

---

### 8. 节点配置管理

节点（Node）指每个客户端实例（如安卓设备），通过 `X-Node-ID` 请求头标识身份。节点配置存储在 GitHub app-config 仓库中，按节点分文件管理。

#### 8.1 获取节点配置

```
GET /api/node/config
Headers: X-Node-ID: {node_id}
```

获取当前节点的个性化配置。首次请求时自动创建默认配置。

**请求头：**

| Header | 必填 | 说明 |
|--------|------|------|
| X-Node-ID | 是 | 节点唯一标识（客户端 UUID） |

**curl 示例：**

```bash
curl -H "X-Node-ID: android-a1b2c3d4" http://localhost:8080/api/node/config
```

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "node_id": "android-a1b2c3d4",
    "node_name": "客厅平板",
    "created_at": "2026-06-25T10:00:00",
    "updated_at": "2026-06-25T14:30:00",
    "watchlist": {
      "stocks": ["600519", "300750", "00700"],
      "groups": [{"name": "白酒", "codes": ["600519", "000858"]}]
    },
    "refresh": {
      "realtime_interval_sec": 5,
      "auto_refresh": true
    },
    "alert": {
      "price_change_threshold_pct": 2.0,
      "enabled": true,
      "quiet_hours": {"start": "23:00", "end": "09:00"}
    },
    "display": {
      "theme": "dark",
      "decimal_places": 2
    }
  },
  "message": "success",
  "timestamp": "2026-06-25T14:30:00"
}
```

#### 8.2 更新节点配置

```
POST /api/node/config
Headers: X-Node-ID: {node_id}
Content-Type: application/json
```

增量更新节点配置，只传需要修改的字段，未传字段保持原值。

**请求体示例：**

```json
{
  "node_name": "客厅平板",
  "watchlist": {
    "stocks": ["600519", "300750"]
  },
  "alert": {
    "price_change_threshold_pct": 1.5
  }
}
```

**curl 示例：**

```bash
curl -X POST \
  -H "X-Node-ID: android-a1b2c3d4" \
  -H "Content-Type: application/json" \
  -d '{"watchlist":{"stocks":["600519"]},"alert":{"price_change_threshold_pct":3.0}}' \
  http://localhost:8080/api/node/config
```

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "node_id": "android-a1b2c3d4",
    "node_name": "客厅平板",
    "updated_at": "2026-06-25T15:00:00",
    "watchlist": {
      "stocks": ["600519"],
      "groups": [{"name": "白酒", "codes": ["600519", "000858"]}]
    },
    "refresh": {
      "realtime_interval_sec": 5,
      "auto_refresh": true
    },
    "alert": {
      "price_change_threshold_pct": 3.0,
      "enabled": true,
      "quiet_hours": {"start": "23:00", "end": "09:00"}
    },
    "display": {
      "theme": "dark",
      "decimal_places": 2
    }
  },
  "message": "success",
  "timestamp": "2026-06-25T15:00:00"
}
```

#### 8.3 重置节点配置

```
DELETE /api/node/config
Headers: X-Node-ID: {node_id}
```

将节点配置重置为默认值。

**curl 示例：**

```bash
curl -X DELETE -H "X-Node-ID: android-a1b2c3d4" http://localhost:8080/api/node/config
```

#### 8.4 节点配置存储结构

节点配置保存在 GitHub app-config 仓库中，按节点分文件存储：

```
app-config/
  stock-server/
    default_config.json        # 默认配置（所有新节点的初始值）
    nodes/
      android-a1b2c3d4.json    # 单个节点配置
      android-e5f67890.json
```

**默认配置文件（default_config.json）：**

```json
{
  "refresh": {
    "realtime_interval_sec": 5,
    "auto_refresh": true
  },
  "alert": {
    "price_change_threshold_pct": 2.0,
    "enabled": true,
    "quiet_hours": {"start": "23:00", "end": "09:00"}
  },
  "display": {
    "theme": "dark",
    "decimal_places": 2
  }
}
```

#### 8.5 客户端初始化流程

```
客户端启动
    │
    ├─ 读取本地 SharedPreferences 中的 node_id
    │   ├─ 有 → 使用已有 node_id
    │   └─ 无 → 生成 UUID，保存到 SharedPreferences
    │
    ▼
GET /api/config → 了解服务器能力
    │
    ▼
GET /api/node/config (X-Node-ID: xxx)
    │
    ├─ 200 → 使用返回的配置
    └─ 404 → POST /api/node/config 创建默认配置
    │
    ▼
按配置加载关注股票、刷新间隔、告警阈值...
```
