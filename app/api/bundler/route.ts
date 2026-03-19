import { NextRequest, NextResponse } from 'next/server';
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  encodeFunctionData,
  concat,
  pad,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { entryPoint07Abi, entryPoint07Address } from 'viem/account-abstraction';
import dotenv from 'dotenv';
import path from 'path';

// 手动加载 app/.env
// 注意：process.cwd() 在 Next.js API Route 中通常是项目根目录
dotenv.config({ path: path.resolve(process.cwd(), 'app/.env') });

// 使用部署者的私钥作为 Bundler 账户
// 注意：这个账户必须有 ETH 来支付 Gas
const BUNDLER_PRIVATE_KEY = (process.env.PRIVATE_KEY ||
  '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`;
const BUNDLER_RPC = process.env.BUNDLER_RPC || 'https://sepolia.base.org';
console.log('BUNDLER_PRIVATE_KEY', BUNDLER_PRIVATE_KEY);
// 创建 Viem Clients
const account = privateKeyToAccount(BUNDLER_PRIVATE_KEY);
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(BUNDLER_RPC),
});
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(BUNDLER_RPC),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, params, id } = body;

    console.log(`[Bundler] Received ${method}`, params);

    let result;

    switch (method) {
      case 'eth_chainId':
        result = '0x14a34'; // 84532 Base Sepolia
        break;

      case 'eth_supportedEntryPoints':
        result = [entryPoint07Address];
        break;

      case 'eth_sendUserOperation':
        result = await handleSendUserOperation(params[0], params[1]);
        break;

      case 'eth_estimateUserOperationGas':
        // 简易实现：直接返回硬编码的 Gas Limit，或者简单估算
        // 实际上一个好的 Bundler 应该在这里模拟执行
        // 为了简化，我们直接返回客户端请求的 UserOp 里的值，或者给个大数
        result = await handleEstimateUserOperationGas(params[0], params[1]);
        break;

      case 'eth_getUserOperationReceipt':
        // 这个比较复杂，需要索引。为了演示，我们暂不支持，或者需要去查链上事件
        // 简单 Bundler 可以不支持这个，让客户端去查 Transaction Receipt
        result = null;
        break;

      default:
        // 对于不支持的方法，尝试转发给公共节点 (fallback)
        // 比如 eth_blockNumber, eth_call 等
        const response = await fetch(BUNDLER_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return NextResponse.json(await response.json());
    }

    return NextResponse.json({ jsonrpc: '2.0', id, result });
  } catch (error: any) {
    console.log('error', error);
    console.error('Bundler Error:', error);
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: error.message || 'Internal server error' },
    });
  }
}

async function handleSendUserOperation(userOp: any, entryPoint: string) {
  if (entryPoint.toLowerCase() !== entryPoint07Address.toLowerCase()) {
    throw new Error(`Unsupported EntryPoint: ${entryPoint}`);
  }

  // 构建 handleOps 交易
  // function handleOps(PackedUserOperation[] calldata ops, address payable beneficiary)
  const beneficiary = account.address; // 收益归 Bundler 自己

  // UserOp 结构转换 (打包)
  // viem 的 writeContract 需要 PackedUserOperation 结构
  const packedUserOp = packUserOp(userOp);

  console.log('[Bundler] Submitting UserOp to chain...', packedUserOp);

  const hash = await walletClient.writeContract({
    address: entryPoint07Address,
    abi: entryPoint07Abi,
    functionName: 'handleOps',
    args: [[packedUserOp], beneficiary],
    // 可以手动指定 Gas Limit 以防估算失败
    // gas: BigInt(2000000)
  });

  console.log('[Bundler] Transaction sent:', hash);

  // 返回 UserOpHash (不是 Transaction Hash!)
  // UserOpHash = keccak256(pack(userOp, entryPoint, chainId))
  // 客户端通常需要这个 hash 来查询状态。
  // 这里为了简单，我们先返回 txHash (虽然不符合规范，但客户端可能只关心是否上链)
  // 正确的做法是计算 UserOpHash。

  // 使用 viem 计算 UserOpHash
  const userOpHash = await publicClient.readContract({
    address: entryPoint07Address,
    abi: entryPoint07Abi,
    functionName: 'getUserOpHash',
    args: [packedUserOp],
  });

  return userOpHash;
}

function packUserOp(userOp: any) {
  const accountGasLimits = concat([
    pad(toHex(BigInt(userOp.verificationGasLimit)), { size: 16 }),
    pad(toHex(BigInt(userOp.callGasLimit)), { size: 16 }),
  ]);

  const gasFees = concat([
    pad(toHex(BigInt(userOp.maxPriorityFeePerGas)), { size: 16 }),
    pad(toHex(BigInt(userOp.maxFeePerGas)), { size: 16 }),
  ]);

  // paymasterAndData packing...
  let paymasterAndData: `0x${string}` = '0x';
  if (userOp.paymaster && userOp.paymaster !== '0x') {
    paymasterAndData = concat([
      userOp.paymaster as `0x${string}`,
      pad(toHex(BigInt(userOp.paymasterVerificationGasLimit || 0)), { size: 16 }),
      pad(toHex(BigInt(userOp.paymasterPostOpGasLimit || 0)), { size: 16 }),
      (userOp.paymasterData || '0x') as `0x${string}`,
    ]);
  } else {
    paymasterAndData = (userOp.paymasterAndData || '0x') as `0x${string}`;
  }

  // 处理 initCode (v0.7 兼容)
  // 如果 initCode 为空，但有 factory 和 factoryData，则拼接它们
  let initCode = (userOp.initCode || '0x') as `0x${string}`;
  if (initCode === '0x' && userOp.factory && userOp.factoryData) {
    initCode = concat([userOp.factory as `0x${string}`, userOp.factoryData as `0x${string}`]);
  }

  return {
    sender: userOp.sender as `0x${string}`,
    nonce: BigInt(userOp.nonce),
    initCode,
    callData: (userOp.callData || '0x') as `0x${string}`,
    accountGasLimits,
    preVerificationGas: BigInt(userOp.preVerificationGas),
    gasFees,
    paymasterAndData,
    signature: (userOp.signature || '0x') as `0x${string}`,
  };
}

async function handleEstimateUserOperationGas(userOp: any, entryPoint: string) {
  // 模拟 handleOps
  const beneficiary = '0x0000000000000000000000000000000000000000';
  try {
    const gasEstimate = await publicClient.estimateContractGas({
      address: entryPoint07Address,
      abi: entryPoint07Abi,
      functionName: 'handleOps',
      args: [[userOp], beneficiary],
      account: account.address, // 使用 Bundler 账户模拟
    });

    // 返回符合 ERC-4337 格式的估算结果
    return {
      preVerificationGas: '0x186a0', // 100,000
      verificationGasLimit: '0x1e8480', // 2,000,000
      callGasLimit: '0x2dc6c0', // 3,000,000
    };
  } catch (e) {
    console.warn('[Bundler] Estimate failed, returning fallback values', e);
    // 如果模拟失败（可能是签名无效等），返回 fallback 值让客户端去试
    return {
      preVerificationGas: '0xc350',
      verificationGasLimit: '0xf4240',
      callGasLimit: '0x1e8480',
    };
  }
}
