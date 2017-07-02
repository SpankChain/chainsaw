const express = require(`express`);
const app = express() ;
const http = require(`http`);
const WebHooks = require('node-webhooks');
const Web3 = require('web3');
const config = require('../lib/configuration.js');
const chainsaw = require('../lib/chainsaw.js');
const bodyParser = require(`body-parser`);
const jsonfile = require('jsonfile');
const webhookFile = './webhooks/data.json';

const PORT = process.env.PORT || 6666;

// Initialize web3 with testrpc provider
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

const addHook = (contractEvent, contractHook) => {
  jsonfile.readFile(webhookFile, function(err,obj){
    if (err)
    {
      // Create new file and add the webhooks .
      let webhook = {
        [contractEvent]: [contractHook]
      };
      // Create and Add a file .
      jsonfile.writeFile(webhookFile, webhook, function(err){
        console.log(err);
      });
    }
    else{
      // TODO : Don't append duplicate hooks .
      // Appending to the incoming object .
      obj[contractEvent].push(contractHook);

      // write to file now
      jsonfile.writeFile(webhookFile, obj, function(err){
        console.log(err);
      });
    }
  });
}

const deleteHook = (contractEvent, contractHook) => {
  // Todo : Delete an webhook, will implement
  // this soon .
}

const findEventAndWatch = (contractEvent, contractHook) => {
  switch(contractEvent){
    case 'DidDeposit':
      chainsaw.didDepositEvent() ;
      break ;
    case 'DidSettle':
      chainsaw.didSettleEvent() ;
      break ;
    case 'DidStartSettle':
      chainsaw.didStartSettleEvent() ;
      break ;
    default:
      break ;
  }
}

app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
    extended: true
}));

app.get("/", (req, res) => {
  res.setHeader(`Cache-Control`, `public, max-age=86400`);
  res.statusCode = 200;
  res.type(`text`);
  res.end("Hello from Hub");
});

// TODO : remove this when you have actual hooks.
app.post("/dummy/hook", (req, res) => {
  console.log("Webhook called!");
  res.end(`{'Ok' : 200 }`);
});

app.post("/register/event", (req, res) => {
  const contractEvent = req.body.event;
  const contractHook = req.body.hook ;

  // Adding the data to hook .
  addHook(contractEvent, contractHook);

  findEventAndWatch(contractEvent,contractHook); 
  res.end(`{'Ok' : 200 }`);
});

app.delete("/register/event", (req, res) => {
  const contractEvent = req.body.event;
  const contractAddress = req.body.contractAddress;
  const contractHook = req.body.hook ;

  res.end(`{'Ok' : 200 }`);
});

app.post("/register/channel", (req, res) => {
  const channelId = req.body.channelId ;
  const contractHook = req.body.hook ;

});

app.delete("/register/channel", (req, res) => {
  const channelId = req.body.channelId ;
  const contractHook = req.body.hook ;

});

http.createServer(app).listen(PORT, (err) => {
  if (err) throw err;
  console.log(`Hub listening on the ${PORT}.`);
});
