import { Contract } from 'ethers';
import { Web3Provider } from '@ethersproject/providers';

import { BigNumber, utils } from 'ethers';

export function expandToDecimals(n: number, decimals: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(decimals));
}

export function expandTo18Decimals(n: number): BigNumber {
  return expandToDecimals(n, 18);
}
