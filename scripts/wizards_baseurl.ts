import '../src/env';
import { parseUnits } from '@ethersproject/units';
import { ethers, Signer, Wallet } from 'ethers';
import * as yargs from 'yargs';
import { getProvider, getSigner } from '../src/provider';
import { runBasicTx } from '../src/basicTx';
import { ContractFactory } from 'ethers';
import {
  abi as Abi,
  bytecode as Bytecode,
} from '../artifacts/contracts/ForgottenRunesWizardsCult.sol/ForgottenRunesWizardsCult.json';

if (!process.env.DEPLOY_ENV) {
  throw new Error(
    'Please specify a DEPLOY_ENV={mainnet,ropsten,matic,localhost}'
  );
}

if (process.env.DEPLOY_ENV === 'mainnet') {
  throw new Error('nope. testing only');
}

const argv = yargs
  .usage('$0 <cmd> [args]')
  .option('wizards', {
    describe: 'address of the wizards contract',
    string: true,
    required: true,
  })
  .option('url', {
    describe: 'baseURI to set',
    string: true,
    required: true,
  })
  .option('gas', {
    describe: 'gas to pay in gwei',
    number: true,
    required: true,
  })
  .help('help').argv;

async function deploy(argv: any) {
  const buildTx = async ({ signer, provider, overrides }) => {
    let contract = new ethers.Contract(argv.wizards, Abi, provider);
    contract = contract.connect(signer);
    let tx = await contract.populateTransaction.setBaseURI(argv.url, overrides);
    console.log('tx: ', tx);
    return { tx };
  };

  await runBasicTx({
    gas: argv.gas.toString(),
    buildTx,
  });
}

deploy(argv)
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

// DEPLOY_ENV=localhost ts-node scripts/deploy_lore.ts --wizards "0x9f573Fc791Ab1759F5B7332Cb5D306f964E26696"

// DEPLOY_ENV=rinkeby ts-node scripts/wizards_baseurl.ts --wizards "0x521f9c7505005cfa19a8e5786a9c3c9c9f5e6f42" --url "ipfs://QmfUgAKioFE8taS41a2XEjYFrkbfpVyXYRt7c6iqTZVy9G/"
