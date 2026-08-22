// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../CreditPulseScore.sol";

contract MockBlockProver is IBlockProver {
    bool public shouldFail;
    bytes32 public forcedResult;

    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }

    function setForcedResult(bytes32 _result) external {
        forcedResult = _result;
    }

    function verifyAndEmit(
        uint64 chainKey,
        uint64[] memory headerNumbers,
        bytes[] memory encodedTransactions,
        MerkleProof[] memory /* merkleProofs */,
        ContinuityProof memory /* continuityProof */
    ) external view returns (bytes32) {
        require(!shouldFail, "MockBlockProver: verification simulated failure");
        if (forcedResult != bytes32(0)) {
            return forcedResult;
        }
        require(encodedTransactions.length > 0, "No transactions");
        // Return deterministic query ID based on proof inputs
        return keccak256(abi.encodePacked(chainKey, headerNumbers[0], encodedTransactions[0]));
    }
}
