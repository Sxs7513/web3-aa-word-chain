import { concatHex } from 'viem';

// 我们部署的 SimplePaymaster 地址
const PAYMASTER_ADDRESS = '0xC2Dce3d092E4cA27B7869947B87B7dCDa064A2D7';

/**
 * 自定义 Paymaster Middleware
 * 用于在构建 UserOp 时，将 paymasterAndData 字段填充为我们的 SimplePaymaster 地址
 */
export const simplePaymasterMiddleware = async (args: { userOperation: any }) => {
  return {
    // 只返回 Paymaster 相关字段，不要展开 userOperation
    paymaster: `${PAYMASTER_ADDRESS}`,
    paymasterData: '0x',
    paymasterVerificationGasLimit: BigInt(300000),
    paymasterPostOpGasLimit: BigInt(100000),
  };
};
