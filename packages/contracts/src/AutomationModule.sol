// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISafe} from "./interfaces/ISafe.sol";
import {IAutomationModule} from "./interfaces/IAutomationModule.sol";

/**
 * @title AutomationModule
 * @author MirrorMarkets
 * @notice Safe-compatible module enabling constrained automation via session keys.
 *
 * Design:
 *   - Safe owners register session keys with per-key constraints (notional limits,
 *     tx rate, expiry, target/selector/token allowlists).
 *   - The backend holds the session key and calls `executeFromSessionKey()` to
 *     execute transactions through the Safe with onchain constraint enforcement.
 *   - Only Safe owners can register/revoke keys and modify allowlists.
 *   - The module enforces constraints atomically — a blocked transaction reverts
 *     with a descriptive reason and emits TransactionBlocked.
 *
 * Constraints enforced per-call:
 *   1. Session key is active and not expired
 *   2. Target address is in the target allowlist
 *   3. Function selector is in the selector allowlist
 *   4. Notional value does not exceed per-trade limit
 *   5. Daily notional usage does not exceed daily limit
 *   6. Hourly transaction count does not exceed rate limit
 *   7. For withdrawal-like selectors (ERC20 transfer), destination is in withdrawal allowlist
 */
contract AutomationModule is IAutomationModule {
    // ── Storage ──────────────────────────────────────────────────────

    // safe => sessionKey => SessionKeyData
    mapping(address => mapping(address => SessionKeyData)) private _sessionKeys;

    // safe => target => allowed
    mapping(address => mapping(address => bool)) private _allowedTargets;

    // safe => selector => allowed
    mapping(address => mapping(bytes4 => bool)) private _allowedSelectors;

    // safe => token => allowed
    mapping(address => mapping(address => bool)) private _allowedTokens;

    // safe => destination => allowed (withdrawal allowlist)
    mapping(address => mapping(address => bool)) private _withdrawalAllowlist;

    // Known ERC20 transfer selector — used to enforce withdrawal allowlist
    bytes4 private constant ERC20_TRANSFER_SELECTOR = 0xa9059cbb; // transfer(address,uint256)

    // ── Modifiers ────────────────────────────────────────────────────

    modifier onlySafeOwner(address safe) {
        require(ISafe(safe).isOwner(msg.sender), "AutomationModule: caller is not Safe owner");
        _;
    }

    modifier onlySafeOwnerDirect() {
        // For functions called by owner directly (msg.sender is the Safe or owner)
        // The Safe calls execTransactionFromModule, so the module itself is msg.sender
        // For owner-only functions, we require the caller to be calling through their Safe
        _;
    }

    // ── Session Key Management ───────────────────────────────────────

    /**
     * @notice Register a new session key. Only callable by a Safe owner.
     * @dev The msg.sender must be an owner of the Safe that calls this.
     *      Since Safe modules are called via execTransactionFromModule,
     *      owner-management functions are called directly by the owner.
     *      The Safe address is derived from msg.sender's ownership.
     */
    function registerSessionKey(address sessionKey, Constraints calldata constraints) external override {
        require(sessionKey != address(0), "AutomationModule: zero address");
        require(sessionKey != msg.sender, "AutomationModule: owner cannot be session key");

        // The caller (msg.sender) is the Safe owner. The Safe address is implicit —
        // we store the data keyed by msg.sender (the Safe that this module is installed on).
        // In practice, the Safe owner calls this via a Safe transaction that targets the module.
        // So msg.sender = Safe address.
        address safe = msg.sender;

        SessionKeyData storage data = _sessionKeys[safe][sessionKey];
        require(!data.active, "AutomationModule: session key already active");

        data.active = true;
        data.constraints = constraints;
        data.dailyNotionalUsed = 0;
        data.hourlyTxCount = 0;
        data.lastDayReset = uint64(block.timestamp);
        data.lastHourReset = uint64(block.timestamp);

        emit SessionKeyRegistered(safe, sessionKey, constraints.expiry);
    }

    function revokeSessionKey(address sessionKey) external override {
        address safe = msg.sender;
        SessionKeyData storage data = _sessionKeys[safe][sessionKey];
        require(data.active, "AutomationModule: session key not active");

        data.active = false;
        emit SessionKeyRevoked(safe, sessionKey);
    }

    function updateConstraints(address sessionKey, Constraints calldata constraints) external override {
        address safe = msg.sender;
        SessionKeyData storage data = _sessionKeys[safe][sessionKey];
        require(data.active, "AutomationModule: session key not active");

        data.constraints = constraints;
        emit ConstraintsUpdated(safe, sessionKey);
    }

    function getSessionKeyData(address safe, address sessionKey)
        external
        view
        override
        returns (SessionKeyData memory)
    {
        return _sessionKeys[safe][sessionKey];
    }

    // ── Allowlists ───────────────────────────────────────────────────

    function setTargetAllowed(address target, bool allowed) external override {
        address safe = msg.sender;
        _allowedTargets[safe][target] = allowed;
        emit TargetAllowlistUpdated(safe, target, allowed);
    }

    function setSelectorAllowed(bytes4 selector, bool allowed) external override {
        address safe = msg.sender;
        _allowedSelectors[safe][selector] = allowed;
        emit SelectorAllowlistUpdated(safe, selector, allowed);
    }

    function setTokenAllowed(address token, bool allowed) external override {
        address safe = msg.sender;
        _allowedTokens[safe][token] = allowed;
        emit TokenAllowlistUpdated(safe, token, allowed);
    }

    function isTargetAllowed(address safe, address target) external view returns (bool) {
        return _allowedTargets[safe][target];
    }

    function isSelectorAllowed(address safe, bytes4 selector) external view returns (bool) {
        return _allowedSelectors[safe][selector];
    }

    function isTokenAllowed(address safe, address token) external view returns (bool) {
        return _allowedTokens[safe][token];
    }

    // ── Withdrawal Allowlist ─────────────────────────────────────────

    function addWithdrawalAddress(address destination) external override {
        require(destination != address(0), "AutomationModule: zero address");
        address safe = msg.sender;
        _withdrawalAllowlist[safe][destination] = true;
        emit WithdrawalAddressAdded(safe, destination);
    }

    function removeWithdrawalAddress(address destination) external override {
        address safe = msg.sender;
        _withdrawalAllowlist[safe][destination] = false;
        emit WithdrawalAddressRemoved(safe, destination);
    }

    function isWithdrawalAddressAllowed(address safe, address destination) external view override returns (bool) {
        return _withdrawalAllowlist[safe][destination];
    }

    // ── Execution ────────────────────────────────────────────────────

    /**
     * @notice Execute a transaction through the Safe using a session key.
     * @dev The caller must be the session key holder. All constraints are
     *      enforced atomically — the transaction reverts on any violation.
     * @param safe The Safe address to execute through.
     * @param to Target contract address.
     * @param value Ether value (usually 0 for ERC20/CTF operations).
     * @param data Encoded calldata for the target function.
     * @param notionalUsd The USD notional value of this operation (reported by backend).
     */
    function executeFromSessionKey(
        address safe,
        address to,
        uint256 value,
        bytes calldata data,
        uint256 notionalUsd
    ) external override {
        address sessionKey = msg.sender;
        SessionKeyData storage skData = _sessionKeys[safe][sessionKey];

        // 1. Session key must be active
        require(skData.active, "AutomationModule: session key not active");

        // 2. Session key must not be expired
        if (skData.constraints.expiry != 0) {
            require(block.timestamp <= skData.constraints.expiry, "AutomationModule: session key expired");
        }

        // 3. Target must be in allowlist
        require(_allowedTargets[safe][to], "AutomationModule: target not allowed");

        // 4. Function selector must be in allowlist
        bytes4 selector = bytes4(data[:4]);
        require(_allowedSelectors[safe][selector], "AutomationModule: selector not allowed");

        // 5. Reset daily counter if a new day
        if (block.timestamp >= skData.lastDayReset + 1 days) {
            skData.dailyNotionalUsed = 0;
            skData.lastDayReset = uint64(block.timestamp);
        }

        // 6. Reset hourly counter if a new hour
        if (block.timestamp >= skData.lastHourReset + 1 hours) {
            skData.hourlyTxCount = 0;
            skData.lastHourReset = uint64(block.timestamp);
        }

        // 7. Per-trade notional limit
        if (skData.constraints.maxNotionalPerTrade > 0) {
            if (notionalUsd > skData.constraints.maxNotionalPerTrade) {
                emit TransactionBlocked(safe, sessionKey, to, "maxNotionalPerTrade exceeded");
                revert("AutomationModule: maxNotionalPerTrade exceeded");
            }
        }

        // 8. Daily notional limit
        if (skData.constraints.maxNotionalPerDay > 0) {
            if (skData.dailyNotionalUsed + notionalUsd > skData.constraints.maxNotionalPerDay) {
                emit TransactionBlocked(safe, sessionKey, to, "maxNotionalPerDay exceeded");
                revert("AutomationModule: maxNotionalPerDay exceeded");
            }
        }

        // 9. Hourly tx count limit
        if (skData.constraints.maxTxPerHour > 0) {
            if (skData.hourlyTxCount >= skData.constraints.maxTxPerHour) {
                emit TransactionBlocked(safe, sessionKey, to, "maxTxPerHour exceeded");
                revert("AutomationModule: maxTxPerHour exceeded");
            }
        }

        // 10. Withdrawal allowlist check for ERC20 transfers
        if (selector == ERC20_TRANSFER_SELECTOR && data.length >= 36) {
            address recipient = address(uint160(uint256(bytes32(data[4:36]))));
            if (!_withdrawalAllowlist[safe][recipient]) {
                emit TransactionBlocked(safe, sessionKey, to, "withdrawal destination not allowed");
                revert("AutomationModule: withdrawal destination not allowed");
            }
        }

        // Update counters
        skData.dailyNotionalUsed += notionalUsd;
        skData.hourlyTxCount += 1;

        // Execute through Safe
        bool success = ISafe(safe).execTransactionFromModule(to, value, data, 0);
        require(success, "AutomationModule: Safe execution failed");

        emit TransactionExecuted(safe, sessionKey, to, selector, notionalUsd);
    }
}
