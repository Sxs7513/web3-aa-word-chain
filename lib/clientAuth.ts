import { startRegistration } from '@simplewebauthn/browser';

// 获取存储的凭证 (优先从 localStorage 读取)
export const getStoredCredential = () => {
  if (typeof window === 'undefined') return null;

  const id = localStorage.getItem('credentialID');
  const publicKey = localStorage.getItem('credentialPublicKey');

  if (id && publicKey) {
    return { id, publicKey };
  }
  return null;
};

export async function initPasskey(username: string = 'user') {
  // 1. 获取注册选项
  const resp = await fetch('/api/auth/passkey', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'options', username }),
  });

  const options = await resp.json();

  if (options.error) {
    throw new Error(options.error);
  }

  // 2. 调用浏览器 API 进行注册/创建 Passkey
  const attResp = await startRegistration(options);

  // 3. 发送验证结果给后端，获取公钥
  const verifyResp = await fetch('/api/auth/passkey', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify', response: attResp }),
  });

  const verificationJSON = await verifyResp.json();

  if (verificationJSON && verificationJSON.verified) {
    // 保存关键信息到本地 (持久化)
    localStorage.setItem('credentialID', verificationJSON.credentialID);
    localStorage.setItem('credentialPublicKey', verificationJSON.credentialPublicKey);
    return verificationJSON;
  } else {
    throw new Error('Verification failed');
  }
}

// 签名方法不需要请求后端，直接使用本地 Credential ID + 浏览器 API
import { startAuthentication } from '@simplewebauthn/browser';

export async function signUserOp(userOpHash: string) {
  const credential = getStoredCredential();
  if (!credential) {
    throw new Error('No Passkey found');
  }

  const options = {
    challenge: userOpHash,
    allowCredentials: [
      {
        id: credential.id,
        type: 'public-key' as const,
        transports: ['internal', 'hybrid'] as AuthenticatorTransport[],
      },
    ],
    userVerification: 'preferred' as const,
    rpId: window.location.hostname, // 使用当前域名
  };

  const asseResp = await startAuthentication(options);
  return asseResp;
}
