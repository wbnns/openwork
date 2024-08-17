// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AzimuthTodo.sol";

contract DeployAzimuthTodo is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        AzimuthTodo azimuthTodo = new AzimuthTodo();
        console.log("AzimuthTodo deployed to:", address(azimuthTodo));

        vm.stopBroadcast();
    }
}