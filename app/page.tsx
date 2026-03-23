/* eslint-disable react/jsx-no-comment-textnodes */

'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Alert,
  CircularProgress,
  ThemeProvider,
  createTheme,
  CssBaseline,
  GlobalStyles,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { initPasskey } from '@/lib/clientAuth';

import { PasskeyValidatorContractVersion, toPasskeyValidator } from '@zerodev/passkey-validator';
import { simplePaymasterMiddleware } from '@/lib/paymaster';
import { createPublicClient, http, encodeFunctionData, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';
import { createKernelAccount } from '@zerodev/sdk';
import { createSmartAccountClient } from 'permissionless';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { STRUCTURED_WORDS, WordType, getRecommendedTypes } from '@/lib/words';
import { Tab, Tabs } from '@mui/material';

// 定义暗黑神秘主题
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7c4dff', // 神秘紫
    },
    secondary: {
      main: '#64ffda', // 荧光青
    },
    background: {
      default: '#0a0a0a', // 极深黑
      paper: '#111111',
    },
    text: {
      primary: '#e0e0e0',
      secondary: '#aaaaaa',
    },
    error: {
      main: '#ff5252',
    },
  },
  typography: {
    fontFamily: '"Roboto Mono", "Fira Code", monospace', // 极客风格字体
    h3: {
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      textShadow: '0 0 10px rgba(124, 77, 255, 0.5)', // 发光效果
    },
    body1: {
      lineHeight: 1.8,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 600,
          border: '1px solid rgba(255,255,255,0.1)',
          '&:hover': {
            boxShadow: '0 0 15px rgba(124, 77, 255, 0.3)',
            borderColor: '#7c4dff',
          },
        },
        contained: {
          background: 'linear-gradient(45deg, #4a148c 30%, #7c4dff 90%)',
          border: 0,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(20, 20, 20, 0.8)', // 半透明背景
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.15)',
            },
            '&:hover fieldset': {
              borderColor: '#64ffda',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#64ffda',
              boxShadow: '0 0 8px rgba(100, 255, 218, 0.2)',
            },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
        },
      },
    },
  },
});

const entryPoint = getEntryPoint('0.7');
const kernelVersion = KERNEL_V3_1;

// 如果 permissionless 类型报错，可能需要忽略或检查版本，这里我们暂时忽略
// @ts-ignore

const storyAddress = '0xda90eA889D1a8b2f190DE608a8F96fc4aA92C429';

export default function Home() {
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSignConfirmOpen, setIsSignConfirmOpen] = useState(false);
  const [isDonateOpen, setIsDonateOpen] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [story, setStory] = useState<{ index: number; authorPublicKey: string; content: string; type?: WordType }[]>([]);
  const [activeTab, setActiveTab] = useState<string>(WordType.Intro);
  // user 状态仅用于标记是否已登录，不再存储 username
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aaAddress, setAaAddress] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // 页面加载时自动初始化 Passkey 并读取 Story
  useEffect(() => {
    const initializeUser = async () => {
      if (typeof window !== 'undefined') {
        const storedKey = localStorage.getItem('credentialPublicKey');
        if (storedKey) {
          setIsRegistered(true);
          // 简单生成地址，仅用于展示
          // 注意：这只是为了快速展示，实际发送交易时会重新创建 account
          // 如果要更精确，应该把 account.address 也缓存起来
          const cachedAddress = localStorage.getItem('aaAddress');
          if (cachedAddress) {
            setAaAddress(cachedAddress);
          }
        }
      }

      // 检查本地是否已有凭证
      const { getStoredCredential } = await import('@/lib/clientAuth');
      // 虽然 getStoredCredential 返回内存值，但在 initPasskey 中我们只存内存，
      // 如果页面刷新，需要重新 init。
      // 但是为了 UI 上的高亮显示，我们需要公钥。
      // 这里的逻辑有点循环依赖：我们需要公钥来高亮，但公钥只有 init 后才有。
      // 简单起见，我们假设用户每次进来都需要重新 "Create Passkey" (实际上是 login)

      // 读取链上 Story
      try {
        const publicClient = createPublicClient({
          transport: http('https://sepolia.base.org'),
          chain: baseSepolia,
        });

        // 尝试读取，如果失败（如网络问题或合约不存在）则使用 Mock
        try {
          const data = await publicClient.readContract({
            address: storyAddress,
            abi: parseAbi([
              'struct Word { uint256 index; bytes authorPublicKey; }',
              'function getStory() external view returns (Word[] memory)',
            ]),
            functionName: 'getStory',
          });

          // 转换数据格式
          const loadedStory = data.map((item: any) => ({
            index: Number(item.index),
            authorPublicKey: item.authorPublicKey,
            content: STRUCTURED_WORDS[Number(item.index)]?.content || 'Unknown',
            type: STRUCTURED_WORDS[Number(item.index)]?.type,
          }));

          setStory(loadedStory);
        } catch (innerError) {
          console.warn('Contract read failed, using mock data', innerError);
        }
      } catch (e) {
        console.error('Failed to load story from chain:', e);
      }

      setIsInitializing(false);
    };

    initializeUser();
  }, []);

  const handleOpenDialog = () => {
    // 自动切换到推荐的 Tab
    const lastWord = story[story.length - 1];
    if (lastWord && lastWord.type) {
      const recommended = getRecommendedTypes(lastWord.type);
      if (recommended.length > 0) {
        setActiveTab(recommended[0]);
      }
    }
    setIsDialogOpen(true);
  };
  const handleCloseDialog = () => setIsDialogOpen(false);

  const handleSelectWord = (word: string) => {
    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter((w) => w !== word));
    } else {
      if (selectedWords.length >= 5) return; // 限制最多5个
      setSelectedWords([...selectedWords, word]);
    }
  };

  const handleConfirmSelection = () => {
    handleCloseDialog();
  };

  const handlePreSubmit = () => {
    if (selectedWords.length === 0) return;
    setIsSignConfirmOpen(true);
  };

  const handleSubmit = async () => {
    setIsSignConfirmOpen(false);
    setLoading(true);
    try {
      // 1. 检查并确保用户已初始化 (Passkey)
      let currentUsername = 'user'; // 默认用户名，不再从输入获取

      if (!isRegistered) {
        // 注册流程
        console.log('Starting registration...');
        await initPasskey(currentUsername);
        setIsRegistered(true);
      }

      // 2. 初始化 Viem Public Client
      const publicClient = createPublicClient({
        transport: http('https://sepolia.base.org'),
        chain: baseSepolia,
      });

      // 3. 创建 Passkey Validator (ZeroDev)
      // 注意：这里我们使用 toPasskeyValidator 替代 ecdsa-validator
      // PasskeySigner 需要被适配，或者我们可以直接用 WebAuthn 凭证

      // toPasskeyValidator 需要一个 WebAuthnKey，我们从 storedCred 中构建
      // 注意：getStoredCredential 在上面已经 import 过了，直接用
      // const { getStoredCredential } = await import('@/lib/clientAuth');
      // const credential = getStoredCredential();

      // 使用之前定义的 credential (在 L224 附近定义的那个变量)
      // 但由于这里是在 handleSubmit 函数内部，且 credential 变量是在 try 块外部定义的 storedCred

      // 我们重新获取一下 credential，为了避免重名，改个变量名
      const currentCredential = (await import('@/lib/clientAuth')).getStoredCredential();

      if (!currentCredential) throw new Error('Credential not found');

      const pubKeyBuffer = Buffer.from(currentCredential.publicKey, 'base64');

      // 解析 Passkey 公钥 (COSE Key 格式 -> Raw P256)
      // 根据日志，pubKeyBuffer 是 CBOR 编码的 COSE Key (77 字节)
      // 结构: a5 01 02 03 26 20 01 21 58 20 [32 bytes X] 22 58 20 [32 bytes Y]
      console.log('Full PubKeyBuffer (Hex):', pubKeyBuffer.toString('hex'));

      let pubX: bigint;
      let pubY: bigint;

      if (pubKeyBuffer.length === 77 && pubKeyBuffer[0] === 0xa5) {
        // COSE Key 格式提取
        pubX = BigInt('0x' + pubKeyBuffer.subarray(10, 42).toString('hex'));
        pubY = BigInt('0x' + pubKeyBuffer.subarray(45, 77).toString('hex'));
        console.log('Parsed COSE Key - X:', pubX.toString(16), 'Y:', pubY.toString(16));
      } else {
        // 兼容处理：尝试寻找 0x04 前缀的 Raw Key (65 字节)
        let rawKey = pubKeyBuffer;
        if (pubKeyBuffer.length > 65) {
          const rawKeyIndex = pubKeyBuffer.indexOf(Buffer.from([0x04]));
          if (rawKeyIndex !== -1 && pubKeyBuffer.length - rawKeyIndex === 65) {
            rawKey = pubKeyBuffer.subarray(rawKeyIndex);
          } else {
            rawKey = pubKeyBuffer.subarray(pubKeyBuffer.length - 65);
          }
        }
        pubX = BigInt('0x' + rawKey.subarray(1, 33).toString('hex'));
        pubY = BigInt('0x' + rawKey.subarray(33, 65).toString('hex'));
        console.log('Parsed Raw/DER Key - X:', pubX.toString(16), 'Y:', pubY.toString(16));
      }

      // toPasskeyValidator 需要的是 WebAuthnKey 结构
      const passkeyValidator = await toPasskeyValidator(publicClient, {
        entryPoint: entryPoint,
        kernelVersion: kernelVersion,
        webAuthnKey: {
          pubX,
          pubY,
          authenticatorId: currentCredential.id,
          authenticatorIdHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          rpID: window.location.hostname,
        },
        validatorContractVersion: PasskeyValidatorContractVersion.V0_0_1_UNPATCHED,
      });

      // 5. 创建 Kernel Account
      // 使用随机 Index 确保每次生成新的 AA 地址，避免旧合约状态冲突
      // 在生产环境中，应该将 Index 存储在本地或数据库中，以保持用户地址不变
      const account = await createKernelAccount(publicClient, {
        plugins: {
          sudo: passkeyValidator,
        },
        entryPoint: entryPoint,
        kernelVersion: kernelVersion,
        index: BigInt(0), // 固定为 0，确保地址不变
      });

      localStorage.setItem('aaAddress', account.address);
      setAaAddress(account.address);

      // 6. 创建 Smart Account Client
      // 恢复使用 Node Proxy，避免浏览器端 CORS/Origin 问题
      const bundlerUrl = '/api/bundler';

      const kernelClient = createSmartAccountClient({
        account,
        chain: baseSepolia,
        bundlerTransport: http(bundlerUrl),
        paymaster: {
          getPaymasterData: async (parameters) => {
            return (await simplePaymasterMiddleware({ userOperation: parameters })) as any;
          },
        },
      });

      console.log('Sending UserOp...');

      // 7. 构建 CallData
      const storyAbi = parseAbi([
        'function addWord(uint256 index, bytes calldata authorPublicKey) external',
        'function addWords(uint256[] calldata indexes, bytes calldata authorPublicKey) external',
      ]);

      // 准备要上传的单词列表
      const indexesToAdd: bigint[] = [];
      for (const word of selectedWords) {
        const idx = STRUCTURED_WORDS.findIndex((w) => w.content === word);
        if (idx !== -1) indexesToAdd.push(BigInt(idx));
      }

      let callData;
      if (indexesToAdd.length === 1) {
        callData = await account.encodeCalls([
          {
            to: storyAddress,
            value: BigInt(0),
            data: encodeFunctionData({
              abi: storyAbi,
              functionName: 'addWord',
              args: [indexesToAdd[0], account.address as `0x${string}`],
            }),
          },
        ]);
      } else {
        callData = await account.encodeCalls([
          {
            to: storyAddress,
            value: BigInt(0),
            data: encodeFunctionData({
              abi: storyAbi,
              functionName: 'addWords',
              args: [indexesToAdd, account.address as `0x${string}`],
            }),
          },
        ]);
      }
      console.log('Generated callData:', callData);

      // 8. 准备 UserOp (估算 Gas, 获取 Paymaster Data)
      // 这会触发 Bundler 的 eth_estimateUserOperationGas 和 Paymaster Middleware
      const userOp = await kernelClient.prepareUserOperation({
        callData,
      });
      console.log('Prepared UserOp:', userOp);

      // 9. 签名 UserOp
      // 这会触发 Passkey 弹窗
      userOp.signature = await account.signUserOperation(userOp);

      console.log('Signed UserOp:', userOp);

      // 10. 发送 UserOp
      const userOpHash = await kernelClient.sendUserOperation({
        ...userOp,
      });

      console.log('UserOp Hash:', userOpHash);

      // 乐观更新 UI
      const newItems = indexesToAdd.map((idx) => ({
        index: Number(idx),
        authorPublicKey: account.address,
        content: STRUCTURED_WORDS[Number(idx)].content,
        type: STRUCTURED_WORDS[Number(idx)].type,
      }));

      setStory([...story, ...newItems]);
      setSelectedWords([]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDonate = () => {
    setIsDonateOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // 这里可以加一个简单的 Toast 提示，为了简化直接 console
    console.log('Copied to clipboard');
  };

  if (isInitializing) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Container
          sx={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          <CircularProgress color="secondary" />
        </Container>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container
        maxWidth="md"
        sx={{ height: '100vh', display: 'flex', flexDirection: 'column', py: 4 }}
      >
        {/* 标题与系统终端信息板 */}
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h2" 
            component="h1" 
            align="center"
            sx={{ 
              fontFamily: 'monospace', 
              fontWeight: 'bold',
              color: 'secondary.main',
              textShadow: '0 0 10px rgba(124, 77, 255, 0.5)',
              mb: 3
            }}
          >
            WORD CHAIN
          </Typography>
          
          {/* 信息板容器 - 可折叠 */}
          {isInfoExpanded ? (
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', md: 'row' }, 
                gap: 2,
                mb: 2,
                animation: 'fadeIn 0.3s ease-in-out'
              }}
            >
              {/* 左侧：游戏意义 */}
              <Paper sx={{ 
                flex: 1, 
                p: 2, 
                bgcolor: 'rgba(0,0,0,0.4)', 
                border: '1px solid rgba(124, 77, 255, 0.3)',
                borderLeft: '3px solid #7c4dff',
                position: 'relative'
              }}>
                <Typography variant="caption" sx={{ color: '#7c4dff', fontFamily: 'monospace', display: 'block', mb: 1 }}>
                  // WHY_THIS_MATTERS
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  You are writing on a <span style={{ color: '#fff' }}>Global World Database</span> (Blockchain). 
                  Every word you append here is <span style={{ color: '#fff' }}>permanently etched into history</span>. 
                  No one can delete or alter your contribution. You are co-authoring an immortal story.
                </Typography>
              </Paper>
  
              {/* 右侧：体验特性 */}
              <Paper sx={{ 
                flex: 1, 
                p: 2, 
                bgcolor: 'rgba(0,0,0,0.4)', 
                border: '1px solid rgba(100, 255, 218, 0.3)',
                borderLeft: '3px solid #64ffda',
                position: 'relative'
              }}>
                <Typography variant="caption" sx={{ color: '#64ffda', fontFamily: 'monospace', display: 'block', mb: 1 }}>
                  // HOW_IT_WORKS
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box component="span" sx={{ color: '#64ffda' }}>✓</Box> 
                    <span style={{ color: '#fff' }}>0 App Downloads:</span> Play directly in your browser.
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box component="span" sx={{ color: '#64ffda' }}>✓</Box> 
                    <span style={{ color: '#fff' }}>100% Free:</span> All network fees are sponsored by us.
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box component="span" sx={{ color: '#64ffda' }}>✓</Box> 
                    <span style={{ color: '#fff' }}>Device is Account:</span> Your browser and device are your secure keys.
                  </Typography>
                </Box>
                
                <Button 
                  size="small" 
                  onClick={() => setIsInfoExpanded(false)}
                  sx={{ 
                      position: 'absolute', 
                      top: 8, 
                      right: 8, 
                      color: 'text.secondary',
                      minWidth: 'auto',
                      p: 0.5
                  }}
                >
                  [HIDE]
                </Button>
              </Paper>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Button
                    onClick={() => setIsInfoExpanded(true)}
                    sx={{
                        fontFamily: 'monospace',
                        color: '#64ffda',
                        border: '1px dashed rgba(100, 255, 218, 0.5)',
                        bgcolor: 'rgba(100, 255, 218, 0.05)',
                        px: 3,
                        py: 1,
                        animation: 'pulse 2s infinite',
                        '&:hover': {
                            bgcolor: 'rgba(100, 255, 218, 0.1)',
                            borderStyle: 'solid'
                        },
                        '@keyframes pulse': {
                            '0%': { boxShadow: '0 0 0 0 rgba(100, 255, 218, 0.4)' },
                            '70%': { boxShadow: '0 0 0 10px rgba(100, 255, 218, 0)' },
                            '100%': { boxShadow: '0 0 0 0 rgba(100, 255, 218, 0)' }
                        },
                        '@keyframes fadeIn': {
                            from: { opacity: 0, transform: 'translateY(-10px)' },
                            to: { opacity: 1, transform: 'translateY(0)' }
                        }
                    }}
                >
                    &gt; HOW_TO_PLAY &lt;
                </Button>
            </Box>
          )}
        </Box>

        {error && (
          <Tooltip title={error} arrow placement="top">
            <Alert
              severity="error"
              sx={{
                mb: 2,
                bgcolor: 'rgba(255, 82, 82, 0.1)',
                color: '#ff8a80',
                border: '1px solid #ff5252',
                '& .MuiAlert-message': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '800px',
                },
              }}
            >
              {error}
            </Alert>
          </Tooltip>
        )}

        {/* 用户状态 */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
          {isRegistered ? (
            <Paper
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              bgcolor: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(124, 77, 255, 0.3)',
              borderRadius: 2,
              boxShadow: '0 0 20px rgba(124, 77, 255, 0.1)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#64ffda',
                  boxShadow: '0 0 8px #64ffda',
                }}
              />
              {aaAddress ? (
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  [WALLET: {aaAddress.slice(0, 6)}...{aaAddress.slice(-4)}]
                </Typography>
              ) : (
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  System ready. Waiting for user input...
                </Typography>
              )}
            </Box>
          </Paper>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              System ready. Waiting for user input...
            </Typography>
          )}
        </Box>

                {/* 实时故事区域 */}
                <Paper
                    elevation={3}
                    sx={{
                        flex: 1,
                        mb: 4,
                        p: 4,
                        overflowY: 'auto',
                        borderRadius: 4,
                        border: '1px solid #333',
                        position: 'relative',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '2px',
                            background: 'linear-gradient(90deg, transparent, #7c4dff, transparent)',
                            opacity: 0.5,
                        },
                    }}
                >
                    <Typography variant="body1" sx={{ lineHeight: 2.5, fontSize: '1.1rem' }}>
                        {story.map((item, index) => {
                            // 判断是否是当前用户：比对 authorPublicKey 和当前连接的 aaAddress
                            const isCurrentUser =
                                aaAddress && item.authorPublicKey.toLowerCase() === aaAddress.toLowerCase();

                            // 检查是否是纯标点符号
                            const isPunctuation = /^[.,!?;:]+$/.test(item.content) || item.content === '...';

                            return (
                                <span
                                    key={index}
                                    style={{ marginRight: isPunctuation ? '4px' : '12px', display: 'inline' }}
                                >
                                    <Box
                                        component="span"
                                        sx={{
                                            color: isCurrentUser ? '#64ffda' : '#e0e0e0', // 只有自己的高亮为绿色，其他人的为浅灰色
                                            borderBottom: isCurrentUser ? '2px solid #64ffda' : 'none', // 自己的词加粗下划线
                                            fontWeight: isCurrentUser ? 'bold' : 'normal', // 自己的词加粗
                                            textShadow: isCurrentUser ? '0 0 8px rgba(100, 255, 218, 0.4)' : 'none', // 自己的词发光
                                            pb: 0.2,
                                            transition: 'all 0.3s ease',
                                            display: 'inline',
                                            lineHeight: 1.8,
                                            boxDecorationBreak: 'clone',
                                            WebkitBoxDecorationBreak: 'clone',
                                            '&:hover': {
                                                textShadow: '0 0 8px #64ffda',
                                                color: '#64ffda',
                                            },
                                        }}
                                    >
                                        {item.content}
                                    </Box>
                                </span>
                            );
                        })}
                        <Box
                            component="span"
                            sx={{
                                display: 'inline-block',
                                width: 10,
                                height: 20,
                                bgcolor: '#7c4dff',
                                verticalAlign: 'middle',
                                ml: 1,
                                animation: 'blink 1s infinite',
                            }}
                        />
                        <GlobalStyles
                            styles={{
                                '@keyframes blink': {
                                    '0%, 100%': { opacity: 1 },
                                    '50%': { opacity: 0 },
                                },
                            }}
                        />
                    </Typography>
                </Paper>

        {/* 操作区域 */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder={'> Enter command (Select words)...'}
            value={selectedWords.join(' ')}
            onClick={handleOpenDialog}
            InputProps={{
              readOnly: true,
              sx: { fontFamily: 'monospace' },
            }}
          />
          <Button
            variant="contained"
            size="large"
            onClick={handlePreSubmit}
            disabled={selectedWords.length === 0 || loading}
            sx={{ minWidth: 120, height: 56 }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'EXECUTE'}
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            size="large"
            onClick={handleDonate}
            sx={{ height: 56 }}
          >
            DONATE
          </Button>
        </Box>

        {/* 短句选择弹窗 */}
        <Dialog open={isDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <Box
            sx={{
              borderBottom: '1px solid #333',
              p: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
              // SELECT WORDS ({selectedWords.length}/5)
            </Typography>
            <Button variant="outlined" size="small" onClick={handleConfirmSelection} sx={{ ml: 2 }}>
              DONE
            </Button>
          </Box>

          {selectedWords.length > 0 && (
            <Box
              sx={{
                p: 2,
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              {selectedWords.map((word, idx) => (
                <Box
                  key={idx}
                  onClick={() => handleSelectWord(word)}
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    bgcolor: 'rgba(124, 77, 255, 0.2)',
                    border: '1px solid #7c4dff',
                    borderRadius: 1,
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(255, 82, 82, 0.2)', borderColor: '#ff5252' },
                  }}
                >
                  {word}
                </Box>
              ))}
            </Box>
          )}
          <DialogContent sx={{ mt: 2, display: 'flex', flexDirection: 'column', height: '60vh' }}>
            <Tabs
              value={activeTab}
              onChange={(e, v) => setActiveTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ mb: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            >
              {Object.values(WordType).map((type) => {
                return (
                  <Tab
                    key={type}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {type}
                      </Box>
                    }
                    value={type}
                    sx={{
                      color: 'text.secondary',
                      '&.Mui-selected': { color: '#7c4dff' },
                    }}
                  />
                );
              })}
            </Tabs>

            <List sx={{ flex: 1, overflowY: 'auto' }}>
              {STRUCTURED_WORDS.filter((w) => w.type === activeTab).map((word, index) => {
                const isSelected = selectedWords.includes(word.content);

                return (
                  <ListItem key={index} disablePadding sx={{ mb: 1 }}>
                    <ListItemButton
                      onClick={() => handleSelectWord(word.content)}
                      sx={{
                        border: isSelected
                          ? '1px solid #7c4dff'
                          : '1px solid rgba(255,255,255,0.05)',
                        bgcolor: isSelected
                          ? 'rgba(124, 77, 255, 0.2)'
                          : 'transparent',
                        '&:hover': {
                          bgcolor: 'rgba(124, 77, 255, 0.1)',
                          borderColor: '#7c4dff',
                        },
                      }}
                    >
                      <ListItemText
                        primary={word.content}
                        secondary={
                          isSelected ? '// SELECTED' : null
                        }
                        secondaryTypographyProps={{
                          fontSize: '0.7rem',
                          color: '#7c4dff',
                          fontFamily: 'monospace',
                        }}
                        primaryTypographyProps={{ fontFamily: 'monospace' }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </DialogContent>
        </Dialog>

        {/* 签名确认前置弹窗 */}
        <Dialog
          open={isSignConfirmOpen}
          onClose={() => setIsSignConfirmOpen(false)}
          PaperProps={{
            sx: {
              bgcolor: '#121212',
              border: '1px solid #7c4dff',
              boxShadow: '0 0 20px rgba(124, 77, 255, 0.2)',
            },
          }}
        >
          <DialogTitle
            sx={{
              fontFamily: 'monospace',
              color: '#64ffda',
              borderBottom: '1px dashed rgba(255,255,255,0.1)',
            }}
          >
            // AUTHORIZATION_REQUIRED
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              You are about to append the following words to the blockchain:
            </Typography>
            <Paper
              sx={{
                p: 2,
                bgcolor: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                mb: 3,
              }}
            >
              <Typography sx={{ fontFamily: 'monospace', color: '#bb86fc' }}>
                &gt; {selectedWords.join(' ')}
              </Typography>
            </Paper>
            <Typography variant="body2" color="text.secondary">
              {isRegistered
                ? 'Please verify your device (Biometrics/PIN) to securely post your words.'
                : "To post securely, your device will ask to set up a Passkey (via Fingerprint/FaceID or PIN). It's fast and safe."}
            </Typography>
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                bgcolor: 'rgba(100, 255, 218, 0.05)',
                borderLeft: '2px solid #64ffda',
              }}
            >
              <Typography variant="caption" sx={{ color: '#64ffda' }}>
                Note: The system dialog may look empty or just show our website name. This is normal
                and safe.
              </Typography>
            </Box>
          </DialogContent>
          <Box
            sx={{
              p: 2,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 2,
              borderTop: '1px dashed rgba(255,255,255,0.1)',
            }}
          >
            <Button onClick={() => setIsSignConfirmOpen(false)} sx={{ color: 'text.secondary' }}>
              CANCEL
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              sx={{ bgcolor: '#7c4dff', '&:hover': { bgcolor: '#651fff' } }}
            >
              {isRegistered ? 'VERIFY & POST' : 'SET UP & POST'}
            </Button>
          </Box>
        </Dialog>

        {/* 捐赠弹窗 */}
        <Dialog
          open={isDonateOpen}
          onClose={() => setIsDonateOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              bgcolor: '#121212',
              border: '1px solid #7c4dff',
              boxShadow: '0 0 20px rgba(124, 77, 255, 0.2)',
            },
          }}
        >
          <DialogTitle
            sx={{
              fontFamily: 'monospace',
              color: '#64ffda',
              borderBottom: '1px dashed rgba(255,255,255,0.1)',
            }}
          >
            // SUPPORT_PROJECT
          </DialogTitle>
          <DialogContent
            sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <Typography variant="body1" align="center" sx={{ mb: 1 }}>
              This project runs on{' '}
              <Box component="span" sx={{ color: '#64ffda', fontWeight: 'bold' }}>
                Base Sepolia Testnet
              </Box>
              .
            </Typography>
            <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3, px: 4 }}>
              We use a Paymaster to sponsor gas fees for users. If you have spare{' '}
              <Box component="span" sx={{ color: '#bb86fc' }}>
                Testnet ETH
              </Box>
              , your donation helps keep the tank full!
            </Typography>

            <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, mb: 3 }}>
              <QRCodeSVG
                value="0x88F8819e8Ab9dfa82a3e7579c8349e07371Fd783"
                size={150}
                level="M"
              />
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
              Base Sepolia Address:
            </Typography>
            <Paper
              onClick={() => copyToClipboard('0x88F8819e8Ab9dfa82a3e7579c8349e07371Fd783')}
              sx={{
                p: 1.5,
                bgcolor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                '&:hover': { borderColor: '#64ffda' },
              }}
            >
              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#bb86fc' }}>
                0x88F8...d783
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                [COPY]
              </Typography>
            </Paper>
          </DialogContent>
          <Box
            sx={{
              p: 2,
              display: 'flex',
              justifyContent: 'center',
              borderTop: '1px dashed rgba(255,255,255,0.1)',
            }}
          >
            <Button onClick={() => setIsDonateOpen(false)} sx={{ color: 'text.secondary' }}>
              CLOSE
            </Button>
          </Box>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
}
