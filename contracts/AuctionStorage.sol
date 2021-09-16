//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;

import '@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';

import '@openzeppelin/contracts/access/Ownable.sol';

// Contract to accept, storage and withdraw ETH, and storage and transfer tokens

contract AuctionStorage is Ownable, ERC1155Holder {

    mapping(address => uint256) balances;                                               // user's deposited amount 
    mapping(address => mapping(address => mapping(uint256 => uint256 ))) assets;        // user address => token address => token id => amount

    function getAmountOfAsset(address _account, address _tokenAddress, uint256 _tokenId) view external returns(uint256) {
        return assets[_account][_tokenAddress][_tokenId];
    }

    function balanceOf(address _account) external view returns(uint256) {
        return balances[_account];
    }
    function deposit() external payable {
        balances[_msgSender()] += msg.value;
        // TODO emit event
    }

    function withdraw(uint256 _amount) external {
        balances[_msgSender()] -= _amount;
        (bool success, ) = _msgSender().call{value: _amount, gas: 4000}("");
        require(success, '!withdraw');
    }

    function takeProfit() external onlyOwner {
        uint256 ownerBalance = balances[owner()];
        require(ownerBalance > 0, 'zero balance');
        (bool success, ) = _msgSender().call{value: ownerBalance}("");
        balances[owner()] = 0;
        require(success, '!takeProfit');
    }

    function _transferAssets(address recepient, uint256 _amount, address _token, uint256 _tokenId) internal {
        require(assets[recepient][_token][_tokenId] >= _amount, 'not enough tokens');
        assets[recepient][_token][_tokenId] -= _amount;
        IERC1155(_token).safeTransferFrom(address(this), recepient, _tokenId, _amount, '');
    }

    function _makeExchange(address _token, uint256 _tokenId, address[] memory _winners, uint256[] memory _prices, uint256[] memory _amounts) internal {
        uint256 sumETH; 
        for (uint256 i = 0; i < _winners.length; i++) {
            sumETH += _prices[i];
            balances[_winners[i]] -= _prices[i];
            assets[_winners[i]][_token][_tokenId] =_amounts[i];
        }
        balances[owner()] += sumETH;
    }
    fallback() external payable {
        if(msg.value > 0) balances[_msgSender()] += msg.value;
    }

    receive() external payable {
        if(msg.value > 0) balances[_msgSender()] += msg.value;
    }
    
}