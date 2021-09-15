import { formatUnits } from '@ethersproject/units';
import { getAddress } from 'ethers/lib/utils';
import './src/env';

import { HardhatUserConfig } from 'hardhat/types';

import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-typechain';
import { task } from 'hardhat/config';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';
import { Wallet } from 'ethers';
import 'hardhat-gas-reporter';

const accounts = {
  mnemonic: process.env.MNEMONIC,
};

const deployerPaths = {
  default: {
    deploy: './deploy',
    deployments: './deployments',
  },
};

type DeployerConfig = {
  namedAccounts: {
    [key: string]: number | string;
  };
};

const HARDHAT_FORK_CHAIN_URL = {
  localhost: process.env.ALCHEMY_HTTP_ENDPOINT,
  mainnet: process.env.ALCHEMY_HTTP_ENDPOINT,
  ropsten: process.env.ROPSTEN_HTTP_ENDPOINT,
  rinkeby: process.env.RINKEBY_HTTP_ENDPOINT,
  bsc: process.env.BSC_RPC_AUTH_ENDPOINT,
  poly: process.env.POLY_RPC_AUTH_ENDPOINT,
};

const forkChain = process.env.FORK_CHAIN || 'mainnet';

const config: HardhatUserConfig & DeployerConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [
      {
        version: '0.8.0',
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
      {
        version: '0.7.3',
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
  },
  namedAccounts: {
    deployer: 0,
    sponsor: 1,
    treasury: 2,
    taxes: 3,
    bot: 4,
  },
  networks: {
    hardhat: {
      chainId: 31337,
      loggingEnabled: false,
      // forking: {
      //   url: HARDHAT_FORK_CHAIN_URL[forkChain],
      // },
    },
    localhost: {
      url: process.env.NETWORK_URL,
    },
    coverage: {
      url: 'http://127.0.0.1:8555',
    },
    ropsten: {
      url: process.env.ROPSTEN_HTTP_ENDPOINT,
    },
    rinkeby: {
      url: process.env.RINKEBY_HTTP_ENDPOINT,
    },
    polygon: {
      url: process.env.POLYGON_URL,
    },
    mainnet: {
      url: process.env.ALCHEMY_HTTP_ENDPOINT,
    },
    eth: {
      url: process.env.ALCHEMY_HTTP_ENDPOINT,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_TOKEN,
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 10,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_KEY,
  },
  paths: {
    sources: './contracts',
    artifacts: './artifacts',
    ...deployerPaths[process.env.DEPLOYER_ENV || 'default'],
  },
  external: {
    contracts: [
      {
        artifacts: 'node_modules/@uniswap/v2-core/build',
      },
      {
        artifacts: 'node_modules/@uniswap/v2-periphery/build',
      },
    ],
  },
};

export default config;

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.address);
  }
});

task('blockNumber', 'Prints the block number', async (_, { ethers }) => {
  const blockNumber = await ethers.provider.getBlockNumber();
  console.log(blockNumber);
});

task('balance', "Prints an account's balance")
  .addPositionalParam('account', "The account's address")
  .setAction(async (taskArgs, { ethers }) => {
    const balance = await ethers.provider.getBalance(
      await getAddress(taskArgs.account)
    );
    console.log(formatUnits(balance as any, 'ether'), 'ETH');
  });

task('fundTestWallet', 'funds the test wallet').setAction(
  async (taskArgs, { network, ethers }) => {
    const amount = '1000';

    let mainWallet = Wallet.fromMnemonic(
      process.env.WALLET1_MNEMONIC,
      `m/44'/60'/0'/0/0`
    );

    console.log(
      '💵 Sending ' +
        amount +
        ' ETH to ' +
        mainWallet.address +
        ' using local node'
    );

    const tx = {
      to: mainWallet.address,
      value: ethers.utils.parseEther(amount),
    };

    const txResponse = await ethers.provider.getSigner().sendTransaction(tx);

    const receipt = await txResponse.wait();
    console.log('receipt: ', receipt);
  }
);
