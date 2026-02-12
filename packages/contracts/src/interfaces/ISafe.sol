// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISafe
 * @notice Minimal interface for Safe (Gnosis Safe) module interactions.
 */
interface ISafe {
    /// @notice Execute a transaction from the Safe via a module.
    /// @param to Destination address.
    /// @param value Ether value to send.
    /// @param data Encoded calldata.
    /// @param operation 0 = Call, 1 = DelegateCall.
    /// @return success True if the call succeeded.
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success);

    /// @notice Check if an address is an owner of the Safe.
    function isOwner(address owner) external view returns (bool);

    /// @notice Check if a module is enabled.
    function isModuleEnabled(address module) external view returns (bool);
}
