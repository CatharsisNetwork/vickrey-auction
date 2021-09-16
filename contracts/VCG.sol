//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import './AuctionStorage.sol';
import 'hardhat/console.sol';

// winners get their assets automatically after calling finishAuction()
// those who didn't get reward, 
contract VCG is AuctionStorage {
    
    AuctionInfo[] auctions;


    struct AuctionInfo {
        uint256 id;
        uint256 startAuction;
        address tokenToSale;
        uint256 tokenIdToSale;
        uint256 amountToSale;
        bool active;
    }

    mapping(uint256 => mapping(address => bytes)) bidHashs;                                 // auction id => user address => bid's hash


    event AuctionStarted(
        uint256 id,
        uint256 start, 
        address tokenToSale,
        uint256 tokenIdToSale, 
        uint256 amountToSale
    );

    event AuctionFinished(
        uint256 id,
        uint256 sold,
        address[] winners
    );

    event NewBid(
        uint256 auctionId,
        address bidder,
        bytes hash
    );

    function initializeAuction(
        address _tokenToSale,
        uint256 _tokenIdToSale,
        uint256 _amountToSale
    ) external onlyOwner {
        require(_tokenToSale != address(0), 'token is 0');
        require(_amountToSale > 0, 'amount is 0');
        AuctionInfo memory newAuction;
        newAuction.tokenToSale = _tokenToSale;
        IERC1155(_tokenToSale).safeTransferFrom(_msgSender(), address(this), _tokenIdToSale, _amountToSale, "");
        newAuction.startAuction = block.timestamp;
        newAuction.tokenIdToSale = _tokenIdToSale;
        newAuction.amountToSale = _amountToSale;
        uint256 newId = auctions.length;
        newAuction.id = newId;
        newAuction.active = true;
        auctions.push(newAuction);
        emit AuctionStarted(newId, newAuction.startAuction, _tokenToSale, _tokenIdToSale, _amountToSale);
    }

    function getStartAuction(uint256 _auctionId) external view returns(uint256){
        return auctions[_auctionId].startAuction;
    }

    function getTokenToSale(uint256 _auctionId) external view returns(address){
        return auctions[_auctionId].tokenToSale;
    }

    function getTokenIdToSale(uint256 _auctionId) external view returns(uint256){
        return auctions[_auctionId].tokenIdToSale;
    }

    function getAmountToSale(uint256 _auctionId) external view returns(uint256){
        return auctions[_auctionId].amountToSale;
    }

    function getAuctions() external view returns(AuctionInfo[] memory){
        return auctions;
    }

    function isActive(uint256 _auctionId) public view returns(bool){
        return auctions[_auctionId].active;
    }

    function getBidHash(uint256 _auctionId, address _user) public view returns(bytes memory){
        return bidHashs[_auctionId][_user];
    }

    function createBid(uint256 _auctionId, bytes memory _hash) external payable{
        require(auctions.length >= _auctionId + 1, "not exists");
        require( isActive( _auctionId ), "not active");
        uint256 value = msg.value;
        address sender = _msgSender();
        require(value > 0, "not enough deposit");
        bidHashs[_auctionId][sender] = _hash;
        _setBidDeposit(_auctionId, sender, value);
        emit NewBid(_auctionId, sender, _hash);
    }

    function claim(uint256 _auctionId, address _token, uint256 _tokenId, uint256 _amount) external {  //TODO nonReentrancy
        require(auctions.length >= _auctionId + 1, "not exists");
        require(!isActive( _auctionId ), 'not finished');
        _transferAssets(_msgSender(), _amount, _token, _tokenId);
    }

    function returnDeposit(uint256 _auctionId) external {}

    //function claimBatch

    function finishAuction(uint256 _auctionId, address[] memory _winners, uint256[] memory _prices, uint256[] memory _amounts) external onlyOwner {
        require(auctions.length >= _auctionId + 1, "not exists");
        require( isActive( _auctionId ), "already finished");
        require(_winners.length == _prices.length && _amounts.length == _prices.length, 'incorrect data');
        _makeExchange(_auctionId, auctions[_auctionId].tokenToSale, auctions[_auctionId].tokenIdToSale, _winners, _prices, _amounts);
        auctions[_auctionId].active = false;        
        emit AuctionFinished(_auctionId, auctions[_auctionId].amountToSale, _winners);
    }

    //TODO Only operator

}