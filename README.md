# Web3 Word Chain

这是一个基于 Account Abstraction (ERC-4337) 的短句接龙游戏，旨在让非 Web3 用户也能体验 Web3 的魅力。
项目使用 Next.js 开发，集成了 WebAuthn (Passkey) 和 ZeroDev SDK 实现无感账户创建和 Gas 代付。

## 功能特性

- **无感注册**: 使用 WebAuthn (Touch ID / Face ID) 创建账户，无需管理助记词。
- **智能合约钱包**: 为每个用户自动创建 AA 钱包 (基于 ZeroDev)。
- **Gas 代付**: 用户无需持有 ETH，后端/Paymaster 负责支付 Gas。
- **故事接龙**: 用户选择短句参与故事创作，实时上链。

## 技术栈

- **Frontend**: Next.js, Material UI, Wagmi, Viem
- **Backend**: Next.js API Routes (模拟 Bundler/Paymaster 交互)
- **Auth**: @simplewebauthn (Passkey), ZeroDev SDK (AA Account)
- **Contract**: Solidity, Foundry

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 初始化合约环境

确保已安装 Foundry:

```bash
source ~/.bashrc
forge install
```

### 3. 配置环境变量

复制 `.env.example` 到 `.env.local` 并填入必要的 API Key（可选，默认使用 Mock 模式）。

```bash
cp .env.example .env.local
```

### 4. 运行开发服务器

```bash
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 5. 运行合约测试

```bash
source ~/.bashrc
cd contracts && forge test
```

## 环境变量说明

在 `.env.local` 中配置：

```env
# ZeroDev Project ID (从 ZeroDev Dashboard 获取)
NEXT_PUBLIC_ZERODEV_PROJECT_ID=your_project_id

# WebAuthn 配置 (本地开发默认值)
NEXT_PUBLIC_RP_ID=localhost
NEXT_PUBLIC_RP_NAME="Web3 Word Chain"
NEXT_PUBLIC_RP_ORIGIN=http://localhost:3000
```

## 项目结构

- `app/`: Next.js 页面和 API 路由
- `contracts/`: Solidity 合约和 Foundry 测试
- `lib/`: 工具函数 (Auth, Store, ZeroDev Client)
- `components/`: React 组件

## 注意事项

- 当前版本使用了 Mock 数据和模拟的上链流程，以便在没有配置真实 ZeroDev Project ID 的情况下也能演示完整的前端交互流程。
- 若要接入真实链，请在 `app/page.tsx` 和 `app/api/story/submit/route.ts` 中取消注释相关的 SDK 调用代码，并配置正确的 Project ID。
