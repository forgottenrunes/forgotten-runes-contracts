import '../src/env';
import { parseUnits } from '@ethersproject/units';
import * as yargs from 'yargs';
import { getProvider, getSigner } from '../src/provider';
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
  .option('gas', {
    describe: 'gas to pay in gwei',
    number: true,
    required: true,
  })
  .help('help').argv;

async function deploy(argv: any) {
  const provider = await getProvider();
  console.log('provider: ', provider);

  let signer = await getSigner({ provider });
  const signerAddress = await signer.getAddress();
  console.log('Signer:', signerAddress);

  const balance = await provider.getBalance(signerAddress);
  console.log('Balance:', balance.toString());

  const overrides = {
    gasPrice: parseUnits(argv.gas.toString(), 'gwei'),
  };

  let contractFactory = new ContractFactory(BookOfLoreAbi, BookOfLoreBytecode);
  contractFactory = contractFactory.connect(signer);
  let deployTx = await contractFactory.getDeployTransaction(overrides);
  console.log('deployTx: ', deployTx);

  let txResponse = await signer.sendTransaction(deployTx);
  console.log('txResponse: ', txResponse);
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

// DEPLOY_ENV=rinkeby ts-node scripts/deploy_lore.ts

// DEPLOY_ENV=rinkeby hardhat verify --network rinkeby 0xe6d5ed58B39aC190A5e347B87F018561036b56B9

// DEPLOY_ENV=mainnet ts-node scripts/deploy_lore.ts --contract "0x521f9C7505005CFA19A8E5786a9c3c9c9F5e6f42"

// DEPLOY_ENV=mainnet hardhat verify --network mainnet 0x47aaad556Ee0C08F9Cb349BB3d6A024b4304842F
