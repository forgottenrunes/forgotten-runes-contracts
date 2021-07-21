import { WeiPerEther } from '@ethersproject/constants';
import { parseUnits } from '@ethersproject/units';
import chai from 'chai';
import chaiSubset from 'chai-subset';
import { solidity } from 'ethereum-waffle';
import { BigNumber, Contract } from 'ethers';
import { ethers, waffle } from 'hardhat';

chai.use(chaiSubset);
chai.use(solidity);
const { expect } = chai;

const overrides = {
  gasLimit: 9999999,
};

function printGasEstimate({ gasAmount }) {
  const gasPrice = parseUnits('5', 'gwei');
  const ethUsdCents = 2000 * 100;

  const gasCostUsd = gasAmount
    .mul(gasPrice)
    .mul(ethUsdCents)
    .div(WeiPerEther);
  console.log('gasCostUsd:', gasCostUsd.toNumber() / 100);
}

describe('ForgottenRunes BookOfLore', () => {
  let wallet: any;
  let alice: any;
  let bob: any;
  let eve: any;
  const provider = waffle.provider;
  let wizardsContract: Contract;
  let contract: Contract;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    wallet = signers[0];
    alice = signers[1];
    bob = signers[2];
    eve = signers[3];

    const wizardFactory = await ethers.getContractFactory(
      'ForgottenRunesWizardsCult',
      signers[0]
    );
    wizardsContract = await wizardFactory.deploy('https://foo.com');

    const contractFactory = await ethers.getContractFactory(
      'BookOfLore',
      signers[0]
    );
    contract = await contractFactory.deploy(wizardsContract.address);
    await contract.deployed();
  });

  describe('BookOfLore', () => {
    beforeEach(async () => {
      expect(await wizardsContract.totalSupply()).to.eq(0);
      await wizardsContract.reserve(10);
      expect(await wizardsContract.totalSupply()).to.eq(10);
      await wizardsContract.transferFrom(wallet.address, alice.address, 1);
      await wizardsContract.transferFrom(wallet.address, bob.address, 2);
    });

    it('owner should be the deployer', async () => {
      expect(await contract.owner()).to.eq(wallet.address);
    });

    describe('when adding lore', () => {
      it('should allow the owner of a Wizard to add Lore to that Wizard', async () => {
        contract = await contract.connect(alice);
        const response = await contract.addLore(
          1,
          wizardsContract.address,
          9,
          0,
          false,
          'https://foo.bar/9'
        );
        const receipt = await response.wait();
        expect(receipt.gasUsed.toNumber()).to.be.lt(200000);
        // printGasEstimate({ gasAmount: receipt.gasUsed });

        await contract.addLore(
          1,
          wizardsContract.address,
          8,
          1,
          true,
          'https://foo.bar/8'
        );

        await contract.addLore(
          1,
          wizardsContract.address,
          7,
          0,
          false,
          'https://foo.bar/7'
        );

        expect(await contract.numLore(1)).to.eq(3);

        const lore = await contract.wizardLore(1, 0);

        const lore1Attributes = {
          creator: alice.address,
          assetAddress: wizardsContract.address,
          tokenId: BigNumber.from(9),
          nsfw: false,
          struck: false,
          loreMetadataURI: 'https://foo.bar/9',
        };
        const lore2Attributes = {
          creator: alice.address,
          assetAddress: wizardsContract.address,
          tokenId: BigNumber.from(8),
          nsfw: true,
          struck: false,
          loreMetadataURI: 'https://foo.bar/8',
        };
        const lore3Attributes = {
          creator: alice.address,
          assetAddress: wizardsContract.address,
          tokenId: BigNumber.from(7),
          nsfw: false,
          struck: false,
          loreMetadataURI: 'https://foo.bar/7',
        };

        expect(lore).to.containSubset(lore1Attributes);

        const loreSet = await contract.loreFor(1);
        expect(loreSet).to.containSubset([
          lore1Attributes,
          lore2Attributes,
          lore3Attributes,
        ]);

        const loreSubset1 = await contract.loreAt(1, 0, 2);
        expect(loreSubset1.length).to.equal(3);
        expect(loreSubset1).to.containSubset([
          lore1Attributes,
          lore2Attributes,
          lore3Attributes,
        ]);

        const loreSubset2 = await contract.loreAt(1, 1, 2);
        expect(loreSubset2.length).to.equal(2);
        expect(loreSubset2).to.containSubset([
          lore2Attributes,
          lore3Attributes,
        ]);

        const loreSubset3 = await contract.loreAt(1, 2, 2);
        expect(loreSubset3.length).to.equal(1);
        expect(loreSubset3).to.containSubset([lore3Attributes]);
      });

      it('should not allow a non-owner of a Wizard to add Lore to that Wizard', async () => {
        contract = await contract.connect(eve);
        await expect(
          contract.addLore(
            1,
            wizardsContract.address,
            9,
            0,
            false,
            'https://foo.bar/9'
          )
        ).to.be.revertedWith('Owner: caller is not the Wizard owner');
      });
    });
    describe('when updating lore metadata', () => {
      beforeEach(async () => {
        contract = await contract.connect(alice);
        await contract.addLore(
          1,
          wizardsContract.address,
          9,
          0,
          false,
          'https://foo.bar/9'
        );

        const lore = await contract.wizardLore(1, 0);
        expect(lore.loreMetadataURI).to.eq('https://foo.bar/9');
      });

      it('should allow the creator-owner of the Lore update the metadataURL', async () => {
        await contract.updateLoreMetadataURI(1, 0, 'https://bar.co/9');
        const loreUpdated = await contract.wizardLore(1, 0);
        expect(loreUpdated.loreMetadataURI).to.eq('https://bar.co/9');
      });

      it(`should not allow the owner of the Wizard to update the Lore if they didn't create the Lore`, async () => {
        // transfer away wizard 1
        wizardsContract = await wizardsContract.connect(alice);
        await wizardsContract.transferFrom(alice.address, bob.address, 1);

        contract = await contract.connect(alice);
        await expect(
          contract.updateLoreMetadataURI(1, 0, 'https://bar.co/9')
        ).to.be.revertedWith('Owner: caller is not the Wizard owner');

        const lore = await contract.wizardLore(1, 0);
        expect(lore.loreMetadataURI).to.eq('https://foo.bar/9');
      });
      it(`should not allow just anyone to update the Lore`, async () => {
        contract = await contract.connect(eve);
        await expect(
          contract.updateLoreMetadataURI(1, 0, 'https://bar.co/9')
        ).to.be.revertedWith('Owner: caller is not the Lore creator');

        const lore = await contract.wizardLore(1, 0);
        expect(lore.loreMetadataURI).to.eq('https://foo.bar/9');
      });
    });

    describe('when updating lore nsfw', () => {
      beforeEach(async () => {
        contract = await contract.connect(alice);
        await contract.addLore(
          1,
          wizardsContract.address,
          9,
          0,
          false,
          'https://foo.bar/9'
        );

        const lore = await contract.wizardLore(1, 0);
        expect(lore.nsfw).to.eq(false);
      });
      it('should allow the creator-owner of the Lore update the nsfw', async () => {
        await contract.updateLoreNSFW(1, 0, true);
        const loreUpdated = await contract.wizardLore(1, 0);
        expect(loreUpdated.nsfw).to.eq(true);
      });
      it(`should not allow the owner of the Wizard to update the nsfw of Lore if they didn't create the Lore`, async () => {
        // transfer away wizard 1
        wizardsContract = await wizardsContract.connect(alice);
        await wizardsContract.transferFrom(alice.address, bob.address, 1);

        contract = await contract.connect(alice);
        await expect(contract.updateLoreNSFW(1, 0, true)).to.be.revertedWith(
          'Owner: caller neither the Lore creator nor the Lore Master'
        );

        const lore = await contract.wizardLore(1, 0);
        expect(lore.nsfw).to.eq(false);
      });
      it(`should not allow just anyone to update nsfw`, async () => {
        contract = await contract.connect(eve);
        await expect(contract.updateLoreNSFW(1, 0, true)).to.be.revertedWith(
          'Owner: caller neither the Lore creator nor the Lore Master'
        );
        const lore = await contract.wizardLore(1, 0);
        expect(lore.nsfw).to.eq(false);
      });
      it(`should allow the Lore Master to update nsfw`, async () => {
        contract = await contract.connect(wallet);

        await contract.updateLoreNSFW(1, 0, true);
        const loreUpdated = await contract.wizardLore(1, 0);
        expect(loreUpdated.nsfw).to.eq(true);
      });
    });
    describe('when striking lore', () => {
      beforeEach(async () => {
        contract = await contract.connect(alice);
        await contract.addLore(
          1,
          wizardsContract.address,
          9,
          0,
          false,
          'https://foo.bar/9'
        );
        await contract.addLore(
          1,
          wizardsContract.address,
          8,
          0,
          false,
          'https://foo.bar/8'
        );

        const lore = await contract.wizardLore(1, 0);
        expect(lore.struck).to.eq(false);
        const lore2 = await contract.wizardLore(1, 0);
        expect(lore2.struck).to.eq(false);
      });

      it(`should allow the Lore Master to Strike Lore`, async () => {
        contract = await contract.connect(wallet);

        {
          const lore = await contract.wizardLore(1, 0);
          expect(lore.struck).to.eq(false);
          await contract.strikeLore(1, 0, true);
          const loreUpdated = await contract.wizardLore(1, 0);
          expect(loreUpdated.struck).to.eq(true);
        }
        {
          const lore = await contract.wizardLore(1, 1);
          expect(lore.struck).to.eq(false);
          await contract.strikeLore(1, 1, true);
          const loreUpdated = await contract.wizardLore(1, 1);
          expect(loreUpdated.struck).to.eq(true);
        }
      });
      it(`should not allow anyone else to Strike Lore`, async () => {
        contract = await contract.connect(eve);
        const lore = await contract.wizardLore(1, 1);
        expect(lore.struck).to.eq(false);

        await expect(contract.strikeLore(1, 1, true)).to.be.revertedWith(
          'Ownable: caller is not the Lore Master'
        );

        const loreUpdated = await contract.wizardLore(1, 1);
        expect(loreUpdated.struck).to.eq(false);
      });
    });
    describe('when adding to the overall narrative', () => {
      it(`should allow the Lore Master to add narrative Lore`, async () => {
        contract = await contract.connect(wallet);

        await contract.addNarrative(
          wizardsContract.address,
          9,
          0,
          false,
          'https://foo.bar/9'
        );

        await contract.addNarrative(
          wizardsContract.address,
          8,
          1,
          true,
          'https://foo.bar/8'
        );

        await contract.addNarrative(
          wizardsContract.address,
          7,
          0,
          false,
          'https://foo.bar/7'
        );

        expect(await contract.numNarrative()).to.eq(3);

        const lore1Attributes = {
          creator: wallet.address,
          assetAddress: wizardsContract.address,
          tokenId: BigNumber.from(9),
          nsfw: false,
          struck: false,
          loreMetadataURI: 'https://foo.bar/9',
        };
        const lore2Attributes = {
          creator: wallet.address,
          assetAddress: wizardsContract.address,
          tokenId: BigNumber.from(8),
          nsfw: true,
          struck: false,
          loreMetadataURI: 'https://foo.bar/8',
        };
        const lore3Attributes = {
          creator: wallet.address,
          assetAddress: wizardsContract.address,
          tokenId: BigNumber.from(7),
          nsfw: false,
          struck: false,
          loreMetadataURI: 'https://foo.bar/7',
        };

        const loreSubset1 = await contract.narrativeAt(0, 2);
        expect(loreSubset1.length).to.equal(3);
        expect(loreSubset1).to.containSubset([
          lore1Attributes,
          lore2Attributes,
          lore3Attributes,
        ]);

        const loreSubset2 = await contract.narrativeAt(1, 2);
        expect(loreSubset2.length).to.equal(2);
        expect(loreSubset2).to.containSubset([
          lore2Attributes,
          lore3Attributes,
        ]);

        const loreSubset3 = await contract.narrativeAt(2, 2);
        expect(loreSubset3.length).to.equal(1);
        expect(loreSubset3).to.containSubset([lore3Attributes]);
      });

      it(`should not allow anyone else to add narrative Lore`, async () => {
        contract = await contract.connect(eve);

        await expect(
          contract.addNarrative(
            wizardsContract.address,
            9,
            0,
            false,
            'https://foo.bar/9'
          )
        ).to.be.revertedWith('Ownable: caller is not the Lore Master');
      });
    });
  });
});

// hardhat test --network hardhat test/BookOfLore.spec.ts
// make sure hardhat.config.ts hardhat network isn't forking
