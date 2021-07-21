import chai from 'chai';
import { Contract, Wallet } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { BigNumber } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { Signer } from 'ethers';
import { AddressZero } from '@ethersproject/constants';
import { TransactionRequest, Web3Provider } from '@ethersproject/providers';
import { formatUnits, parseEther, parseUnits } from '@ethersproject/units';
import { WeiPerEther } from '@ethersproject/constants';
import {
  hexDataSlice,
  Interface,
  keccak256,
  sha256,
  toUtf8Bytes,
} from 'ethers/lib/utils';
import { storageFixture } from './fixtures';
import { range } from 'lodash';
import BSON from 'bson';
import { Long, Int32 } from 'bson';
import Bluebird from 'bluebird';
import { abi as ForgottenRunesABI } from '../artifacts/contracts/ForgottenRunesWizardsCult.sol/ForgottenRunesWizardsCult.json';
import { expandTo18Decimals } from '../src/utilities';

chai.use(solidity);
const { expect } = chai;

const overrides = {
  gasLimit: 9999999,
};

function printGasEstimate({ gasAmount }) {
  const gasPrice = parseUnits('20', 'gwei');
  const ethUsdCents = 2000 * 100;

  const gasCostUsd = gasAmount
    .mul(gasPrice)
    .mul(ethUsdCents)
    .div(WeiPerEther);
  console.log('gasCostUsd:', gasCostUsd.toNumber() / 100);
}

describe('ForgottenRunes', () => {
  let storage: Contract;
  let wallet: any;
  let alice: any;
  let eve: any;
  let vault: any;
  const provider = waffle.provider;
  let contract: Contract;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    wallet = signers[0];
    alice = signers[1];
    eve = signers[2];
    vault = signers[3];
    let fixture = await storageFixture([wallet], provider);
    ({ storage } = fixture);

    const contractFactory = await ethers.getContractFactory(
      'ForgottenRunesWizardsCult',
      signers[0]
    );
    contract = await contractFactory.deploy('https://foo.bar/');
    await contract.deployed();
  });

  describe('before sale', () => {
    it('owner should be the deployer', async () => {
      expect(await contract.owner()).to.eq(wallet.address);
    });

    describe('when minting giveaways', () => {
      it('allows owner to mint appropriately', async () => {
        expect(await contract.totalSupply()).to.eq(0);
        await contract.reserve(1);
        expect(await contract.totalSupply()).to.eq(1);
        await contract.reserve(9);
        expect(await contract.totalSupply()).to.eq(10);

        const tokenURI = await contract.tokenURI(2);
        expect(tokenURI).to.eq('https://foo.bar/2');

        expect(await contract.ownerOf(2)).to.eq(wallet.address);
        await contract.transferFrom(wallet.address, alice.address, 2);
        expect(await contract.ownerOf(2)).to.eq(alice.address);

        await contract.reserve(70);
        expect(await contract.totalSupply()).to.eq(80);

        // but that's the max
        await expect(contract.reserve(1)).to.be.revertedWith(
          'Exceeded reserved supply'
        );
      });

      it("doesn't allow non owner to mint", async () => {
        contract = contract.connect(eve);
        expect(await contract.totalSupply()).to.eq(0);
        await expect(contract.reserve(1)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
        expect(await contract.totalSupply()).to.eq(0);
      });
    });

    describe('when trying to buy', () => {
      it("doesn't allow anyone to buy", async () => {
        contract = contract.connect(eve);
        await expect(
          contract.summon(1, { value: expandTo18Decimals(1) })
        ).to.be.revertedWith('You act before your time');
      });
    });

    describe('the contract', () => {
      it('has basic info', async () => {
        expect(await contract.baseURI()).to.eq('https://foo.bar/');
        expect(await contract.summonStarted()).to.eq(false);
      });
    });
  });

  describe('when setting up', () => {
    describe('the nfts', () => {
      it('uploads the images as bytes');
      it('uploads the attributes as bson', async () => {
        const groups = [
          // { startIdx: 0, endIdx: 999 },
          // { startIdx: 1000, endIdx: 1999 },
          // { startIdx: 0, endIdx: 4999 },
          // { startIdx: 5000, endIdx: 9999 },
          { startIdx: 0, endIdx: 4 },
          { startIdx: 5, endIdx: 9 },
        ];
        const txs = [];

        for (let i = 0; i < 2; i++) {
          const { startIdx, endIdx } = groups[i];
          const ids = range(startIdx, endIdx);
          const Int = Int32;

          const attributes = ids.map(id => {
            return [
              new Int(id),
              new Int(id),
              new Int(id),
              new Int(id),
              new Int(id),
              new Int(id),
              'foobar bob of the mountain',
              // 'His beard grew so quickly in the last hour that his cat began to think his master had transformed into an old man. But upon flipping the hourglass, his beard reversed, and he was clean shaven. Every turn of the hourglass made his hair grown and recede. It was pure magic.',
            ];
          });

          // Serialize a document
          const doc = { attributes: attributes };
          const data = BSON.serialize(doc);

          const tx = await contract.populateTransaction.uploadWizardsAttributes(
            data
          );
          tx.gasLimit = BigNumber.from(9500000);

          const txResponse = await wallet.sendTransaction(tx);
          const receipt = await provider.waitForTransaction(txResponse.hash);
          printGasEstimate({ gasAmount: receipt.gasUsed });

          txs.push(txResponse.hash);
        }

        // now ensure we can re-create
        const frInterface = new Interface(ForgottenRunesABI);
        const txCallData = await Bluebird.map(txs, async txHash => {
          const tx = await provider.getTransaction(txHash);
          let txData = frInterface.parseTransaction(tx);
          return txData.args[0];
        });

        txCallData.map(data => {
          const dataBuffer = Buffer.from(data.substr(2), 'hex');
          BSON.deserialize(dataBuffer);
        });

        const txData = txCallData[0].substr(2);
        const dataBuffer = Buffer.from(txData, 'hex');
        const doc = BSON.deserialize(dataBuffer);
        // console.log('doc: ', JSON.stringify(doc, null, 2));
        expect(doc.attributes[1][0] === 1);
        expect(doc.attributes[1][6] === 'foobar bob of the mountain');
      });
    });

    describe('the sale', () => {
      describe('when a non-owner tries', () => {
        beforeEach(() => {
          contract = contract.connect(eve);
        });
        it('should not set the start block', async () => {
          await expect(contract.setSummonStartBlock(100)).to.be.revertedWith(
            'Ownable: caller is not the owner'
          );
        });
        it('should not set the price', async () => {
          await expect(contract.setSummonStartBlock(100)).to.be.revertedWith(
            'Ownable: caller is not the owner'
          );
        });
        it('should not set the provenance hash', async () => {
          await expect(contract.setProvenanceHash('abc123')).to.be.revertedWith(
            'Ownable: caller is not the owner'
          );
        });
        it('should not set the baseURI', async () => {
          await expect(contract.setBaseURI('abc123')).to.be.revertedWith(
            'Ownable: caller is not the owner'
          );
        });
        it('should not set the vault', async () => {
          await expect(contract.setVault(eve.address)).to.be.revertedWith(
            'Ownable: caller is not the owner'
          );
        });
      });
      describe('when the owner tries', () => {
        it('should allow owner to set the start block', async () => {
          await contract.setSummonStartBlock(100);
          expect(await contract.summonStartBlock()).to.equal(100);
        });
        it('should allow owner to set the price', async () => {
          await contract.setPrice(1);
          expect(await contract.price()).to.equal(1);
        });
        it('should allow owner to set the provenance hash', async () => {
          await contract.setProvenanceHash('abc123');
          expect(await contract.METADATA_PROVENANCE_HASH()).to.equal('abc123');
        });
        it('should allow owner to set the vault', async () => {
          await contract.setVault(alice.address);
          expect(await contract.vault()).to.equal(alice.address);
        });
        it('should allow the owner to set the baseURI', async () => {
          await contract.setBaseURI('abc123');
          expect(await contract.baseURI()).to.equal('abc123');
        });
        it('should set the vault', async () => {
          await contract.setVault(vault.address);
          expect(await contract.vault()).to.eq(vault.address);
        });
      });
    });
  });

  describe('during the sale', () => {
    let price;

    beforeEach(async () => {
      price = await contract.price();
      await contract.setSummonStartBlock(1);
      contract = contract.connect(alice);
    });

    it('should allow someone to mint a single nft', async () => {
      expect(await provider.getBalance(contract.address)).to.eq(0);

      await expect(contract.summon(1, { value: price }))
        .to.emit(contract, 'Transfer')
        .withArgs(AddressZero, alice.address, 0);

      expect(await provider.getBalance(contract.address)).to.eq(price);
      expect(await contract.ownerOf(0)).to.eq(alice.address);
    });
    it('should allow someone to mint multiple nfts', async () => {
      expect(await provider.getBalance(contract.address)).to.eq(0);

      await expect(contract.summon(12, { value: price.mul(12) }))
        .to.emit(contract, 'Transfer')
        .withArgs(AddressZero, alice.address, 11);

      expect(await provider.getBalance(contract.address)).to.eq(price.mul(12));
      for (let i = 0; i < 12; i++) {
        expect(await contract.ownerOf(i)).to.eq(alice.address);
      }
    });
    it('should not allow someone to mint more than the maximum in a single tx', async () => {
      expect(await provider.getBalance(contract.address)).to.eq(0);
      await expect(
        contract.summon(13, { value: price.mul(13) })
      ).to.be.revertedWith(
        'You can summon no fewer than 1, and no more than 12 wizards at a time'
      );
    });
    it('should not allow someone to mint without enough funds', async () => {
      await expect(contract.summon(1)).to.be.revertedWith(
        'Ether value sent is not sufficient'
      );
      await expect(contract.summon(1, { value: 1 })).to.be.revertedWith(
        'Ether value sent is not sufficient'
      );
      await expect(contract.summon(12, { value: 1 })).to.be.revertedWith(
        'Ether value sent is not sufficient'
      );
      await expect(
        contract.summon(12, { value: price.mul(12).sub(1) })
      ).to.be.revertedWith('Ether value sent is not sufficient');
    });
    it('should not allow the owner to change the price', async () => {
      contract = contract.connect(wallet);
      await expect(contract.setPrice(100)).to.be.revertedWith(
        'Price cannot be changed once The Summoning has begun'
      );
    });
    it.skip(
      'should not allow someone to mint more than the maximum supply',
      async function() {
        // await provider.send('evm_setIntervalMining', [1000]);
        const maxWizards = await contract.MAX_WIZARDS();
        const maxPer = 10;
        const price = await contract.price();

        console.log('going to mine all of them, this will take a while');
        for (let i = 0; i < maxWizards / maxPer; i++) {
          await contract.summon(maxPer, { value: price.mul(maxPer) });
          console.log('i', i);
        }
        expect(await contract.totalSupply()).to.eq(10000);
        expect(await contract.ownerOf(9999)).to.eq(alice.address);

        await expect(
          contract.summon(1, { value: price.mul(1) })
        ).to.be.revertedWith('All wizards have been summoned');
      }
    ).timeout(60000 * 2);
  });

  describe('when handling funds', () => {
    let price;

    beforeEach(async () => {
      price = await contract.price();
      await contract.setSummonStartBlock(1);
      await contract.summon(1, { value: price.mul(1) });
    });

    describe('when there is no vault', () => {
      it('withdrawAll should not work', async () => {
        await expect(contract.withdrawAll()).to.be.revertedWith('no vault');
      });
      it('withdraw should not work', async () => {
        await expect(contract.withdraw(1)).to.be.revertedWith('no vault');
      });
    });

    it('should allow the owner to set the vault address', async () => {
      expect(await contract.vault()).to.eq(AddressZero);
      await contract.setVault(vault.address);
      expect(await contract.vault()).to.eq(vault.address);
    });

    describe('when there is a vault', () => {
      beforeEach(async () => {
        await contract.setVault(vault.address);
      });

      it('should allow the owner to withdraw some', async () => {
        expect(await provider.getBalance(contract.address)).to.eq(price);
        const vaultStartingBalance = await provider.getBalance(vault.address);
        const amount = 101;
        await contract.withdraw(amount);
        expect(await provider.getBalance(vault.address)).to.eq(
          vaultStartingBalance.add(amount)
        );
      });

      it('should allow the owner to withdraw all', async () => {
        expect(await provider.getBalance(contract.address)).to.eq(price);
        const vaultStartingBalance = await provider.getBalance(vault.address);
        await contract.withdrawAll();
        expect(await provider.getBalance(vault.address)).to.eq(
          vaultStartingBalance.add(price)
        );
      });

      it('should allow the owner to withdraw accidental erc20s');
    });
  });
});

// add events
// add finalize?
// it('works via abi', async () => {
//   expect(await storage.retrieve()).to.eq(0);
//   const signers = await ethers.getSigners();
//   const signer = signers[0];
//   const data = storage.interface.encodeFunctionData('store', [43]);
//   const transactionRequest: TransactionRequest = {
//     to: storage.address,
//     data,
//   };
//   await signer.sendTransaction(transactionRequest);
//   expect(await storage.retrieve()).to.eq(43);
// });

// hardhat test --network localhost test/ForgottenRunes.spec.ts
// make sure hardhat.config.ts hardhat network isn't forking
