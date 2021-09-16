//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;

import '@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';

import '@openzeppelin/contracts/access/Ownable.sol';

// Contract to accept, storage and withdraw ETH, and storage and transfer tokens

contract AuctionStorage is Ownable, ERC1155Holder {

    uint256 profit;                                                                             // how much owner can withdraw
    mapping(address => mapping(address => mapping(uint256 => uint256 ))) assets;                // user address => token address => token id => amount
    mapping(uint256 => mapping(address => uint256)) deposits;                                   // auction id => user address => bid's hash


    function getAmountOfAsset(address _account, address _tokenAddress, uint256 _tokenId) view external returns(uint256) {
        return assets[_account][_tokenAddress][_tokenId];
    }

    function _setBidDeposit(uint256 _auctionId, address _to, uint256 _amount) internal {
        deposits[_auctionId][_to] = _amount;
    }

    function _transferETH(address payable _receiver, uint256 _amount) internal returns(bool){
        (bool success, ) = _receiver.call{value: _amount, gas: 4000}("");
        return success;
    }

    function takeProfit() external onlyOwner {
        uint256 balance = profit;
        require(balance > 0, 'zero balance');
        bool success = _transferETH(payable(_msgSender()), balance);
        profit = 0;
        require(success, "!takeProfit");
    }

    function _transferAssets(address recepient, uint256 _amount, address _token, uint256 _tokenId) internal {
        require(assets[recepient][_token][_tokenId] >= _amount, 'not enough tokens');
        assets[recepient][_token][_tokenId] -= _amount;
        IERC1155(_token).safeTransferFrom(address(this), recepient, _tokenId, _amount, '');
    }

    function _makeExchange(uint256 _auctionId, address _token, uint256 _tokenId, address[] memory _winners, uint256[] memory _prices, uint256[] memory _amounts) internal {
        uint256 sumETH; 
        uint256 leftover;
        for (uint256 i = 0; i < _winners.length; i++) {
            sumETH += _prices[i];
            leftover = deposits[_auctionId][_winners[i]] - _prices[i];
            _transferETH(payable(_winners[i]), leftover);
            assets[_winners[i]][_token][_tokenId] = _amounts[i];
        }
        profit += sumETH;
    }

}