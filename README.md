# My API

股票行情服务器 API 文档仓库。

## 目录结构

```
stock-server/
  API_USAGE.md              # 接口使用文档（curl 示例、请求参数、响应格式）
  docs/
    stock_price_api_prd.html   # 产品需求文档（PRD）
    node_config_sync_flow.md   # 节点配置自动同步流程设计
```

## 接口概览

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/config` | GET | 服务器全局配置 |
| `/api/node/config` | GET/POST/DELETE | 节点个性化配置 |
| `/api/realtime/{code}` | GET | 实时行情 |
| `/api/kline/{code}` | GET | K线数据 |
| `/api/intraday/{code}` | GET | 分时数据 |

详见 [stock-server/API_USAGE.md](stock-server/API_USAGE.md)
