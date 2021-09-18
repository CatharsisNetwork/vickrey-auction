//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;

import '@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';

import '@openzeppelin/contracts/access/Ownable.sol';

// Contract to accept, storage and withdraw ETH, and storage and transfer tokens

contract AuctionStorage is Ownable, ERC1155Holder {

    mapping(address => mapping(address => mapping(uint256 => uint256 ))) public assets;                // user address => token address => token id => amount
    mapping(uint256 => mapping(address => uint256)) public deposits;                                   // auction id => user address => bid's hash

    uint256 profit;                                                                             // how much owner can withdraw

    function _setBidDeposit(uint256 _auctionId, address _to, uint256 _amount) internal {
        deposits[_auctionId][_to] = _amount;
    }

    function _transferETH(address payable _receiver, uint256 _amount) internal returns(bool){
        (bool success, ) = _receiver.call{value: _amount, gas: 2300}("");
        return success;
    }

    function _returnDeposit(uint256 _auctionId) internal {
        address sender = _msgSender();
        uint256 deposit = deposits[_auctionId][sender];
        require(deposit > 0, "zero deposit");
        deposits[_auctionId][sender] = 0;
        _transferETH(payable(sender), deposit);
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
        for (uint256 i = 0; i < _winners.length; i++) {
            sumETH += _prices[i];
            deposits[_auctionId][_winners[i]] -= _prices[i];
            assets[_winners[i]][_token][_tokenId] += _amounts[i];
        }
        profit += sumETH;
    }


}