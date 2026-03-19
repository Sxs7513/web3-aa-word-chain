// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "account-abstraction/interfaces/IPaymaster.sol";
import "account-abstraction/interfaces/IEntryPoint.sol";
import "account-abstraction/interfaces/PackedUserOperation.sol";

/**
 * 一个非常简单的 Paymaster:
 * 1. 任何人都可以用它来支付 Gas
 * 2. 没有任何白名单或验证逻辑 (仅用于测试网演示)
 */
contract SimplePaymaster is IPaymaster {
    IEntryPoint public immutable entryPoint;
    address public owner;

    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
        owner = msg.sender;
    }

    // 验证 UserOp 是否可以由该 Paymaster 支付
    // context 返回值会传递给 postOp
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override returns (bytes memory context, uint256 validationData) {
        // 验证调用者必须是 EntryPoint
        require(msg.sender == address(entryPoint), "Sender not EntryPoint");

        // 在这里可以添加逻辑，比如检查 userOp.sender 是否在白名单，或者 userOp.callData 是否是允许的函数
        // 为了演示简单，我们允许所有 UserOp，只要我们有足够的余额

        // 返回 0 表示验证通过 (SIG_VALIDATION_SUCCESS)
        // context 为空
        return ("", 0);
    }

    // UserOp 执行后的回调 (退款等逻辑)
    // 这里我们不需要做任何事
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external override {}

    // 允许 Owner 提取 Paymaster 中的资金
    function withdraw(address payable to, uint256 amount) external {
        require(msg.sender == owner, "Only owner");
        entryPoint.withdrawTo(to, amount);
    }

    // 允许 Owner 向 EntryPoint 充值
    function deposit() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    // 也可以直接转账给 Paymaster 来充值 (通过 receive 函数转发给 EntryPoint)
    receive() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }
    
    // 查询 Paymaster 在 EntryPoint 中的存款余额
    function getDeposit() public view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }
}
