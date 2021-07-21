import { formatUnits, parseEther, parseUnits } from '@ethersproject/units';
import { WeiPerEther } from '@ethersproject/constants';

export function printGasEstimate({ gasAmount }) {
  const gasPrice = parseUnits('20', 'gwei');
  const ethUsdCents = 2000 * 100;

  const gasCostUsd = gasAmount
    .mul(gasPrice)
    .mul(ethUsdCents)
    .div(WeiPerEther);
  console.log('gasCostUsd:', gasCostUsd.toNumber() / 100);
}
