const dotenvPath = process.env.DONUTS_ENV
  ? `.env.${process.env.DONUTS_ENV}`
  : '.env';

console.log('dotenvPath: ', dotenvPath);
export const config = require('dotenv').config({
  path: dotenvPath,
});
