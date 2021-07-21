import chai from 'chai';
import { Contract, Wallet } from 'ethers';

import { BigNumber } from 'ethers';
import { AddressZero } from '@ethersproject/constants';
import { Web3Provider } from '@ethersproject/providers';
import Storage from '../artifacts/contracts/Storage.sol/Storage.json';

import { expandTo18Decimals } from '../src/utilities';
import { ethers } from 'hardhat';
export type StorageFixture = { storage: Contract };
export async function storageFixture(
  [wallet]: Wallet[],
  _: Web3Provider
): Promise<StorageFixture> {
  const signers = await ethers.getSigners();
  const storageFactory = await ethers.getContractFactory('Storage', signers[0]);
  let storage = await storageFactory.deploy();
  await storage.deployed();
  return { storage };
}
