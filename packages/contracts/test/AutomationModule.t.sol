// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AutomationModule} from "../src/AutomationModule.sol";
import {IAutomationModule} from "../src/interfaces/IAutomationModule.sol";
import {ISafe} from "../src/interfaces/ISafe.sol";

/**
 * @title MockSafe
 * @notice Minimal Safe mock for testing the AutomationModule.
 */
contract MockSafe {
    mapping(address => bool) public owners;
    mapping(address => bool) public modules;

    // Track last call for assertions
    address public lastTo;
    uint256 public lastValue;
    bytes public lastData;

    constructor() {
        owners[msg.sender] = true;
    }

    function addOwner(address owner) external {
        owners[owner] = true;
    }

    function isOwner(address owner) external view returns (bool) {
        return owners[owner];
    }

    function enableModule(address module) external {
        modules[module] = true;
    }

    function isModuleEnabled(address module) external view returns (bool) {
        return modules[module];
    }

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 /* operation */
    ) external returns (bool) {
        require(modules[msg.sender], "MockSafe: not a module");
        lastTo = to;
        lastValue = value;
        lastData = data;
        // Execute the call
        (bool success, ) = to.call{value: value}(data);
        return success;
    }

    receive() external payable {}
}

/**
 * @title MockERC20
 * @notice Minimal ERC20 mock for testing transfer constraints.
 */
contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

contract AutomationModuleTest is Test {
    AutomationModule module;
    MockSafe safe;
    MockERC20 token;

    address owner = address(this);
    address sessionKeyAddr;
    uint256 sessionKeyPriv;

    function setUp() public {
        module = new AutomationModule();
        safe = new MockSafe();

        // Enable module on Safe
        safe.enableModule(address(module));

        // Create a session key
        (sessionKeyAddr, sessionKeyPriv) = makeAddrAndKey("sessionKey");

        // Create token
        token = new MockERC20();
        token.mint(address(safe), 1_000_000e6); // 1M USDC

        // Set up allowlists (called from Safe)
        vm.startPrank(address(safe));
        module.setTargetAllowed(address(token), true);
        module.setSelectorAllowed(bytes4(keccak256("transfer(address,uint256)")), true);
        module.setSelectorAllowed(bytes4(keccak256("approve(address,uint256)")), true);
        vm.stopPrank();
    }

    // ── Registration Tests ───────────────────────────────────────────

    function test_registerSessionKey() public {
        IAutomationModule.Constraints memory constraints = IAutomationModule.Constraints({
            maxNotionalPerTrade: 100e6,
            maxNotionalPerDay: 1_000e6,
            maxTxPerHour: 60,
            expiry: uint64(block.timestamp + 7 days)
        });

        vm.prank(address(safe));
        module.registerSessionKey(sessionKeyAddr, constraints);

        IAutomationModule.SessionKeyData memory data = module.getSessionKeyData(address(safe), sessionKeyAddr);
        assertTrue(data.active);
        assertEq(data.constraints.maxNotionalPerTrade, 100e6);
        assertEq(data.constraints.maxNotionalPerDay, 1_000e6);
        assertEq(data.constraints.maxTxPerHour, 60);
    }

    function test_registerSessionKey_revert_zeroAddress() public {
        IAutomationModule.Constraints memory constraints = IAutomationModule.Constraints({
            maxNotionalPerTrade: 100e6,
            maxNotionalPerDay: 1_000e6,
            maxTxPerHour: 60,
            expiry: 0
        });

        vm.prank(address(safe));
        vm.expectRevert("AutomationModule: zero address");
        module.registerSessionKey(address(0), constraints);
    }

    function test_registerSessionKey_revert_alreadyActive() public {
        IAutomationModule.Constraints memory constraints = IAutomationModule.Constraints({
            maxNotionalPerTrade: 100e6,
            maxNotionalPerDay: 1_000e6,
            maxTxPerHour: 60,
            expiry: 0
        });

        vm.startPrank(address(safe));
        module.registerSessionKey(sessionKeyAddr, constraints);

        vm.expectRevert("AutomationModule: session key already active");
        module.registerSessionKey(sessionKeyAddr, constraints);
        vm.stopPrank();
    }

    function test_revokeSessionKey() public {
        _registerDefaultSessionKey();

        vm.prank(address(safe));
        module.revokeSessionKey(sessionKeyAddr);

        IAutomationModule.SessionKeyData memory data = module.getSessionKeyData(address(safe), sessionKeyAddr);
        assertFalse(data.active);
    }

    function test_updateConstraints() public {
        _registerDefaultSessionKey();

        IAutomationModule.Constraints memory newConstraints = IAutomationModule.Constraints({
            maxNotionalPerTrade: 200e6,
            maxNotionalPerDay: 2_000e6,
            maxTxPerHour: 120,
            expiry: uint64(block.timestamp + 14 days)
        });

        vm.prank(address(safe));
        module.updateConstraints(sessionKeyAddr, newConstraints);

        IAutomationModule.SessionKeyData memory data = module.getSessionKeyData(address(safe), sessionKeyAddr);
        assertEq(data.constraints.maxNotionalPerTrade, 200e6);
        assertEq(data.constraints.maxNotionalPerDay, 2_000e6);
    }

    // ── Execution Tests ──────────────────────────────────────────────

    function test_executeFromSessionKey_success() public {
        _registerDefaultSessionKey();

        address recipient = address(0xBEEF);

        // Add withdrawal address
        vm.prank(address(safe));
        module.addWithdrawalAddress(recipient);

        bytes memory transferData = abi.encodeWithSelector(
            bytes4(keccak256("transfer(address,uint256)")),
            recipient,
            50e6
        );

        vm.prank(sessionKeyAddr);
        module.executeFromSessionKey(address(safe), address(token), 0, transferData, 50e6);

        // Verify counters updated
        IAutomationModule.SessionKeyData memory data = module.getSessionKeyData(address(safe), sessionKeyAddr);
        assertEq(data.dailyNotionalUsed, 50e6);
        assertEq(data.hourlyTxCount, 1);

        // Verify token transfer happened
        assertEq(token.balanceOf(recipient), 50e6);
    }

    function test_executeFromSessionKey_revert_notActive() public {
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), address(0xBEEF), 1);

        vm.prank(sessionKeyAddr);
        vm.expectRevert("AutomationModule: session key not active");
        module.executeFromSessionKey(address(safe), address(token), 0, data, 1);
    }

    function test_executeFromSessionKey_revert_expired() public {
        IAutomationModule.Constraints memory constraints = IAutomationModule.Constraints({
            maxNotionalPerTrade: 100e6,
            maxNotionalPerDay: 1_000e6,
            maxTxPerHour: 60,
            expiry: uint64(block.timestamp + 1 hours)
        });

        vm.prank(address(safe));
        module.registerSessionKey(sessionKeyAddr, constraints);

        // Advance time past expiry
        vm.warp(block.timestamp + 2 hours);

        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), address(0xBEEF), 1);

        vm.prank(sessionKeyAddr);
        vm.expectRevert("AutomationModule: session key expired");
        module.executeFromSessionKey(address(safe), address(token), 0, data, 1);
    }

    function test_executeFromSessionKey_revert_targetNotAllowed() public {
        _registerDefaultSessionKey();
        address badTarget = address(0xDEAD);

        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), address(0xBEEF), 1);

        vm.prank(sessionKeyAddr);
        vm.expectRevert("AutomationModule: target not allowed");
        module.executeFromSessionKey(address(safe), badTarget, 0, data, 1);
    }

    function test_executeFromSessionKey_revert_selectorNotAllowed() public {
        _registerDefaultSessionKey();

        // Use a selector that isn't in the allowlist
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("burn(uint256)")), 100);

        vm.prank(sessionKeyAddr);
        vm.expectRevert("AutomationModule: selector not allowed");
        module.executeFromSessionKey(address(safe), address(token), 0, data, 1);
    }

    function test_executeFromSessionKey_revert_maxNotionalPerTrade() public {
        _registerDefaultSessionKey();

        address recipient = address(0xBEEF);
        vm.prank(address(safe));
        module.addWithdrawalAddress(recipient);

        bytes memory data = abi.encodeWithSelector(
            bytes4(keccak256("transfer(address,uint256)")),
            recipient,
            200e6
        );

        vm.prank(sessionKeyAddr);
        vm.expectRevert("AutomationModule: maxNotionalPerTrade exceeded");
        module.executeFromSessionKey(address(safe), address(token), 0, data, 200e6);
    }

    function test_executeFromSessionKey_revert_maxNotionalPerDay() public {
        _registerDefaultSessionKey();

        address recipient = address(0xBEEF);
        vm.prank(address(safe));
        module.addWithdrawalAddress(recipient);

        bytes memory transferData = abi.encodeWithSelector(
            bytes4(keccak256("transfer(address,uint256)")),
            recipient,
            90e6
        );

        // Execute 11 times at 90 each = 990 total, then one more should fail (>1000)
        for (uint256 i = 0; i < 11; i++) {
            vm.prank(sessionKeyAddr);
            module.executeFromSessionKey(address(safe), address(token), 0, transferData, 90e6);
        }

        // Total = 990, next 90 = 1080 > 1000 limit
        vm.prank(sessionKeyAddr);
        vm.expectRevert("AutomationModule: maxNotionalPerDay exceeded");
        module.executeFromSessionKey(address(safe), address(token), 0, transferData, 90e6);
    }

    function test_executeFromSessionKey_revert_maxTxPerHour() public {
        IAutomationModule.Constraints memory constraints = IAutomationModule.Constraints({
            maxNotionalPerTrade: 100e6,
            maxNotionalPerDay: 1_000_000e6,
            maxTxPerHour: 3,
            expiry: 0
        });

        vm.prank(address(safe));
        module.registerSessionKey(sessionKeyAddr, constraints);

        address recipient = address(0xBEEF);
        vm.prank(address(safe));
        module.addWithdrawalAddress(recipient);

        bytes memory transferData = abi.encodeWithSelector(
            bytes4(keccak256("transfer(address,uint256)")),
            recipient,
            1e6
        );

        // Execute 3 times (maxTxPerHour = 3)
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(sessionKeyAddr);
            module.executeFromSessionKey(address(safe), address(token), 0, transferData, 1e6);
        }

        // 4th should fail
        vm.prank(sessionKeyAddr);
        vm.expectRevert("AutomationModule: maxTxPerHour exceeded");
        module.executeFromSessionKey(address(safe), address(token), 0, transferData, 1e6);
    }

    function test_executeFromSessionKey_revert_withdrawalNotAllowed() public {
        _registerDefaultSessionKey();

        address notAllowed = address(0xDEAD);

        bytes memory transferData = abi.encodeWithSelector(
            bytes4(keccak256("transfer(address,uint256)")),
            notAllowed,
            50e6
        );

        vm.prank(sessionKeyAddr);
        vm.expectRevert("AutomationModule: withdrawal destination not allowed");
        module.executeFromSessionKey(address(safe), address(token), 0, transferData, 50e6);
    }

    function test_dailyReset() public {
        _registerDefaultSessionKey();

        address recipient = address(0xBEEF);
        vm.prank(address(safe));
        module.addWithdrawalAddress(recipient);

        bytes memory transferData = abi.encodeWithSelector(
            bytes4(keccak256("transfer(address,uint256)")),
            recipient,
            90e6
        );

        // Use most of the daily limit
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(sessionKeyAddr);
            module.executeFromSessionKey(address(safe), address(token), 0, transferData, 90e6);
        }

        // Warp forward 1 day — counters should reset
        vm.warp(block.timestamp + 1 days + 1);

        // Should succeed again
        vm.prank(sessionKeyAddr);
        module.executeFromSessionKey(address(safe), address(token), 0, transferData, 90e6);

        IAutomationModule.SessionKeyData memory data = module.getSessionKeyData(address(safe), sessionKeyAddr);
        assertEq(data.dailyNotionalUsed, 90e6); // Reset + new usage
    }

    function test_hourlyReset() public {
        IAutomationModule.Constraints memory constraints = IAutomationModule.Constraints({
            maxNotionalPerTrade: 100e6,
            maxNotionalPerDay: 1_000_000e6,
            maxTxPerHour: 2,
            expiry: 0
        });

        vm.prank(address(safe));
        module.registerSessionKey(sessionKeyAddr, constraints);

        address recipient = address(0xBEEF);
        vm.prank(address(safe));
        module.addWithdrawalAddress(recipient);

        bytes memory transferData = abi.encodeWithSelector(
            bytes4(keccak256("transfer(address,uint256)")),
            recipient,
            1e6
        );

        // Use up hourly limit
        vm.prank(sessionKeyAddr);
        module.executeFromSessionKey(address(safe), address(token), 0, transferData, 1e6);
        vm.prank(sessionKeyAddr);
        module.executeFromSessionKey(address(safe), address(token), 0, transferData, 1e6);

        // Should fail
        vm.prank(sessionKeyAddr);
        vm.expectRevert("AutomationModule: maxTxPerHour exceeded");
        module.executeFromSessionKey(address(safe), address(token), 0, transferData, 1e6);

        // Warp forward 1 hour
        vm.warp(block.timestamp + 1 hours + 1);

        // Should succeed
        vm.prank(sessionKeyAddr);
        module.executeFromSessionKey(address(safe), address(token), 0, transferData, 1e6);
    }

    // ── Allowlist Tests ──────────────────────────────────────────────

    function test_targetAllowlist() public {
        address newTarget = address(0x1234);

        vm.prank(address(safe));
        module.setTargetAllowed(newTarget, true);
        assertTrue(module.isTargetAllowed(address(safe), newTarget));

        vm.prank(address(safe));
        module.setTargetAllowed(newTarget, false);
        assertFalse(module.isTargetAllowed(address(safe), newTarget));
    }

    function test_selectorAllowlist() public {
        bytes4 sel = bytes4(keccak256("foo(uint256)"));

        vm.prank(address(safe));
        module.setSelectorAllowed(sel, true);
        assertTrue(module.isSelectorAllowed(address(safe), sel));

        vm.prank(address(safe));
        module.setSelectorAllowed(sel, false);
        assertFalse(module.isSelectorAllowed(address(safe), sel));
    }

    function test_withdrawalAllowlist() public {
        address dest = address(0x5678);

        vm.prank(address(safe));
        module.addWithdrawalAddress(dest);
        assertTrue(module.isWithdrawalAddressAllowed(address(safe), dest));

        vm.prank(address(safe));
        module.removeWithdrawalAddress(dest);
        assertFalse(module.isWithdrawalAddressAllowed(address(safe), dest));
    }

    function test_withdrawalAddress_revert_zeroAddress() public {
        vm.prank(address(safe));
        vm.expectRevert("AutomationModule: zero address");
        module.addWithdrawalAddress(address(0));
    }

    // ── No Expiry Test ───────────────────────────────────────────────

    function test_noExpiry() public {
        IAutomationModule.Constraints memory constraints = IAutomationModule.Constraints({
            maxNotionalPerTrade: 100e6,
            maxNotionalPerDay: 1_000e6,
            maxTxPerHour: 60,
            expiry: 0 // no expiry
        });

        vm.prank(address(safe));
        module.registerSessionKey(sessionKeyAddr, constraints);

        address recipient = address(0xBEEF);
        vm.prank(address(safe));
        module.addWithdrawalAddress(recipient);

        // Warp far into the future
        vm.warp(block.timestamp + 365 days);

        bytes memory transferData = abi.encodeWithSelector(
            bytes4(keccak256("transfer(address,uint256)")),
            recipient,
            10e6
        );

        // Should still work — no expiry
        vm.prank(sessionKeyAddr);
        module.executeFromSessionKey(address(safe), address(token), 0, transferData, 10e6);
    }

    // ── Approve (non-transfer) Test ──────────────────────────────────

    function test_approve_noWithdrawalCheck() public {
        _registerDefaultSessionKey();

        // approve doesn't trigger withdrawal allowlist check
        bytes memory approveData = abi.encodeWithSelector(
            bytes4(keccak256("approve(address,uint256)")),
            address(0xAAAA),
            type(uint256).max
        );

        vm.prank(sessionKeyAddr);
        module.executeFromSessionKey(address(safe), address(token), 0, approveData, 0);
    }

    // ── Helper ───────────────────────────────────────────────────────

    function _registerDefaultSessionKey() internal {
        IAutomationModule.Constraints memory constraints = IAutomationModule.Constraints({
            maxNotionalPerTrade: 100e6,
            maxNotionalPerDay: 1_000e6,
            maxTxPerHour: 60,
            expiry: 0
        });

        vm.prank(address(safe));
        module.registerSessionKey(sessionKeyAddr, constraints);
    }
}
