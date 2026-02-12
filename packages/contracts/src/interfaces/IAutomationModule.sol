// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAutomationModule
 * @notice Interface for the MirrorMarkets AutomationModule.
 */
interface IAutomationModule {
    // ── Structs ──────────────────────────────────────────────────────

    struct Constraints {
        uint256 maxNotionalPerTrade;
        uint256 maxNotionalPerDay;
        uint32 maxTxPerHour;
        uint64 expiry; // Unix timestamp, 0 = no expiry
    }

    struct SessionKeyData {
        bool active;
        Constraints constraints;
        uint256 dailyNotionalUsed;
        uint32 hourlyTxCount;
        uint64 lastDayReset; // Unix timestamp of last daily reset
        uint64 lastHourReset; // Unix timestamp of last hourly reset
    }

    // ── Events ───────────────────────────────────────────────────────

    event SessionKeyRegistered(address indexed safe, address indexed sessionKey, uint64 expiry);
    event SessionKeyRevoked(address indexed safe, address indexed sessionKey);
    event ConstraintsUpdated(address indexed safe, address indexed sessionKey);
    event TransactionExecuted(
        address indexed safe,
        address indexed sessionKey,
        address indexed target,
        bytes4 selector,
        uint256 notional
    );
    event TransactionBlocked(
        address indexed safe,
        address indexed sessionKey,
        address indexed target,
        string reason
    );
    event TargetAllowlistUpdated(address indexed safe, address target, bool allowed);
    event SelectorAllowlistUpdated(address indexed safe, bytes4 selector, bool allowed);
    event TokenAllowlistUpdated(address indexed safe, address token, bool allowed);
    event WithdrawalAddressAdded(address indexed safe, address indexed destination);
    event WithdrawalAddressRemoved(address indexed safe, address indexed destination);

    // ── Session Key Management ───────────────────────────────────────

    function registerSessionKey(address sessionKey, Constraints calldata constraints) external;
    function revokeSessionKey(address sessionKey) external;
    function updateConstraints(address sessionKey, Constraints calldata constraints) external;
    function getSessionKeyData(address safe, address sessionKey) external view returns (SessionKeyData memory);

    // ── Allowlists ───────────────────────────────────────────────────

    function setTargetAllowed(address target, bool allowed) external;
    function setSelectorAllowed(bytes4 selector, bool allowed) external;
    function setTokenAllowed(address token, bool allowed) external;

    // ── Withdrawal Allowlist ─────────────────────────────────────────

    function addWithdrawalAddress(address destination) external;
    function removeWithdrawalAddress(address destination) external;
    function isWithdrawalAddressAllowed(address safe, address destination) external view returns (bool);

    // ── Execution ────────────────────────────────────────────────────

    function executeFromSessionKey(
        address safe,
        address to,
        uint256 value,
        bytes calldata data,
        uint256 notionalUsd
    ) external;
}
