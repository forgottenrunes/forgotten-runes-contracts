import '../src/env';
import { LedgerSigner } from '@ethersproject/hardware-wallets';
import { parseUnits } from '@ethersproject/units';
import { ethers, Signer, Wallet } from 'ethers';
import * as yargs from 'yargs';
import { getProvider, getSigner } from '../src/provider';
import { ContractFactory } from 'ethers';
import {
  abi as BookOfLoreAbi,
  bytecode as BookOfLoreBytecode,
} from '../artifacts/contracts/BookOfLore.sol/BookOfLore.json';
import { runBasicTx } from '../src/basicTx';

if (!process.env.DEPLOY_ENV) {
  throw new Error(
    'Please specify a DEPLOY_ENV={mainnet,ropsten,matic,localhost}'
  );
}

const argv = yargs
  .usage('$0 <cmd> [args]')
  .option('lore', {
    describe: 'address of the lore contract',
    string: true,
    required: true,
  })
  .option('tokenContract', {
    describe: 'address of the token contract',
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
    let contract = new ethers.Contract(argv.lore, BookOfLoreAbi, provider);
    contract = contract.connect(signer);
    let tx = await contract.populateTransaction.setLoreTokenAllowlist(
      argv.tokenContract,
      true,
      overrides
    );
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

// DEPLOY_ENV=rinkeby ts-node scripts/lore_allowlist.ts --gas 90 --lore 0xe6d5ed58B39aC190A5e347B87F018561036b56B9 --tokenContract 0x521f9C7505005CFA19A8E5786a9c3c9c9F5e6f42
