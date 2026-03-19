// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {SimplePaymaster} from "../src/SimplePaymaster.sol";

contract DepositPaymaster is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address paymasterAddress = vm.envAddress("PAYMASTER_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("Depositing to Paymaster at:", paymasterAddress);
        
        // 充值金额
        uint256 amount = 0.005 ether;
        
        // 直接向 Paymaster 转账，会触发其 receive() 函数调用 entryPoint.depositTo()
        (bool success, ) = paymasterAddress.call{value: amount}("");
        require(success, "Deposit failed");
        
        console.log("Deposited", amount, "wei to Paymaster");

        vm.stopBroadcast();
    }
}
