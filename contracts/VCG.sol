//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import './AuctionStorage.sol';
import 'hardhat/console.sol';

 
contract VCG is AuctionStorage {

    mapping(uint256 => mapping(address => bytes)) public bidHashs;       // auction id => user address => bid's hash
    mapping(uint256 => AuctionInfo) public auctions;
    struct AuctionInfo {
        uint256 id;
        uint256 startAuction;
        address tokenToSale;
        uint256 tokenIdToSale;
        uint256 amountToSale;
        bool active;
    }

    uint256 public auctionsAmount;

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
        address[] winners,
        uint256 end
    );

    event NewBid(
        uint256 auctionId,
        address bidder,
        bytes hash,
        uint256 deposit
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
        auctionsAmount++;
        uint256 newId = auctionsAmount;
        newAuction.id = newId;
        newAuction.active = true;
        auctions[newId] = newAuction;
        emit AuctionStarted(newId, newAuction.startAuction, _tokenToSale, _tokenIdToSale, _amountToSale);
    }

    function createBid(uint256 _auctionId, bytes memory _hash) external payable {
        require(auctionsAmount >= _auctionId, "not exists");
        require( auctions[_auctionId].active , "not active");
        uint256 value = msg.value;
        address sender = _msgSender();
        require(_hash.length != 0, 'zero hash');
        require(bidHashs[_auctionId][sender].length == 0, "bid already made");
        require(sender != owner(), "bidder cannot be owner");
        require(value > 0, "not enough deposit");
        bidHashs[_auctionId][sender] = _hash;
        _setBidDeposit(_auctionId, sender, value);
        emit NewBid(_auctionId, sender, _hash, value);
    }

    function claim(uint256 _auctionId, address _token, uint256 _tokenId, uint256 _amount) external {  //TODO nonReentrancy
        require(auctionsAmount >= _auctionId, "not exists");
        require(!auctions[_auctionId].active, 'not finished');
        _transferAssets(_msgSender(), _amount, _token, _tokenId);
    }

    function returnDeposit(uint256 _auctionId) external {
        require(auctionsAmount >= _auctionId, "not exists");
        require(!auctions[_auctionId].active, 'not finished');
        _returnDeposit(_auctionId);
    }

    //function claimBatch

    function finishAuction(uint256 _auctionId, address[] memory _winners, uint256[] memory _prices, uint256[] memory _amounts) external onlyOwner {
        require(auctionsAmount >= _auctionId, "not exists");
        require( auctions[_auctionId].active, "already finished");
        require(_winners.length == _prices.length && _amounts.length == _prices.length, 'incorrect data');
        _makeExchange(_auctionId, auctions[_auctionId].tokenToSale, auctions[_auctionId].tokenIdToSale, _winners, _prices, _amounts);
        auctions[_auctionId].active = false;        
        emit AuctionFinished(_auctionId, auctions[_auctionId].amountToSale, _winners, block.timestamp);
    }

    //TODO Only operator

}