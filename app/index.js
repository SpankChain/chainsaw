const express = require(`express`);
const app = express() ;
const http = require(`http`);
const WebHooks = require('node-webhooks');
const Web3 = require('web3');
const config = require('../lib/configuration.js')

const PORT = process.env.PORT || 6666;

// Initialize web3 with testrpc provider
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

var webHooks = new WebHooks({
    db: './webHooksDB.json', // json file that store webhook URLs
    httpSuccessCodes: [200, 201, 202, 203, 204], //optional success http status codes
});

app.get("/", (req, res) => {
  res.setHeader(`Cache-Control`, `public, max-age=86400`);
  res.statusCode = 200;
  res.type(`text`);
  res.end("Hello from Hub");
});

app.post("/register/event", (req, res) => {
  const contractEvent = req.body.event;
  const contractAddress = req.body.contractAddress;
  const contractHook = req.body.hook ;

  // Since it web hook is a key value pair .
  const origin = req.headers.origin ;
  console.log("contractEvent , contractAddress , contractHook");
  console.log(contractEvent);
  console.log(contractAddress);
  console.log(contractHook);
  // May be we should do origin check here
  // if (origin != "xxxx.spankchain.com:pppp")
  // {
  //
  // }

  // Each key is unique . An app which wants notification
  // can only listen to one hook per event and per contract .
  const uniqueKey = contractEvent + ":"+ contractAddress + ":"
                    origin ;

  // Add the webhook
  webhooks.add(uniqueKey, contractHook).then(function(){
      console.log("Webhook added .");
  }).catch(function(err){

  }) ;

});

app.delete("/register/event", (req, res) => {
  const contractEvent = req.body.event;
  const contractAddress = req.body.contractAddress;
  const contractHook = req.body.hook ;

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
