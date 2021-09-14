import '../src/env';
import { LedgerSigner } from '@ethersproject/hardware-wallets';
import { parseUnits } from '@ethersproject/units';
import { Signer, Wallet } from 'ethers';
import * as yargs from 'yargs';
import { getProvider } from '../src/provider';
import { ContractFactory } from 'ethers';
import {
  abi as BookOfLoreAbi,
  bytecode as BookOfLoreBytecode,
} from '../artifacts/contracts/BookOfLore.sol/BookOfLore.json';

if (!process.env.DEPLOY_ENV) {
  throw new Error(
    'Please specify a DEPLOY_ENV={mainnet,ropsten,matic,localhost}'
  );
}

const argv = yargs
  .usage('$0 <cmd> [args]')
  .option('wizards', {
    describe: 'address of the wizards contract',
    string: true,
    required: true,
  })
  .help('help').argv;

async function deploy(argv: any) {
  const deployEnv = process.env.DEPLOY_ENV;
  const provider = await getProvider();

  console.log('provider: ', provider);

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

  // let forgottenRunesFactory = await ethers.getContractFactory('BookOfLore');
  let forgottenRunesFactory = new ContractFactory(
    BookOfLoreAbi,
    BookOfLoreBytecode
  );
  forgottenRunesFactory = forgottenRunesFactory.connect(signer);
  let deployTx = await forgottenRunesFactory.getDeployTransaction(
    argv.wizards,
    overrides
  );
  console.log('deployTx: ', deployTx);

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

deploy(argv)
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

// DEPLOY_ENV=localhost ts-node scripts/deploy_lore.ts --wizards "0x9f573Fc791Ab1759F5B7332Cb5D306f964E26696"

// DEPLOY_ENV=rinkeby ts-node scripts/deploy_lore.ts --contract "0x521f9c7505005cfa19a8e5786a9c3c9c9f5e6f42"

// DEPLOY_ENV=rinkeby hardhat verify --network rinkeby 0xdEb9121865D634A15023C7724B38F5c7Db6C88bB "0x521f9c7505005cfa19a8e5786a9c3c9c9f5e6f42"

// DEPLOY_ENV=mainnet ts-node scripts/deploy_lore.ts --contract "0x521f9C7505005CFA19A8E5786a9c3c9c9F5e6f42"

// DEPLOY_ENV=mainnet hardhat verify --network mainnet 0x47aaad556Ee0C08F9Cb349BB3d6A024b4304842F
