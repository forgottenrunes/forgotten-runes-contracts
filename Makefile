compile-contracts:
	hardhat compile

deploy-dev:
	hardhat deploy --network localhost 

deploy-dev-export:
	hardhat export --network localhost --export deployments/lore_dev.json

test-storage:
	hardhat test --network hardhat test/Storage.spec.ts

test-watch:
	nodemon --exec ./node_modules/.bin/hardhat test --network hardhat test/BookOfLore.spec.ts