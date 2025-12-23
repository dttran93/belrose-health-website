// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

contract MockEntryPoint {
  // 1. Return the version string the library is looking for
  function version() external pure returns (string memory) {
    return '0.7';
  }

  // 2. Mock the deposit function
  function depositTo(address account) external payable {}

  // 3. The "Everything Else" catch-all
  fallback() external payable {
    // Return 32 bytes of zeros to satisfy any getter expectation
    bytes memory returnData = abi.encode(bytes32(0));
    assembly {
      return(add(returnData, 0x20), mload(returnData))
    }
  }

  receive() external payable {}
}
