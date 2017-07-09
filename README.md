
## Chainsaw Usage :

1) Clone this repository https://github.com/SpankChain/chainsaw.git .
2) In your nodejs code , add the following .

``` nodejs
//Currently it has dependencies to reading from the webhook file .
chainsaw = require('path_to_chainsaw/lib/chainsaw.js');
chainsaw.allEvents() ;
```

## Configuration 
Replace following configuration , with your own local configuration .

```
{
  "MONGO_URL":"mongodb://127.0.0.1:27017/chainsaw",
  "SOLIDTY_CONTRACT_SRC":"./contracts/contracts/Broker.sol",
  "CONTRACT_ADDRESS": "0x04d3d808e0c6d9aabeee09b1809250ec4ab08205",
  "WEB3_PROVIDER": "http://127.0.0.1:8545"
}
``` 
