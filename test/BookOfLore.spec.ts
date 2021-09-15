import { WeiPerEther } from '@ethersproject/constants';
import { parseUnits } from '@ethersproject/units';
import chai from 'chai';
import chaiSubset from 'chai-subset';
import { solidity } from 'ethereum-waffle';
import { BigNumber, Contract, Wallet } from 'ethers';
import { ethers, waffle } from 'hardhat';
import * as ethSigUtil from 'eth-sig-util';

chai.use(chaiSubset);
chai.use(solidity);
const { expect } = chai;

const overrides = {
  gasLimit: 9999999,
};

const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

function printGasEstimate({ gasAmount }) {
  const gasPrice = parseUnits('60', 'gwei');
  const ethUsdCents = 3500 * 100;

  const gasCostUsd = gasAmount
    .mul(gasPrice)
    .mul(ethUsdCents)
    .div(WeiPerEther);
  console.log('gasCostUsd:', gasCostUsd.toNumber() / 100);
}

async function domainSeparator(name, version, chainId, verifyingContract) {
  return (
    '0x' +
    ethSigUtil.TypedDataUtils.hashStruct(
      'EIP712Domain',
      { name, version, chainId, verifyingContract },
      { EIP712Domain }
    ).toString('hex')
  );
}

describe('ForgottenRunes BookOfLore', () => {
  let wallet: any;
  let alice: any;
  let bob: any;
  let eve: any;
  const provider = waffle.provider;
  let wizardsContract: Contract;
  let blizzardsContract: Contract;
  let contract: Contract;
  let chainId: any;
  let wizards;
  let blizzards;

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
    wizards = wizardsContract.address;

    // This isn't alpha, I'm just testing
    const blizzardFactory = await ethers.getContractFactory(
      'ForgottenRunesWizardsCult',
      signers[0]
    );
    blizzardsContract = await blizzardFactory.deploy('https://bar.com');
    blizzards = blizzardsContract.address;

    const contractFactory = await ethers.getContractFactory(
      'BookOfLore',
      signers[0]
    );
    contract = await contractFactory.deploy();
    await contract.deployed();
    chainId = await wallet.getChainId();
  });

  describe('BookOfLore', () => {
    beforeEach(async () => {
      expect(await wizardsContract.totalSupply()).to.eq(0);
      await wizardsContract.reserve(10);
      expect(await wizardsContract.totalSupply()).to.eq(10);
      await wizardsContract.transferFrom(wallet.address, alice.address, 1);
      await wizardsContract.transferFrom(wallet.address, bob.address, 2);

      await contract.setLoreTokenAllowlist(wizards, true);
    });

    it('owner should be the deployer', async () => {
      expect(await contract.owner()).to.eq(wallet.address);
    });

    it('should have wizards on the allowlist', async () => {
      expect(await contract.loreTokenContractAllowlist(wizards)).to.eq(true);
    });

    describe('when adding lore', () => {
      it('should allow the owner of a Wizard to add Lore to that Wizard', async () => {
        contract = await contract.connect(alice);
        const response = await contract.addLore(
          wizards,
          1,
          0,
          false,
          'https://foo.bar/9'
        );
        const receipt = await response.wait();
        expect(receipt.gasUsed.toNumber()).to.be.lt(200000);
        // printGasEstimate({ gasAmount: receipt.gasUsed });

        await contract.addLore(wizards, 1, 1, true, 'https://foo.bar/8');

        await contract.addLore(wizards, 1, 0, false, 'https://foo.bar/7');

        expect(await contract.numLore(wizards, 1)).to.eq(3);

        const lore = await contract.tokenLore(wizards, 1, 0);

        const lore1Attributes = {
          creator: alice.address,
          nsfw: false,
          struck: false,
          loreMetadataURI: 'https://foo.bar/9',
        };
        const lore2Attributes = {
          creator: alice.address,
          nsfw: true,
          struck: false,
          loreMetadataURI: 'https://foo.bar/8',
        };
        const lore3Attributes = {
          creator: alice.address,
          nsfw: false,
          struck: false,
          loreMetadataURI: 'https://foo.bar/7',
        };

        expect(lore).to.containSubset(lore1Attributes);

        const loreSet = await contract.loreFor(wizards, 1);
        expect(loreSet).to.containSubset([
          lore1Attributes,
          lore2Attributes,
          lore3Attributes,
        ]);

        const loreSubset1 = await contract.loreAt(wizards, 1, 0, 2);
        expect(loreSubset1.length).to.equal(3);
        expect(loreSubset1).to.containSubset([
          lore1Attributes,
          lore2Attributes,
          lore3Attributes,
        ]);

        const loreSubset2 = await contract.loreAt(wizards, 1, 1, 2);
        expect(loreSubset2.length).to.equal(2);
        expect(loreSubset2).to.containSubset([
          lore2Attributes,
          lore3Attributes,
        ]);

        const loreSubset3 = await contract.loreAt(wizards, 1, 2, 2);
        expect(loreSubset3.length).to.equal(1);
        expect(loreSubset3).to.containSubset([lore3Attributes]);
      });

      it('should not allow a non-owner of a Wizard to add Lore to that Wizard', async () => {
        contract = await contract.connect(eve);
        await expect(
          contract.addLore(wizards, 1, 0, false, 'https://foo.bar/9')
        ).to.be.revertedWith('Owner: caller is not the token owner');
      });
    });

    describe('when adding lore by signature with EIP-712', () => {
      // https://docs.ethers.io/v5/api/signer/#Signer
      // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/3935b907d40c9a23b04b721c2f61758df1caf722/contracts/mocks/EIP712External.sol#L7
      // https://gist.github.com/ajb413/6ca63eb868e179a9c0a3b8dc735733cf
      let eip712Types = {
        AddLore: [
          { name: 'tokenContract', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'loreId', type: 'uint256' },
          { name: 'parentLoreId', type: 'uint256' },
          { name: 'nsfw', type: 'bool' },
          { name: 'loreMetadataURI', type: 'string' },
        ],
      };

      let eip712Domain;

      beforeEach(() => {
        eip712Domain = {
          name: 'BookOfLore',
          version: '1',
          chainId,
          verifyingContract: contract.address,
        };
      });

      it('has a domain separator', async function() {
        expect(await contract.domainSeparator()).to.equal(
          await domainSeparator('BookOfLore', '1', chainId, contract.address)
        );
      });

      it('should allow an outside account to add lore', async () => {
        // alice owns wizard 1
        expect(await wizardsContract.ownerOf(1)).to.eq(alice.address);

        const message = {
          tokenContract: wizards,
          tokenId: 1,
          loreId: 0,
          parentLoreId: 0,
          nsfw: false,
          loreMetadataURI: 'https://foo.bar/signed-01',
        };

        const signature = await alice._signTypedData(
          eip712Domain,
          eip712Types,
          message
        );

        // but bob submits
        contract = await contract.connect(bob);
        await contract.addLoreWithSignature(
          signature,
          wizards,
          1,
          0,
          0,
          false,
          'https://foo.bar/signed-01'
        );

        const lore = await contract.tokenLore(wizards, 1, 0);
        expect(lore.loreMetadataURI).to.eq('https://foo.bar/signed-01');
      });
      it('should not allow an outside account to add lore if the signature is wrong', async () => {
        // bob submits
        contract = await contract.connect(bob);

        await expect(
          contract.addLoreWithSignature(
            123, // nonsense
            wizards,
            1,
            0,
            0,
            false,
            'https://foo.bar/signed-01'
          )
        ).to.be.revertedWith('ECDSA: invalid signature length');
      });
      it('should not allow an outside account to add lore if signing account is no longer the wizard holder', async () => {
        // alice owns wizard 1
        expect(await wizardsContract.ownerOf(1)).to.eq(alice.address);

        const message = {
          tokenContract: wizards,
          tokenId: 1,
          loreId: 0,
          parentLoreId: 0,
          nsfw: false,
          loreMetadataURI: 'https://foo.bar/signed-01',
        };

        // and signs a valid message
        const signature = await alice._signTypedData(
          eip712Domain,
          eip712Types,
          message
        );

        // but then alice transfers the wizard to bob
        wizardsContract = await wizardsContract.connect(alice);
        await wizardsContract.transferFrom(alice.address, bob.address, 1);

        // but eve submits
        contract = await contract.connect(eve);
        expect(
          contract.addLoreWithSignature(
            signature,
            wizards,
            1,
            0,
            0,
            false,
            'https://foo.bar/signed-01'
          )
        ).to.be.revertedWith(
          'addLoreWithSignature: signature is not the current token owner'
        );
      });

      it('should not allow an outside account to add lore if the nonce is wrong', async () => {
        // alice owns wizard 1
        expect(await wizardsContract.ownerOf(1)).to.eq(alice.address);

        const message = {
          tokenContract: wizards,
          tokenId: 1,
          loreId: 0,
          parentLoreId: 0,
          nsfw: false,
          loreMetadataURI: 'https://foo.bar/signed-01',
        };

        // she signs a valid message
        const signature = await alice._signTypedData(
          eip712Domain,
          eip712Types,
          message
        );

        // but then she updates directly
        contract = await contract.connect(alice);
        await contract.addLore(wizards, 1, 0, false, 'https://foo.bar/my-lore');

        // and eve submits
        contract = await contract.connect(eve);
        expect(
          contract.addLoreWithSignature(
            signature,
            wizards,
            1,
            0,
            0,
            false,
            'https://foo.bar/signed-01'
          )
        ).to.be.revertedWith('addLoreWithSignature: loreId is stale');

        // and the original lore remains
        const lore = await contract.tokenLore(wizards, 1, 0);
        expect(lore.loreMetadataURI).to.eq('https://foo.bar/my-lore');
      });
    });

    describe('when updating lore metadata', () => {
      beforeEach(async () => {
        contract = await contract.connect(alice);
        await contract.addLore(wizards, 1, 0, false, 'https://foo.bar/9');

        const lore = await contract.tokenLore(wizards, 1, 0);
        expect(lore.loreMetadataURI).to.eq('https://foo.bar/9');
      });

      it('should allow the creator-owner of the Lore update the metadataURL', async () => {
        await contract.updateLoreMetadataURI(wizards, 1, 0, 'https://bar.co/9');
        const loreUpdated = await contract.tokenLore(wizards, 1, 0);
        expect(loreUpdated.loreMetadataURI).to.eq('https://bar.co/9');
      });

      it(`should not allow the owner of the Wizard to update the Lore if they didn't create the Lore`, async () => {
        // transfer away wizard 1
        wizardsContract = await wizardsContract.connect(alice);
        await wizardsContract.transferFrom(alice.address, bob.address, 1);

        contract = await contract.connect(alice);
        await expect(
          contract.updateLoreMetadataURI(wizards, 1, 0, 'https://bar.co/9')
        ).to.be.revertedWith('Owner: caller is not the token owner');

        const lore = await contract.tokenLore(wizards, 1, 0);
        expect(lore.loreMetadataURI).to.eq('https://foo.bar/9');
      });
      it(`should not allow just anyone to update the Lore`, async () => {
        contract = await contract.connect(eve);
        await expect(
          contract.updateLoreMetadataURI(wizards, 1, 0, 'https://bar.co/9')
        ).to.be.revertedWith('Owner: caller is not the Lore creator');

        const lore = await contract.tokenLore(wizards, 1, 0);
        expect(lore.loreMetadataURI).to.eq('https://foo.bar/9');
      });
    });

    describe('when updating lore nsfw', () => {
      beforeEach(async () => {
        contract = await contract.connect(alice);
        await contract.addLore(wizards, 1, 0, false, 'https://foo.bar/9');

        const lore = await contract.tokenLore(wizards, 1, 0);
        expect(lore.nsfw).to.eq(false);
      });
      it('should allow the creator-owner of the Lore update the nsfw', async () => {
        await contract.updateLoreNSFW(wizards, 1, 0, true);
        const loreUpdated = await contract.tokenLore(wizards, 1, 0);
        expect(loreUpdated.nsfw).to.eq(true);
      });
      it(`should not allow the owner of the Wizard to update the nsfw of Lore if they didn't create the Lore`, async () => {
        // transfer away wizard 1
        wizardsContract = await wizardsContract.connect(alice);
        await wizardsContract.transferFrom(alice.address, bob.address, 1);

        contract = await contract.connect(alice);
        await expect(
          contract.updateLoreNSFW(wizards, 1, 0, true)
        ).to.be.revertedWith(
          'Owner: caller is neither the Lore creator nor the Lore Master'
        );

        const lore = await contract.tokenLore(wizards, 1, 0);
        expect(lore.nsfw).to.eq(false);
      });
      it(`should not allow just anyone to update nsfw`, async () => {
        contract = await contract.connect(eve);
        await expect(
          contract.updateLoreNSFW(wizards, 1, 0, true)
        ).to.be.revertedWith(
          'Owner: caller is neither the Lore creator nor the Lore Master'
        );
        const lore = await contract.tokenLore(wizards, 1, 0);
        expect(lore.nsfw).to.eq(false);
      });
      it(`should allow the Lore Master to update nsfw`, async () => {
        contract = await contract.connect(wallet);

        await contract.updateLoreNSFW(wizards, 1, 0, true);
        const loreUpdated = await contract.tokenLore(wizards, 1, 0);
        expect(loreUpdated.nsfw).to.eq(true);
      });
    });
    describe('when striking lore', () => {
      beforeEach(async () => {
        contract = await contract.connect(alice);
        await contract.addLore(wizards, 1, 0, false, 'https://foo.bar/9');
        await contract.addLore(wizards, 1, 0, false, 'https://foo.bar/8');

        const lore = await contract.tokenLore(wizards, 1, 0);
        expect(lore.struck).to.eq(false);
        const lore2 = await contract.tokenLore(wizards, 1, 0);
        expect(lore2.struck).to.eq(false);
      });

      it(`should allow the Lore Master to Strike Lore`, async () => {
        contract = await contract.connect(wallet);

        {
          const lore = await contract.tokenLore(wizards, 1, 0);
          expect(lore.struck).to.eq(false);
          await contract.strikeLore(wizards, 1, 0, true);
          const loreUpdated = await contract.tokenLore(wizards, 1, 0);
          expect(loreUpdated.struck).to.eq(true);
        }
        {
          const lore = await contract.tokenLore(wizards, 1, 1);
          expect(lore.struck).to.eq(false);
          await contract.strikeLore(wizards, 1, 1, true);
          const loreUpdated = await contract.tokenLore(wizards, 1, 1);
          expect(loreUpdated.struck).to.eq(true);
        }
      });
      it(`should not allow anyone else to Strike Lore`, async () => {
        contract = await contract.connect(eve);
        const lore = await contract.tokenLore(wizards, 1, 1);
        expect(lore.struck).to.eq(false);

        await expect(
          contract.strikeLore(wizards, 1, 1, true)
        ).to.be.revertedWith(
          'Owner: caller is neither the Lore creator nor the Lore Master'
        );

        const loreUpdated = await contract.tokenLore(wizards, 1, 1);
        expect(loreUpdated.struck).to.eq(false);
      });
    });

    describe('with a second contract', () => {
      beforeEach(async () => {
        expect(await blizzardsContract.totalSupply()).to.eq(0);
        await blizzardsContract.reserve(10);
        expect(await blizzardsContract.totalSupply()).to.eq(10);
        await blizzardsContract.transferFrom(wallet.address, alice.address, 8);
        await blizzardsContract.transferFrom(wallet.address, bob.address, 9);
      });
      it('shouldnt allow a non allowlisted contract to be written as lore', async () => {
        contract = await contract.connect(alice);
        expect(
          contract.addLore(blizzards, 8, 0, false, 'https://foo.bar/8')
        ).to.be.revertedWith('tokenContract is not on the allowlist');
      });
      it('should allow other allowlisted contracts to be written as lore', async () => {
        await contract.setLoreTokenAllowlist(blizzards, true);
        contract = await contract.connect(alice);
        await contract.addLore(blizzards, 8, 0, false, 'https://foo.bar/8');
        expect(await contract.numLore(blizzards, 8)).to.eq(1);
        const lore = await contract.tokenLore(blizzards, 8, 0);
        expect(lore.loreMetadataURI).to.eq('https://foo.bar/8');
      });
    });

    describe('when writing with a Scribe', () => {
      let loreWriter: Contract;
      beforeEach(async () => {
        const loreWriterFactory = await ethers.getContractFactory(
          'LoreWriterMock',
          wallet
        );
        loreWriter = await loreWriterFactory.deploy(contract.address);
      });

      it('should not allow unscribed writes', async () => {
        loreWriter = await loreWriter.connect(alice);
        expect(
          loreWriter.writeLore(wizards, 1, 'https://foo.bar/scribelore')
        ).to.be.revertedWith('sender is not a Scribe');
      });

      describe('when the contract is a Scribe', () => {
        beforeEach(async () => {
          await contract.setScribeAllowlist(loreWriter.address, true);
        });

        it('should allow writing Lore through a scribe', async () => {
          loreWriter = await loreWriter.connect(alice);
          await loreWriter.writeLore(wizards, 1, 'https://foo.bar/scribelore');
          const lore = await contract.tokenLore(wizards, 1, 0);
          expect(lore.loreMetadataURI).to.eq('https://foo.bar/scribelore');
        });

        it('should not allow writing Lore through a scribe invalid method', async () => {
          loreWriter = await loreWriter.connect(alice);
          expect(
            loreWriter.writeLoreInvalid(
              wizards,
              1,
              'https://foo.bar/scribelore'
            )
          ).to.be.revertedWith('Owner: caller is not the token owner');
        });

        it('should not allow a non-token owner to write Lore through a Scribe', async () => {
          loreWriter = await loreWriter.connect(bob);
          expect(
            loreWriter.writeLore(wizards, 1, 'https://foo.bar/scribelore')
          ).to.be.revertedWith('Owner: tx.origin is not the token owner');
        });
      });
    });
  });
});

// hardhat test --network hardhat test/BookOfLore.spec.ts
// make sure hardhat.config.ts hardhat network isn't forking
