# Luna 工作流

这是一个同时支持 Pi 和 Codex 的工程工作流。模型角色和推理强度集中维护在 [`workflow/roles.json`](workflow/roles.json)：

- `gpt-6-luna`、`max`：主代理和复查员；
- `gpt-6-astra`、`low`：在重要不确定点提供建议的顾问；
- 主代理负责实现、直接检查和最终判断；非琐碎改动完成直接检查后，再交给独立 Luna 复查。

通用约定在 [`skills/luna-workflow/references/workflow-contract.md`](skills/luna-workflow/references/workflow-contract.md)。仓库根部的 Pi extension 保留 Pi 适配器和只读 preflight；Codex 适配器从角色表生成 agent 配置，并链接共享 skill。

> **许可证说明：** 本仓库是公开可见的，但有意声明为 `UNLICENSED`。公开可见不等于授予复用、再发布或发布修改副本的权利。如果政策改变，请单独选择并添加许可证。

## 安装

安装前请先阅读 extension 源码。Pi package 会以 Pi 进程本身的权限执行。

```bash
pi install git:github.com/cocojojo5213/pi-luna-workflow
```

重启 Pi，或在现有会话中运行 `/reload`。移除命令如下：

```bash
pi remove git:github.com/cocojojo5213/pi-luna-workflow
```

如果要安装到项目范围，在 install 和 remove 命令中都加上 `-l`。

## 配置模型角色

模型更新时修改 `workflow/roles.json`。Codex agent profile 直接使用角色表中的模型名。Pi 需要已配置的 provider 名称；设置一次后，extension 会与共享模型名组合。下面的 provider 名称是占位符：

```bash
export LUNA_WORKFLOW_PI_PROVIDER=your-provider
```

也可以用 `provider/model` 格式覆盖单个 Pi 角色：

```bash
export LUNA_WORKFLOW_PARENT_MODEL=your-provider/gpt-6-luna
export LUNA_WORKFLOW_LUNA_MODEL=your-provider/gpt-6-luna
export LUNA_WORKFLOW_ADVISOR_MODEL=your-provider/gpt-6-astra
export LUNA_WORKFLOW_ADVISOR_THINKING=low
```

`LUNA_WORKFLOW_PARENT_MODEL` 指定可启用工作流的主模型。未设置时，先沿用显式 Luna 路由；否则使用 `workflow/roles.json` 的 `primary` 角色和 `LUNA_WORKFLOW_PI_PROVIDER`。当前主 session 必须选择这个模型并使用 `max`。

`LUNA_WORKFLOW_LUNA_MODEL` 覆盖共享的 `reviewer` 路由，并用于 Pi preflight 和复查子进程。`LUNA_WORKFLOW_ADVISOR_MODEL` 与 `LUNA_WORKFLOW_ADVISOR_THINKING` 覆盖共享 `advisor` 角色。旧变量 `LUNA_WORKFLOW_SOL_MODEL` 仍可通过旧版 `sol_consult` 使用。路由缺失时会显示配置警告并禁用对应工具，不会静默换用其他模型。

## 安装或更新 Codex

在本仓库 checkout 中运行：

```bash
npm run sync:codex
```

脚本会将共享 skill 链接到 `$CODEX_HOME/skills`（默认 `~/.codex/skills`），并同步 `$CODEX_HOME/agents` 下的 `astra_consult` 和 `luna_reviewer`。同名且只读的 agent 配置会保留原有说明，只更新模型和推理强度；其他冲突文件保持不变。拉取仓库更新后再次运行即可刷新模型设置。重启 Codex 或新开 session 后加载更改；仓库更新不会切换正在运行的 session 主模型。

通过共享主代理角色启动新的 Codex session：

```bash
npm run start:codex -- [Codex 参数]
```

启动器会选择配置中的主模型并使用 `max`。更新 `workflow/roles.json` 后，新启动的 session 会沿用更新后的模型。

可选的进程设置：

```bash
export LUNA_WORKFLOW_PI_COMMAND=pi
export LUNA_WORKFLOW_CHILD_TIMEOUT_MS=720000
```

`LUNA_WORKFLOW_PI_COMMAND` 可以指向可信的 Pi wrapper 或可执行文件。`LUNA_WORKFLOW_CHILD_TIMEOUT_MS` 接受 1000 到 3600000 毫秒，默认值是 720000。

默认的 child guard 已随本 package 提供。高级用户可以用兼容的可信 extension 替换它：

```bash
export LUNA_WORKFLOW_CHILD_GUARD_PATH=/absolute/path/to/readonly-guard.ts
```

如果 provider 是由 extension 注册，而不是由 Pi 的普通模型配置注册，可以把可信的 provider extension 提供给隔离子进程。多个路径使用当前平台的 path delimiter 分隔：

```bash
export LUNA_WORKFLOW_CHILD_EXTENSION_PATHS=/absolute/path/to/provider-extension.ts
```

这些额外 extension 不属于本项目，会在 child 进程中执行。不要把这个变量指向未经审阅的 extension。

用主模型和最高 thinking level 启动 Pi session：

```bash
npm run start:pi -- [Pi 参数]
```

本 package 有意不代替用户修改 Pi settings 或凭据。

## 工作流

### Preflight

在符合条件的父 session 中，普通自然语言请求会启动一个 no-session 子进程，配置如下：

- 使用配置的 Luna 模型和 `max` thinking；
- 只有 `read`、`grep`、`find` 和 `ls`；
- 没有 session、项目 context 文件、skills、prompt templates 或环境中的其他 extension；
- 使用随包提供的只读 guard，拒绝写操作、非只读工具、工作目录以外的路径，以及常见凭据/配置位置的直接路径；
- 有界输出和可配置超时。

子进程会收到当前工作目录、有限的最近 user/assistant 文本上下文以及未改写的原始请求。它必须返回以下八个 Markdown 顶级章节：

- `USER_INTENT`
- `IN_SCOPE`
- `OUT_OF_SCOPE`
- `ACCEPTANCE_CRITERIA`
- `REPOSITORY_FOCUS`
- `IMPLEMENTATION_GUIDANCE`
- `VERIFICATION`
- `RISKS_AND_OPEN_QUESTIONS`

brief 只是 advisory。原始请求仍然具有最高优先级，主 agent 必须在编辑前重新核对 repository facts。如果 preflight 失败或超时，会以可操作的失败信息交给主 agent；主 agent 会依据原始请求继续，而不会静默停止。

extension command、slash command、steering message、空输入和带图片请求会跳过自动 preflight。本 extension 不实现自动紧急判断。

### Review

只有在父模型是配置的模型且 thinking 为 `max` 时，`luna_review` 才会激活。主 agent 应在完成非平凡本地或共享工作流实现及直接检查后再调用它。

该工具要求提供：

- 原始任务；
- 可观察的验收标准；
- 有界的实际 diff，不能用摘要代替 diff；
- 已运行检查的准确结果；
- 仅用于上下文的相关文件。

review 子进程使用新的 no-session 只读 Pi 进程运行一次，不能执行命令或编辑文件。主 agent 必须处理具体 findings，并保留最终验证和判断。前一个请求的 review 不能满足同一对话中的后一个请求。

### Astra 顾问

符合 Luna-Max 主代理 gate 且顾问路由已配置时，`advisor_consult` 会激活。默认读取 `workflow/roles.json` 中的 `advisor` 角色：Astra、`low`。当尚未解决的不确定点可能明显改变设计、范围、安全性或正确性时调用。它提供显式只读建议，不会自动升级。

每次调用都要求提供：

- 一个精确问题；
- 一个原因：`uncertainty`、`architecture`、`security`、`persistent-host`、`public-contract`、`failed-verification` 或 `user-requested`；
- 紧凑的上下文和证据；
- 可选的有界 diff 和验证结果。

顾问子进程使用角色配置的 thinking level，并以 `--no-tools` 和 `--no-session` 运行。它不能检查文件、编辑、部署，也不能取代主 agent 的实现或最终判断。设置 `LUNA_WORKFLOW_SOL_MODEL` 时，旧的 `sol_consult` 仍可作为 `max` 路由使用。

## 命令和 Gate

本 extension 注册：

- `/supervisor status`：报告 session gate 和配置状态；
- `/supervisor on` 与 `/supervisor off`：修改当前 session 的工作流开关；
- `luna_review`：只在配置的父模型和 `max` thinking 下激活；
- `advisor_consult`：只在同一 gate 通过且配置了顾问路由时激活；
- 旧版 `sol_consult`：只在配置了旧路由时激活。

工作流开关作为 Pi session entry 保存，因此跟随当前 session branch；它不会写入全局设置。

不匹配配置的 Luna 模型或 thinking 不是 `max` 的父 session，不会获得 review 或咨询工具。切换模型或 thinking level 时，active-tool gate 会同步更新。

## 安全和隐私

Pi extension 会以 Pi 进程的宿主权限运行。安装前请审阅源码，也要把可选的 child extension 路径视为代码执行入口。

本 package 本身：

- 不含 provider endpoint、硬编码 key 路径、API key、session 文件、宿主专用绝对路径、daemon、listener、timer 或 telemetry；
- 将模型名称传给 child Pi 进程，但不在命令行传递 API key；
- 将 provider authentication 留给 Pi 已配置的 provider runtime；
- 以 no-session 启动 preflight/review child，并禁用环境中的 extension、skills、prompt templates 和 context files；
- 只给这些 child `read`、`grep`、`find` 和 `ls`，并为选定工作目录增加路径 guard；
- 完全不给 Astra 顾问和旧版 Sol 咨询子进程工具；
- 限制 child 输出，并把 child 失败显式返回，而不是静默当作成功；
- 将所有编辑、shell 命令、部署、远程操作、直接检查和最终决定留给主 agent。

配置的模型 provider 仍会收到其角色所需的数据。Preflight 收到原始请求、有限的最近对话文本、工作目录标识和 repository 观察结果。Review 收到 task packet、实际 diff、选定文件和已报告的检查结果。顾问只收到调用 `advisor_consult` 或旧版 `sol_consult` 时提供的紧凑 packet。请不要把秘密放进这些 packet。

这个 guard 是 Pi 层面的实用边界，不是 kernel sandbox。通过 `LUNA_WORKFLOW_CHILD_EXTENSION_PATHS` 提供的 provider extension 不属于本仓库的信任边界。如果需要更强隔离，应使用 container 或操作系统级 sandbox。

## 验证

从干净 checkout 开始：

```bash
node scripts/verify-package.mjs
```

该检查会验证 manifest、必要资源、双语文档标记，以及已知本机私有配置字符串不存在。

可以使用临时 Pi profile，在无凭据和无网络模型发现的条件下加载 extension：

```bash
agent_dir="$(mktemp -d)"
trap 'rm -rf "$agent_dir"' EXIT
PI_CODING_AGENT_DIR="$agent_dir" PI_OFFLINE=1 \
  pi --no-session --no-extensions --no-context-files \
  --extension ./extensions/luna-workflow.ts --list-models
```

在这个无凭据检查中，模型目录为空或与本机无关都可以接受。如果配置了父模型但 child 模型不可用，必须报告可见的配置/模型错误，并且不能使用 fallback 路由静默启动 child。

要做 live key-flow smoke，请使用临时 checkout 和 Pi 中已经配置好的 provider：

1. 设置 Pi provider 路由，启动 Luna `max` 主 session；确认 `/supervisor status` 显示 Astra `low`。
2. 提交普通文本，确认出现一次只读 preflight brief，包含八个章节和原始请求标记，并确认 worktree 没有变化。
3. 提交 slash command、steering message 和带图片请求，确认自动 preflight 被跳过。
4. 制造一个无害的 tracked change，先由主 agent 做直接检查，再用实际有界 diff 调用一次 `luna_review`。确认 reviewer 报告配置的 Luna 路由、只使用 `read/grep/find/ls` 且不改变 worktree；同一请求第二次调用必须被拒绝。
5. 用一份简短的不确定性 packet 调用 `advisor_consult`。确认配置的 Astra 路由、thinking 为 `low`、工具列表为空且 worktree 没有变化；确认没有显式调用时不会运行顾问。
6. 如果配置了旧 Sol 路由，确认 `sol_consult` 仍以 `max` 激活。
7. 切换到其他主模型或非 `max` thinking level，确认 review 和 advisor 工具从 active tool set 中移除。

review 是独立检查，不是主 agent 直接验证的替代品。Provider/model 可用性、模型质量和 child 延迟取决于运行环境。

## 已知限制

- 工作流是 advisory，不保证实现或 review 一定正确。
- 主 agent 必须判断改动是否非平凡，提供有界 diff，处理 findings，并运行最终检查。
- 顾问调用必须显式并提供证据；没有自动紧急分类器或调用计数器。
- 一次 review 的预算保存在当前 Pi extension runtime 内，并在新的用户请求时重置。请求 boundary 防止较早的对话任务满足后来的任务。
- Child 进程依赖配置的 provider、模型能力、Pi 版本和网络可用性。
- Package 不安装 provider、不管理凭据、不创建备份、不部署服务，也不改变活动 Pi 安装，除了 Pi 正常的 package 注册行为。
- 公开仓库不是许可证授予。本版本在单独做出授权决定前仍保持 `UNLICENSED`。
