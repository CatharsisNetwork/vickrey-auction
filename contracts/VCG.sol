//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./AuctionStorage.sol";

contract VCG is AuctionStorage {

    mapping(uint256 => mapping(address => bytes)) public bidHashs; // auction id => user address => bid's hash
    mapping(uint256 => AuctionInfo) public auctions;
    
    struct AuctionInfo {
        uint256 id;
        uint256 startAuction;
        address tokenToSale;
        uint256 tokenIdToSale;
        uint256 amountToSale;
        uint256 minBidValue;
        bool active;
    }

    uint256 public auctionsAmount;
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    event AuctionStarted(
        uint256 id,
        uint256 start,
        address tokenToSale,
        uint256 tokenIdToSale,
        uint256 amountToSale,
        uint256 minBidValue
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

    constructor(address _operator) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(OPERATOR_ROLE, _operator);
    }

    function initializeAuction(
        address _tokenToSale,
        uint256 _tokenIdToSale,
        uint256 _amountToSale,
        uint256 _minBidValue
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_tokenToSale != address(0), "token is 0");
        require(_amountToSale > 0, "amount is 0");
        AuctionInfo memory newAuction;
        newAuction.tokenToSale = _tokenToSale;
        IERC1155(_tokenToSale).safeTransferFrom(
            _msgSender(),
            address(this),
            _tokenIdToSale,
            _amountToSale,
            ""
        );
        newAuction.startAuction = block.timestamp;
        newAuction.tokenIdToSale = _tokenIdToSale;
        newAuction.amountToSale = _amountToSale;
        auctionsAmount++;
        uint256 newId = auctionsAmount;
        newAuction.id = newId;
        newAuction.active = true;
        newAuction.minBidValue = _minBidValue;
        auctions[newId] = newAuction;
        emit AuctionStarted(
            newId,
            newAuction.startAuction,
            _tokenToSale,
            _tokenIdToSale,
            _amountToSale,
            _minBidValue
        );
    }

    function createBid(uint256 _auctionId, bytes memory _hash)
        external
        payable
    {
        require(auctionsAmount >= _auctionId, "not exists");
        require(auctions[_auctionId].active, "not active");
        uint256 value = msg.value;
        address sender = _msgSender();
        require(_hash.length != 0, "zero hash");
        require(bidHashs[_auctionId][sender].length == 0, "bid already made");
        require(!hasRole(DEFAULT_ADMIN_ROLE, sender), "bidder cannot be owner");
        require(!hasRole(OPERATOR_ROLE, sender), "operator cannot be owner");
        require(
            value >= auctions[_auctionId].minBidValue,
            "not enough deposit"
        );
        bidHashs[_auctionId][sender] = _hash;
        _setBidDeposit(_auctionId, sender, value);
        emit NewBid(_auctionId, sender, _hash, value);
    }

    function claim(
        uint256 _auctionId,
        address _token,
        uint256 _tokenId,
        uint256 _amount
    ) external {
        require(auctionsAmount >= _auctionId, "not exists");
        require(!auctions[_auctionId].active, "not finished");
        _transferAssets(_msgSender(), _amount, _token, _tokenId);
    }

    function returnDeposit(uint256 _auctionId) external {
        require(auctionsAmount >= _auctionId, "not exists");
        require(!auctions[_auctionId].active, "not finished");
        _returnDeposit(_auctionId);
    }

    function finishAuction(
        uint256 _auctionId,
        address[] memory _winners,
        uint256[] memory _amounts
    ) external onlyRole(OPERATOR_ROLE) {
        require(auctionsAmount >= _auctionId, "not exists");
        require(auctions[_auctionId].active, "already finished");
        require(_winners.length == _amounts.length, "incorrect data");
        _makeExchange(
            _auctionId,
            auctions[_auctionId].tokenToSale,
            auctions[_auctionId].tokenIdToSale,
            _winners,
            _amounts
        );
        auctions[_auctionId].active = false;
        emit AuctionFinished(
            _auctionId,
            auctions[_auctionId].amountToSale,
            _winners,
            block.timestamp
        );
    }
}
