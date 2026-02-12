// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AutomationModule} from "../src/AutomationModule.sol";

/**
 * @title DeployModule
 * @notice Deployment script for the AutomationModule.
 *
 * Usage:
 *   forge script script/DeployModule.s.sol --rpc-url $RPC_URL --broadcast --verify
 *
 * The module is a singleton — one instance is shared across all Safes.
 * Each Safe enables the module and manages its own session keys and allowlists.
 */
contract DeployModule is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        AutomationModule module = new AutomationModule();

        console.log("AutomationModule deployed at:", address(module));

        vm.stopBroadcast();
    }
}
