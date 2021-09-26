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
const TOKEN_ID = 1;
const minValue = ethers.utils.parseEther('0.001');

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
   const other = accounts[4];
   const operator = accounts[5];

   beforeEach(async() => {
      const Mock = await ethers.getContractFactory('MockERC1155');
      const VCG = await ethers.getContractFactory('VCG');
      mock1 = await Mock.deploy(IDS, AMOUNTS);
      mock2 = await Mock.deploy(IDS, AMOUNTS);
      mock3 = await Mock.deploy(IDS, AMOUNTS);
      TOKENS = [mock1.address, mock2.address, mock3.address];
      vcg = await VCG.deploy(operator.address);
   })


   it('shouldnt initialize if token is zero address', async() => {
      await expect(vcg.initializeAuction(NUL_ADDRESS, IDS[0], AMOUNTS[0], minValue)).to.be.revertedWith('token is 0');
   })

   it('shouldnt initialize if amount is 0', async() => {
      await expect(vcg.initializeAuction(TOKENS[0], IDS[0], 0, minValue)).to.be.revertedWith('amount is 0');

   })

   it('shouldnt initialize if not enough tokens', async() => {
      await mock1.setApprovalForAll(vcg.address, true);
      await expect(vcg.initializeAuction(TOKENS[0], IDS[0], AMOUNTS[0] + 1, minValue)).to.be.revertedWith('ERC1155: insufficient balance for transfer');

   })

   it('should correctly initialize', async () => {
      await mock1.setApprovalForAll(vcg.address, true);
      const tx = await vcg.initializeAuction(TOKENS[0], IDS[0], AMOUNTS[0], minValue);
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
         await vcg.initializeAuction(TOKENS[0], IDS[0], AMOUNTS[0], minValue);
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

      it('shouldnt create bid if already created', async() => {
         const coinAmount = '500';
         const nonce = ethers.utils.keccak256(ethers.utils.hexlify(Date.now()));
         const bid = ethers.utils.parseEther('0.01');
         const auctionId = 1;
         const str = coinAmount.concat(nonce.toString()).concat(bid.toString()).concat(auctionId.toString());
         const bidHash = ethers.utils.keccak256(ethers.utils.hexlify(+str));
         await vcg.connect(alice).createBid(auctionId, bidHash, {value: amountToDeposit});
         await expect(vcg.connect(alice).createBid(auctionId, bidHash, {value: amountToDeposit})).to.be.revertedWith('bid already made');

      })

      it('shouldnt claim bid if auction not finished', async() => {
         await expect(vcg.connect(alice).claim(1, mock1.address, TOKEN_ID, 1)).to.be.revertedWith('not finished');
      })


      it('shouldnt create bid if deposit is 0', async() => {
         const coinAmount = '500';
         const nonce = ethers.utils.keccak256(ethers.utils.hexlify(Date.now()));
         const bid = ethers.utils.parseEther('0.01');
         const auctionId = 1;
         const str = coinAmount.concat(nonce.toString()).concat(bid.toString()).concat(auctionId.toString());
         const bidHash = ethers.utils.keccak256(ethers.utils.hexlify(+str));
         await expect(vcg.connect(alice).createBid(auctionId, bidHash, {value: 0})).to.be.revertedWith('not enough deposit');

      })

      describe('finish auction', async() => {
         let amountAlice = amountToDeposit;
         let amountBob = amountToDeposit.mul(TWO);
         let amountCharlie = amountToDeposit.mul(TWO).mul(TWO);
         let amountOther = amountToDeposit.mul(TWO).mul(TWO);
            
         let coinAmountAlice = '500';
         let coinAmountBob = '300';
         let coinAmountCharlie = '100';
         let coinAmountOther = '100';

         let bidAlice = ethers.utils.parseEther('0.01');
         let bidBob = ethers.utils.parseEther('0.02');
         let bidCharlie = ethers.utils.parseEther('0.04');
         let bidOther = ethers.utils.parseEther('0.001');

         let nonceAlice = ethers.utils.keccak256(ethers.utils.hexlify(Date.now()));
         let nonceBob = ethers.utils.keccak256(nonceAlice);
         let nonceCharlie = ethers.utils.keccak256(nonceBob);
         let nonceOther = ethers.utils.keccak256(nonceCharlie);

         let auctionIdAlice = 1;
         let auctionIdBob = 2;
         let auctionIdCharlie = 3;
         let auctionIdOther = 3;

         let strAlice = coinAmountAlice.concat(nonceAlice.toString()).concat(bidAlice.toString()).concat(auctionIdAlice.toString());
         let strBob = coinAmountBob.concat(nonceBob.toString()).concat(bidBob.toString()).concat(auctionIdBob.toString());
         let strCharlie = coinAmountCharlie.concat(nonceCharlie.toString()).concat(bidCharlie.toString()).concat(auctionIdCharlie.toString());
         let strOther = coinAmountOther.concat(nonceOther.toString()).concat(bidOther.toString()).concat(auctionIdOther.toString());

         const bidHashAlice = ethers.utils.keccak256(ethers.utils.hexlify(+strAlice));
         const bidHashBob = ethers.utils.keccak256(ethers.utils.hexlify(+strBob));
         const bidHashCharlie = ethers.utils.keccak256(ethers.utils.hexlify(+strCharlie));
         const bidHashOther = ethers.utils.keccak256(ethers.utils.hexlify(+strCharlie));

         const price = ethers.utils.parseEther('0.005');




         beforeEach('several users make bids', async() => {

            await vcg.connect(alice).createBid(1, bidHashAlice, {value: amountAlice});
            await vcg.connect(bob).createBid(1, bidHashBob, {value: amountBob});
            await vcg.connect(charlie).createBid(1, bidHashCharlie, {value: amountCharlie});
            await vcg.connect(other).createBid(1, bidHashOther, {value: amountOther});
            
         })

         it('shouldnt return deposit bid if auction not finished', async() => {
            await expect(vcg.connect(alice).returnDeposit(1)).to.be.revertedWith('not finished');
         })

         it('shouldnt return deposit bid if auction doesnt exist (wrong id)', async() => {
            await expect(vcg.connect(alice).returnDeposit(5)).to.be.revertedWith('not exists');
         })

         it('shouldnt create bid from owner', async() => {
            await expect(vcg.createBid(1, bidHashAlice, {value: amountAlice})).to.be.revertedWith('bidder cannot be owner');
         })

         it('shouldnt finish auction if it doesnt exist', async() => {
            const winners = [alice.address, bob.address, charlie.address];
            const amounts = [coinAmountAlice, coinAmountBob, coinAmountCharlie];
            await expect(vcg.connect(operator).finishAuction(5, winners, amounts)).to.be.revertedWith('not exists');  
         })

         it('shouldnt finish auction if data is incorrect', async() => {
            const winners = [alice.address, bob.address];
            const amounts = [coinAmountAlice];
            await expect(vcg.connect(operator).finishAuction(1, winners, amounts)).to.be.revertedWith('incorrect data');  
         })

         it('should finish auction', async() => {
            const winners = [alice.address, bob.address, charlie.address];
            const amounts = [coinAmountAlice, coinAmountBob, coinAmountCharlie];
            let active = (await vcg.auctions(1)).active;
            expect(active).to.be.true;
            const tx = await vcg.connect(operator).finishAuction(1, winners, amounts);
            const token = (await vcg.auctions(1)).tokenToSale;
            const tokenId = (await vcg.auctions(1)).tokenIdToSale;
            const assetsAlice = await vcg.assets(alice.address, token, tokenId);
            const assetsBob = await vcg.assets(bob.address, token, tokenId);
            const assetsCharlie = await vcg.assets(charlie.address, token, tokenId);
            const assetsOther = await vcg.assets(other.address, token, tokenId);
            expect(assetsAlice).to.be.equal(coinAmountAlice);
            expect(assetsBob).to.be.equal(coinAmountBob);
            expect(assetsCharlie).to.be.equal(coinAmountCharlie);
            expect(assetsOther).to.be.equal(0);
            const receipt = await tx.wait();
            expect(receipt.events[0].event).to.be.equal('AuctionFinished');
            active = (await vcg.auctions(1)).active;
            expect(active).to.be.false;
   
         })

         describe('after auction', async() => {

            beforeEach('finish auction', async() => {
               const winners = [alice.address, bob.address, charlie.address];
               const amounts = [coinAmountAlice, coinAmountBob, coinAmountCharlie];
               await vcg.connect(operator).finishAuction(1, winners, amounts);
            })

            it('shouldnt finish auction if alredy finished', async() => {
               const winners = [alice.address, bob.address];
               const amounts = [coinAmountAlice];
               await expect(vcg.connect(operator).finishAuction(1, winners, amounts)).to.be.revertedWith('already finished');  
            })

            it('shouldnt create bid in non active auction', async() => {
               await expect(vcg.connect(other).createBid(1, bidHashAlice, {value: amountAlice})).to.be.revertedWith('not active');
            })

            it('should claim assets', async() => {
               const aliceTokensBefore = await mock1.balanceOf(alice.address, TOKEN_ID);
               const bobTokensBefore = await mock1.balanceOf(bob.address, TOKEN_ID);
               const charlieTokensBefore = await mock1.balanceOf(charlie.address, TOKEN_ID);
               expect(aliceTokensBefore).to.be.equal(0);
               expect(bobTokensBefore).to.be.equal(0);
               expect(charlieTokensBefore).to.be.equal(0);
               await vcg.connect(alice).claim(1, mock1.address, TOKEN_ID, coinAmountAlice);
               await vcg.connect(bob).claim(1, mock1.address, TOKEN_ID, +coinAmountBob / 2);
               await vcg.connect(charlie).claim(1, mock1.address, TOKEN_ID, coinAmountCharlie);
               const bobTokensLeft = await vcg.assets(bob.address, mock1.address, TOKEN_ID);
               const aliceTokensAfter = await mock1.balanceOf(alice.address, TOKEN_ID);
               const bobTokensAfter = await mock1.balanceOf(bob.address, TOKEN_ID);
               const charlieTokensAfter = await mock1.balanceOf(charlie.address, TOKEN_ID);
               expect(aliceTokensAfter).to.be.equal(coinAmountAlice);
               expect(bobTokensAfter).to.be.equal(+coinAmountBob/2);
               expect(bobTokensLeft).to.be.equal(+coinAmountBob/2);
               expect(charlieTokensAfter).to.be.equal(coinAmountCharlie);

            })

            it('shouldnt claim assets if not a winner', async() => {
               await expect(vcg.connect(other).claim(1, mock1.address, TOKEN_ID, coinAmountOther)).to.be.revertedWith('not enough tokens');
            })

            it('shouldnt claim assets if auction doesnt exist (wrong id)', async() => {
               await expect(vcg.connect(alice).claim(5, mock1.address, TOKEN_ID, coinAmountOther)).to.be.revertedWith('not exists');
            })

            it('should return deposits', async() => {
               const otherBalanceBefore = await other.getBalance();
               const tx = await vcg.connect(other).returnDeposit(1);
               const receipt = await tx.wait();
               const otherBalanceAfter = await other.getBalance();
               const gasUsed = receipt.gasUsed;
               const gasPrice = tx.gasPrice;
               const gasCost = gasUsed.mul(gasPrice);
               expect(otherBalanceAfter.sub(otherBalanceBefore)).to.be.equal(amountOther.sub(gasCost))

            })

            it('shouldnt return deposits if already returned', async() => {
               await vcg.connect(other).returnDeposit(1);
               await expect(vcg.connect(other).returnDeposit(1)).to.be.revertedWith('zero deposit');

            })

            it('owner should takeProfit', async() => {
               const ownerBalanceBefore = await owner.getBalance();
               const tx = await vcg.connect(owner).takeProfit();
               const receipt = await tx.wait();
               const ownerBalanceAfter = await owner.getBalance();
               const gasUsed = receipt.gasUsed;
               const gasPrice = tx.gasPrice;
               const gasCost = gasUsed.mul(gasPrice);
               expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.be.equal(amountAlice.add(amountBob).add(amountCharlie).sub(gasCost))

            })

            it('owner shoulnt takeProfit if already taken', async() => {
               const ownerBalanceBefore = await owner.getBalance();
               await vcg.connect(owner).takeProfit();
               await expect(vcg.connect(owner).takeProfit()).to.be.revertedWith('zero balance');

            })
         })

      })

      describe('several auctions', async() => {

         beforeEach('initialize two more auctions', async() => {
            await mock2.setApprovalForAll(vcg.address, true);
            await mock3.setApprovalForAll(vcg.address, true);
            await vcg.initializeAuction(TOKENS[1], IDS[1], AMOUNTS[1], minValue);
            await vcg.initializeAuction(TOKENS[2], IDS[2], AMOUNTS[2]/2, minValue);
         })

         it('should create auction with the same asset to sale', async() => {
            const tx = await vcg.initializeAuction(TOKENS[2], IDS[2], AMOUNTS[2]/2, minValue);
            const receipt = await tx.wait();
            const timestamp = (await receipt.events[0].getBlock()).timestamp;
            const event = receipt.events[1].event;
            const auction = await vcg.auctions(4);
            const tokenIdToSale = auction.tokenIdToSale;
            const tokenToSale = auction.tokenToSale;
            const amountToSale = auction.amountToSale;
            const start = auction.startAuction;
            const active = auction.active;
            const contractBalance = await mock3.balanceOf(vcg.address, IDS[2]);

            expect(receipt.events[1].args.start).to.be.equal(timestamp);
            expect(receipt.events[1].args.tokenToSale).to.be.equal(TOKENS[2]);
            expect(receipt.events[1].args.tokenIdToSale).to.be.equal(IDS[2]);
            expect(receipt.events[1].args.amountToSale).to.be.equal(AMOUNTS[2]/2);

            expect(event).to.be.equal('AuctionStarted');
            expect(start).to.be.equal(timestamp);
            expect(tokenToSale).to.be.equal(TOKENS[2]);
            expect(tokenIdToSale).to.be.equal(IDS[2]);
            expect(amountToSale).to.be.equal(AMOUNTS[2]/2);
            expect(active).to.be.true;
            expect(contractBalance).to.be.equal(AMOUNTS[2]);

         })
         
      })

   })

   // TODO:
   // 1) several auctions
   // 2) revert createBid if not active
   //
  


})
