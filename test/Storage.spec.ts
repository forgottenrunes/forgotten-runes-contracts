import chai from 'chai';
import { Contract, Wallet } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { BigNumber } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { Signer } from 'ethers';
import { AddressZero } from '@ethersproject/constants';
import { TransactionRequest, Web3Provider } from '@ethersproject/providers';
import { formatUnits, parseUnits } from '@ethersproject/units';
import { WeiPerEther } from '@ethersproject/constants';
import { hexDataSlice, keccak256, sha256, toUtf8Bytes } from 'ethers/lib/utils';
import { storageFixture } from './fixtures';

// import Storage from '../artifacts/src/contracts/scratch/Storage.sol/Storage.json';
// import StorageChi from '../artifacts/src/contracts/test/StorageChi.sol/StorageChi.json';

// https://docs.ethers.io/v5/single-page/#/v5/api/signer/
chai.use(solidity);
const { expect } = chai;

const overrides = {
  gasLimit: 9999999,
};

describe('Storage', () => {
  let storage: Contract;
  let wallet: any;
  const provider = waffle.provider;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    wallet = signers[0];
    let fixture = await storageFixture([wallet], provider);
    ({ storage } = fixture);
  });

  describe('when using Storage directly', () => {
    it('works', async () => {
      expect(await storage.retrieve()).to.eq(0);
      const receipt = await storage.store(42);
      expect(await storage.retrieve()).to.eq(42);
    });

    it('works via abi', async () => {
      expect(await storage.retrieve()).to.eq(0);
      const signers = await ethers.getSigners();
      const signer = signers[0];
      const data = storage.interface.encodeFunctionData('store', [43]);
      const transactionRequest: TransactionRequest = {
        to: storage.address,
        data,
      };
      await signer.sendTransaction(transactionRequest);
      expect(await storage.retrieve()).to.eq(43);
    });

    it('should estimate gas', async () => {
      expect(await storage.retrieve()).to.eq(0);

      const gasPrice = await provider.getGasPrice();
      // console.log('gasPrice: ', gasPrice, gasPrice.toString());
      const tx = await storage.populateTransaction.store(42, {
        nonce: 4,
      });
      //   console.log('tx: ', tx);
      const gasEstimate = await provider.estimateGas(tx);
      //   console.log('gasEstimate: ', gasEstimate, gasEstimate.toString());
      const gasCost = gasPrice.mul(gasEstimate);
      //   console.log('gasCost: ', gasCost, gasCost.toString());
      const ethUsdCents = await Promise.resolve(1000 * 100); // getEthUSD();
      const gasCostUsd = gasCost.mul(ethUsdCents).div(WeiPerEther);
      const receipt = await storage.store(42);
      const transactionReceipt = await receipt.wait();
      const { blockNumber, blockHash, gasUsed } = transactionReceipt;
      const gasFee = gasUsed.mul(receipt.gasPrice);
      expect(await storage.retrieve()).to.eq(42);
    });
  });
});
