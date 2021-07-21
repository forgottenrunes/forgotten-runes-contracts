import '../src/env';
import { run, ethers, network, artifacts } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import {
  ContractFactory,
  constants,
  utils,
  Contract,
  Wallet,
  Signer,
  PopulatedTransaction,
} from 'ethers';
import { LedgerSigner } from '@ethersproject/hardware-wallets';
import { parseUnits } from '@ethersproject/units';
import { promises } from 'fs';
import fs from 'fs';
import { abi as ForgottenRunesDecoderCrystalABI } from '../artifacts/contracts/ForgottenRunesDecoderCrystal.sol/ForgottenRunesDecoderCrystal.json';

if (!process.env.DEPLOY_ENV) {
  throw new Error(
    'Please specify a DEPLOY_ENV={mainnet,ropsten,matic,localhost}'
  );
}

async function deploy() {
  const deployEnv = process.env.DEPLOY_ENV;
  const provider = ethers.provider;
  //   console.log('provider: ', provider);

  let signer: Signer;

  switch (deployEnv) {
    case 'localhost': {
      let wallet = Wallet.fromMnemonic(
        process.env.LOCALHOST_MNEMONIC,
        `m/44'/60'/0'/0/0`
      );
      wallet = wallet.connect(provider);
      signer = wallet;
      break;
    }
    case 'mainnet':
    case 'ropsten':
    case 'rinkeby':
    case 'matic': {
      const ledger = await new LedgerSigner(
        provider as any,
        'hid',
        "m/44'/60'/0'/0/0"
      );
      signer = ledger as Signer;
      break;
    }
  }

  const signerAddress = await signer.getAddress();
  console.log('Signer:', signerAddress);

  const balance = await provider.getBalance(signerAddress);
  console.log('Balance:', balance.toString());

  const overrides = {
    gasPrice: parseUnits('20', 'gwei'),
    //   nonce: 1
  };

  let forgottenRunesFactory = await ethers.getContractFactory(
    'ForgottenRunesBadges'
  );
  forgottenRunesFactory = forgottenRunesFactory.connect(signer);

  let deployTx = await forgottenRunesFactory.getDeployTransaction(overrides);

  let txResponse = await signer.sendTransaction(deployTx);
  console.log('Submitted tx:', txResponse.hash);

  const receipt = await provider.waitForTransaction(
    txResponse.hash,
    1, // confirmations
    60 * 1000 * 30
  );

  console.log('receipt: ', receipt);
  const gasUsed = receipt.gasUsed;
  console.log('gasUsed:', gasUsed.toString());

  const contractAddress = receipt.contractAddress;
  console.log('contractAddress: ', contractAddress);
}

deploy()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

// DEPLOY_ENV=localhost hardhat --network localhost run scripts/deploy_badges.ts

// DEPLOY_ENV=rinkeby hardhat --network rinkeby run scripts/deploy_badges.ts

// DEPLOY_ENV=rinkeby hardhat verify --network rinkeby 0xdD1187616b4Fc25Fb410C0D3Cc2D6A9aEcd4AC98

// DEPLOY_ENV=mainnet hardhat --network mainnet run scripts/deploy_badges.ts

// DEPLOY_ENV=mainnet hardhat verify --network mainnet 0x47aaad556Ee0C08F9Cb349BB3d6A024b4304842F
