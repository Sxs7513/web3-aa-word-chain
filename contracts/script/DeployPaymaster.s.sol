// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {SimplePaymaster} from "../src/SimplePaymaster.sol";
import "account-abstraction/interfaces/IEntryPoint.sol";

contract DeployPaymaster is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // EntryPoint v0.7 地址 (Base Sepolia 和其他链相同)
        address entryPointAddress = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
        
        SimplePaymaster paymaster = new SimplePaymaster(IEntryPoint(entryPointAddress));
        console.log("SimplePaymaster deployed at:", address(paymaster));
        
        // 部署后自动充值 (可选，这里先充值 0.001 ETH)
        // 注意：这会消耗部署者的 ETH
        paymaster.deposit{value: 0.001 ether}();
        console.log("Deposited 0.001 ETH to EntryPoint for Paymaster");

        vm.stopBroadcast();
    }
}
