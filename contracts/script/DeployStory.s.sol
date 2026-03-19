// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {Story} from "../src/Story.sol";

contract DeployStory is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        Story story = new Story();
        console.log("Story contract deployed at:", address(story));

        vm.stopBroadcast();
    }
}
