export const RP_NAME = process.env.NEXT_PUBLIC_RP_NAME || 'Web3 Word Chain';
export const RP_ORIGIN = process.env.NEXT_PUBLIC_RP_ORIGIN || 'http://localhost:3000';

export const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';

// 固定 Challenge，仅用于演示
export const FIXED_CHALLENGE = 'WtY2-06_k5z4-A78';

// 我们不再需要在这里存储用户状态
// 前端负责存储 credentialID 和 publicKey
