import { ethers, waffle } from 'hardhat'
import { BigNumber, BigNumberish, constants, utils } from 'ethers'
// import BigNumber from 'bignumber.js';
// import  bignumber from 'big-number';
import { expect } from 'chai'
import chai  from 'chai'
import { BN } from 'ethereumjs-util';
import { AbiCoder } from 'ethers/lib/utils';

// import { latest } from '../node_modules/@openzeppelin/test-helpers/src/time';
// import { time } from '@openzeppelin/test-helpers/time';
chai.use(require('chai-bignumber')());

// const createFixtureLoader = waffle.createFixtureLoader

let mockToken: any;
let sale: any;
const ONE = BigNumber.from('1');
const TWO = BigNumber.from('2');

const NUL_ADDRESS = '0x0000000000000000000000000000000000000000';
const AMOUNT_TO_SALE = 1000;
const SALE_DURATION = 86400 * 14;
const TOKEN_ID = 1;
const ITEM_PRICE = ethers.utils.parseEther('1');

let AMOUNTS = [1000, 2000, 3000];
let IDS = [1, 2, 3];

let TOKENS: any[];
let mock1: any;
let mock2: any;
let mock3: any;
let vcg: any;


describe('test sale', async () => {
   const accounts = waffle.provider.getWallets()
   const owner = accounts[0];
   const alice = accounts[1];
   const bob = accounts[2];
   const charlie = accounts[3];

   beforeEach(async() => {
      const Mock = await ethers.getContractFactory('MockERC1155');
      const VCG = await ethers.getContractFactory('VCG');
      mock1 = await Mock.deploy(IDS, AMOUNTS);
      mock2 = await Mock.deploy(IDS, AMOUNTS);
      mock3 = await Mock.deploy(IDS, AMOUNTS);
      TOKENS = [mock1.address, mock2.address, mock3.address];
      vcg = await VCG.deploy();
   })


   it('shouldnt initialize if token is zero address', async() => {
      await expect(vcg.initializeAuction(NUL_ADDRESS, IDS[0], AMOUNTS[0])).to.be.revertedWith('token is 0');
   })

   it('shouldnt initialize if amount is 0', async() => {
      await expect(vcg.initializeAuction(TOKENS[0], IDS[0], 0)).to.be.revertedWith('amount is 0');

   })

   it('shouldnt initialize if not enough tokens', async() => {
      await mock1.setApprovalForAll(vcg.address, true);
      await expect(vcg.initializeAuction(TOKENS[0], IDS[0], AMOUNTS[0] + 1)).to.be.revertedWith('ERC1155: insufficient balance for transfer');

   })

   it('should correctly initialize', async () => {
      await mock1.setApprovalForAll(vcg.address, true);
      const tx = await vcg.initializeAuction(TOKENS[0], IDS[0], AMOUNTS[0]);
      const receipt = await tx.wait();
      const timestamp = (await receipt.events[0].getBlock()).timestamp;
      const event = receipt.events[1].event;
      const auction = await vcg.auctions(1);
      const tokenIdToSale = auction.tokenIdToSale;
      const tokenToSale = auction.tokenToSale;
      const amountToSale = auction.amountToSale;
      const start = auction.startAuction;
      const active = auction.active;
      const contractBalance = await mock1.balanceOf(vcg.address, IDS[0]);

      expect(receipt.events[1].args.start).to.be.equal(timestamp);
      expect(receipt.events[1].args.tokenToSale).to.be.equal(TOKENS[0]);
      expect(receipt.events[1].args.tokenIdToSale).to.be.equal(IDS[0]);
      expect(receipt.events[1].args.amountToSale).to.be.equal(AMOUNTS[0]);

      expect(event).to.be.equal('AuctionStarted');
      expect(start).to.be.equal(timestamp);
      expect(tokenToSale).to.be.equal(TOKENS[0]);
      expect(tokenIdToSale).to.be.equal(IDS[0]);
      expect(amountToSale).to.be.equal(AMOUNTS[0]);
      expect(active).to.be.true;
      expect(contractBalance).to.be.equal(AMOUNTS[0]);
   }) 

  

   describe('auction started', async() => {

      const amountToDeposit = ethers.utils.parseEther('1');


      beforeEach('initialize auction', async() => {
         await mock1.setApprovalForAll(vcg.address, true);
         await vcg.initializeAuction(TOKENS[0], IDS[0], AMOUNTS[0]);
      })


      it('shouldnt let create bid if auction doesnt exist (wrong id)', async() => {
         const coinAmount = '500';
         const nonce = ethers.utils.keccak256(ethers.utils.hexlify(Date.now()));
         const bid = ethers.utils.parseEther('0.01');
         const auctionId = 2;
         const str = coinAmount.concat(nonce.toString()).concat(bid.toString()).concat(auctionId.toString());
         const bidHash = ethers.utils.keccak256(ethers.utils.hexlify(+str));
         await expect(vcg.connect(alice).createBid(auctionId, bidHash, {value: amountToDeposit})).to.be.revertedWith('not exists');

      })

      it('should create bid', async() => {
         const coinAmount = '500';
         const nonce = ethers.utils.keccak256(ethers.utils.hexlify(Date.now()));
         const bid = ethers.utils.parseEther('0.01');
         const auctionId = 1;
         const str = coinAmount.concat(nonce.toString()).concat(bid.toString()).concat(auctionId.toString());
         const bidHash = ethers.utils.keccak256(ethers.utils.hexlify(+str));
         const tx = await vcg.connect(alice).createBid(auctionId, bidHash, {value: amountToDeposit});
         const receipt = await tx.wait();
         const hash = await vcg.bidHashs(auctionId, alice.address);
         expect(hash).to.be.equal(bidHash);
         expect(receipt.events[0].event).to.be.equal('NewBid');
         expect(receipt.events[0].args.auctionId).to.be.equal(auctionId);
         expect(receipt.events[0].args.bidder).to.be.equal(alice.address);
         expect(receipt.events[0].args.hash).to.be.equal(bidHash);

      })

      describe('finish auction', async() => {
         let amountAlice = amountToDeposit;
         let amountBob = amountToDeposit.mul(TWO);
         let amountCharlie = amountToDeposit.mul(TWO).mul(TWO);
            
         let coinAmountAlice = '500';
         let coinAmountBob = '300';
         let coinAmountCharlie = '100';

         let bidAlice = ethers.utils.parseEther('0.01');
         let bidBob = ethers.utils.parseEther('0.02');
         let bidCharlie = ethers.utils.parseEther('0.04');

         let nonceAlice = ethers.utils.keccak256(ethers.utils.hexlify(Date.now()));
         let nonceBob = ethers.utils.keccak256(nonceAlice);
         let nonceCharlie = ethers.utils.keccak256(nonceBob);

         let auctionIdAlice = 1;
         let auctionIdBob = 2;
         let auctionIdCharlie = 3;

         let strAlice = coinAmountAlice.concat(nonceAlice.toString()).concat(bidAlice.toString()).concat(auctionIdAlice.toString());
         let strBob = coinAmountBob.concat(nonceBob.toString()).concat(bidBob.toString()).concat(auctionIdBob.toString());
         let strCharlie = coinAmountCharlie.concat(nonceCharlie.toString()).concat(bidCharlie.toString()).concat(auctionIdCharlie.toString());

         const bidHashAlice = ethers.utils.keccak256(ethers.utils.hexlify(+strAlice));
         const bidHashBob = ethers.utils.keccak256(ethers.utils.hexlify(+strBob));
         const bidHashCharlie = ethers.utils.keccak256(ethers.utils.hexlify(+strCharlie));



         beforeEach('several users deposit and make bids', async() => {

            await vcg.connect(alice).createBid(1, bidHashAlice, {value: amountAlice});
            await vcg.connect(bob).createBid(1, bidHashBob, {value: amountBob});
            await vcg.connect(charlie).createBid(1, bidHashCharlie, {value: amountCharlie});
            
         })

         it('should finish auction', async() => {
            const price = ethers.utils.parseEther('0.005');
            const prices = [price, price, price];
            const winners = [alice.address, bob.address, charlie.address];
            const amounts = [coinAmountAlice, coinAmountBob, coinAmountCharlie];
            let active = await vcg.isActive(1);
            expect(active).to.be.true;
            const tx = await vcg.finishAuction(1, winners, prices, amounts);
            const token = (await vcg.auctions(1)).tokenToSale;
            const tokenId = (await vcg.auctions(1)).tokenIdToSale;
            const assetsAlice = await vcg.assets(alice.address, token, tokenId);
            const assetsBob = await vcg.assets(bob.address, token, tokenId);
            const assetsCharlie = await vcg.assets(charlie.address, token, tokenId);
            expect(assetsAlice).to.be.equal(coinAmountAlice);
            expect(assetsBob).to.be.equal(coinAmountBob);
            expect(assetsCharlie).to.be.equal(coinAmountCharlie);
            const receipt = await tx.wait();
            // console.log(receipt);
            expect(receipt.events[0].event).to.be.equal('AuctionFinished');
            active = await vcg.isActive(1);
            expect(active).to.be.false;
            const sum = price.add(price).add(price);
   
         })


      })

   })

   // TODO:
   // 1) several auctions
   // 2) revert createBid if not active
   //
  


})
