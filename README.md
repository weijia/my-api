# My API

股票行情服务器 API 文档仓库。

## 目录结构

```
stock-server/
  API_USAGE.md              # 接口使用文档（curl 示例、请求参数、响应格式）
  docs/
    stock_price_api_prd.html   # 产品需求文档（PRD）
    node_config_sync_flow.md   # 节点配置自动同步流程设计
    MQTT-Commands-API.md       # MQTT 命令接口文档（远程控制）
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

## MQTT 远程控制

通过 MQTT 协议实现远程控制，支持方正证券和平安证券两家券商。

| 文档 | 说明 |
|------|------|
| [MQTT 命令接口](stock-server/docs/MQTT-Commands-API.md) | MQTT 命令协议、命令列表、参数说明 |
| [MQTT Secure Client](mqtt-secure-client/README.md) | 加密 MQTT 客户端封装 |

### 支持的命令

**方正证券**：`get_holdings`、`list`、`stop`、`buy`、`sell`、`create`、`add`、`cancel`、`generate_decrease`、`refresh_grid`、`list_grid`、`remove_grid`、`create_grid`

**平安证券**：`get_holdings`、`add`、`create`、`buy`、`sell`、`query`、`cancel`、`remove`、`list`
