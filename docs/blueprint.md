# meditatorMCP 工程蓝图

> **项目目标**：为思考模型（reasoning model）提供一个标准化的外部推理工具，通过调用一个非思考模型（non-reasoning model）来扩展、验证或发散思维链，从而突破单次推理的 token 上限并提升复杂任务质量。

---

## 1. 核心概念

### 1.1 为什么需要 meditatorMCP

现代推理模型（如 DeepSeek-V4-Pro / R1 / o-series）在解决复杂问题时会产生很长的思维链（chain-of-thought）。然而，单次推理存在以下限制：

- **输出 token 上限**：即使上下文窗口很大，单次生成的推理长度仍有限。
- **采样策略单一**：思考模型通常使用固定的推理采样策略，无法在同一任务中灵活切换“严格验证”与“发散探索”。
- **成本与延迟**：长时间推理成本高，部分子任务可以交给更便宜、更快的非思考模型完成。

meditatorMCP 通过 Model Context Protocol（MCP）暴露一个 `chat_agent` 工具，让思考模型在需要时将推理片段外包给非思考模型。

### 1.2 角色定义

| 角色 | 实体 | 职责 |
|---|---|---|
| 思考模型 | DeepSeek-V4-Pro / R1 / o-series 等 | 主导推理、决定何时调用工具、整合工具返回 |
| 非思考模型 | DeepSeek-V4-Flash（非思考模式） | 执行具体的推理外包任务：验证、续推、发散 |
| MCP Server | meditatorMCP | 封装非思考模型，暴露 `chat_agent` 工具 |
| MCP Client | 思考模型所在程序或 IDE 插件 | 发现工具、发起调用、回填结果 |

---

## 2. 系统架构

```text
┌─────────────────────────────────────────────────────────────┐
│                        MCP Client                           │
│  (Reasoning model orchestrator / Claude Desktop / Cursor)   │
└───────────────────────┬─────────────────────────────────────┘
                        │ MCP protocol (stdio / sse / http)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     meditatorMCP Server                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Tool:        │  │ Sampling     │  │ Non-reasoning    │  │
│  │ chat_agent   │──│ mode mapping │──│ model client     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                        │ OpenAI-compatible Chat Completions
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              DeepSeek-V4-Flash (thinking=disabled)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 工具接口

### 3.1 `chat_agent`

让思考模型将一段推理文本交给非思考模型处理。

**参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `input_text` | `string` | 是 | — | 需要处理的推理片段或提示 |
| `reasoning_mode` | `"verify" \| "explore" \| "brainstorm"` | 否 | `"explore"` | 采样策略模式 |
| `max_tokens` | `integer` | 否 | `2048` | 最大输出 token 数 |
| `stop` | `string[]` | 否 | `null` | 停止序列 |

**采样策略映射**（无 `top_k`，使用 `temperature` + `top_p` 等价替代）：

| `reasoning_mode` | `temperature` | `top_p` | 用途 |
|---|---|---|---|
| `verify` | 0.15 | 0.20 | 事实校验、收敛验证、代码检查 |
| `explore` | 0.70 | 0.85 | 继续展开推理、填补中间步骤 |
| `brainstorm` | 1.20 | 0.95 | 发散思维、生成候选假设 |

**返回值**：`string`，非思考模型生成的文本。

### 3.2 使用示例

```json
{
  "name": "chat_agent",
  "arguments": {
    "input_text": "请验证以下推理是否正确：...",
    "reasoning_mode": "verify",
    "max_tokens": 1024
  }
}
```

---

## 4. 关键设计决策

### 4.1 非思考模型必须显式关闭思考模式

DeepSeek-V4-Flash 默认 `thinking=enabled`。为了：

- 保证 `temperature` / `top_p` 生效
- 降低延迟和成本
- 获得直接、非推理链式的输出

每次调用都必须附加：

```python
extra_body={"thinking": {"type": "disabled"}}
```

### 4.2 用 `max_tokens` 控制上下文增长

不硬截断输入，而是通过限制每次工具输出长度来减缓上下文膨胀。思考模型可以在多次调用之间主动做摘要。

### 4.3 不暴露底层采样参数

思考模型不需要理解 `temperature` / `top_p` 的数值含义。通过抽象的 `reasoning_mode` 让其从语义层面选择策略。

---

## 5. 项目结构

```text
meditatorMCP/
├── src/meditator_mcp/
│   ├── __init__.py
│   └── server.py          # FastMCP server，暴露 chat_agent 工具
├── docs/
│   └── blueprint.md        # 本工程蓝图
├── README.md
├── LICENSE
├── .gitignore
└── pyproject.toml          # 项目依赖（待补充）
```

### 5.1 待补充项

- [ ] `pyproject.toml`：声明 `mcp`、`openai` 依赖
- [ ] CI / lint / format 配置
- [ ] 单元测试：验证三种 `reasoning_mode` 的参数映射
- [ ] 集成测试：启动 stdio server，调用 `chat_agent`，验证返回非空
- [ ] 文档：MCP Client 配置示例（Claude Desktop / Cursor / VS Code）
- [ ] 可选：SSE / HTTP 传输模式支持
- [ ] 可选：支持多后端模型切换（SiliconFlow / DeepSeek 官方 / 其他 OpenAI 兼容服务）

---

## 6. 典型工作流

### 6.1 验证场景

```text
思考模型：我需要确认步骤 3 的推导是否正确。
        ↓ 调用 chat_agent(reasoning_mode="verify")
非思考模型：步骤 3 的推导存在一个问题，... 修正后应为 ...
        ↓
思考模型：收到，我修正步骤 3 后继续推理。
```

### 6.2 延长思维链场景

```text
思考模型：当前推理已经接近输出上限，我需要把未完成的思路外包出去。
        ↓ 调用 chat_agent(reasoning_mode="explore")
非思考模型：基于你给出的片段，下一步可以 ...
        ↓
思考模型：将返回结果接回上下文，继续生成最终答案。
```

### 6.3 发散探索场景

```text
思考模型：这个问题可能有多种解法，我先让非思考模型头脑风暴。
        ↓ 调用 chat_agent(reasoning_mode="brainstorm")
非思考模型：给出 3-5 种候选方案 ...
        ↓
思考模型：评估各方案优劣，选择最优路径深入。
```

---

## 7. 安全与隐私

- API key 通过环境变量或 `.test_resources/config.json` 注入，**绝不提交到 Git**。
- `.gitignore` 已排除 `.test_resources/`、`experiments/` 和 `.env*` 文件。
- 生产部署时建议使用密钥管理服务或 MCP Client 的 `env` 配置。

---

## 8.  roadmap

| 阶段 | 目标 |
|---|---|
| v0.1 | 实现 `chat_agent` 工具，支持 stdio 传输，三种 reasoning_mode |
| v0.2 | 补充测试、CI、Client 配置文档 |
| v0.3 | 支持 SSE / HTTP 传输，支持模型后端切换 |
| v0.4 | 增加调用次数上限、上下文摘要建议、调用日志与可观测性 |
