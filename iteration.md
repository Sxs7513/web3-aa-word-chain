请按照项目内的描述作出对应的修改

当前要处理的迭代：第十轮迭代

- 第一轮迭代
  - app/api/auth/register/options/route.ts:17-30行，这里生成的认证配置是正确的么，能生成以太坊兼容的密钥么
  - app/page.tsx: 81-104行，这里的handleLogin没有被调用，可以考虑直接在页面初始化时调用对用户做到无感
  - app/page.tsx: 111-116行，这里 userOp 需要在浏览器里做签名的吧，然后把签名、公钥、原始 Op 等信息都发给服务端(bundler)校验，同样 app/api/story/submit/route.ts 也要跟着改
  - contracts/src/Story.sol, addWord 方法需要补上用户的地址，需要记录当前用户的地址

- 第二轮迭代
  - app/api/story/submit/route.ts, 按照实际项目来丰富掉被注释的代码吧，把上链的逻辑给完善了
  - app/page.tsx:handleLogin，有没有办法不让用户输入用户名，目标是要做用户完全无感登录
  - app/page.tsx:handleSubmit，不要mock userop，直接按照真实场景来开发

- 第三轮迭代
  - lib/store.ts, 是不是没必要做用户存储，因为 webauth 在公一个网站下生成的公钥是固定的，这个文件是不是都可以不要了
  - app/api/auth/login/options/route.ts、app/api/auth/register/options/route.ts，一定需要维护一个用户状态么，目标是要做用户完全无感登录
  - app/api/auth/register/verify/route.ts，这里 verify 的时候也没必要去维护用户状态吧，所有用户共享一个 challange 是不是就行了，还有 device 所有用户也都强制走同一个不行么

- 第四轮迭代
  - 整个项目内完全不需要做注册登陆这种逻辑，只需要给前端提供一个接口来获取用户的公钥（因为公钥轻易不会变化），在页面初始化时前端就需要获取这个公钥因为有个高亮用户之前选择短句的功能

- 第五轮迭代
  - app/api/auth/passkey/route.ts，这个 username 直接用如 web3-experience 这种行不行，反正只是用来在用户这里存储的，前端的代码也要改一下，所有地方去掉对 username 的依赖
  - 不要在前端用 localstorage 存用户的公钥，直接用个 JS 对象简单存一下就行了
  - app/page.tsx: 149行，这个 bundlerUrl 应该是本项目的 next api，需要在项目内通过 next api 维护一个 bundler
  - app/page.tsx: 163行，这里为什么把 AA 钱包的地址传给 addWord 方法，addWord 方法应该接受用户的公钥吧？

- 第六轮迭代
  - 废弃 app/api/story/submit/route.ts ，并修改前端代码，让 KernelClient 直接通过 /api/bundler 发送 UserOp
  - 页面初始化还要加上读当前 story 的逻辑

- 第七轮迭代
  - 补充上合约部署的代码
  - contracts/src/Counter.sol，这个合约还需要么是不是可以删了

- 第八轮迭代
  - app/page.tsx，为什么 handleInitPasskey 还是要靠点击才能执行，我再强调一遍我希望用户完全无感账号创建的过程，同时把页面的 UI 也改下，让用户在点击提交时就可以完成账号创建

- 第九轮迭代
  - 项目内增加 paymaster 合约用来支付用户的 gas 费用，并编写这个合约的部署代码

- 第十轮迭代
  - app/page.tsx 内增加 paymaster 的逻辑
