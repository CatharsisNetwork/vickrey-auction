//SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.7;
import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';

contract MockERC1155 is ERC1155{
    constructor (uint256[] memory _ids, uint256[] memory _amounts) ERC1155("uri") {
        _mintBatch(msg.sender, _ids, _amounts, '');
        
    }
}