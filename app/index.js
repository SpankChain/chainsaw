const express = require(`express`);
const app = express();
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
  jsonfile.readFile(webhookFile, function(err, obj) {
    if (err) {
      // Create new file and add the webhooks .
      let webhook = {
        [contractEvent]: [contractHook]
      };
      // Create and Add a file .
      jsonfile.writeFile(webhookFile, webhook, function(err) {
        console.log(err);
      });
    } else {
      // TODO : Don't append duplicate hooks .
      // Appending to the incoming object .
      obj[contractEvent].push(contractHook);

      // write to file now
      jsonfile.writeFile(webhookFile, obj, function(err) {
        console.log(err);
      });
    }
  });
}

const deleteHook = (contractEvent, contractHook) => {
  // Todo : Delete an webhook, will implement
  // this soon .
  jsonfile.readFile(webhookFile, function(err, obj) {
    if (!err) {
      let hooks = obj[contractEvent];
      for (let i = 0; i < hooks.length; i++)
        if (hooks[i] == contractHook) {
          // Remove the hook from the array
          hooks.splice(i, 1);
          break;
        }

      // write to file now
      jsonfile.writeFile(webhookFile, obj, function(err) {
        console.log(err);
      });
    } else {
      // Some error handling here .
      console.log(err);
    }

  })
}

const findEventAndWatch = (contractEvent, contractHook, channelId) => {
  switch (contractEvent) {
    case 'DidDeposit':
      chainsaw.didDepositEvent(channelId);
      break;
    case 'DidSettle':
      chainsaw.didSettleEvent(channelId);
      break;
    case 'DidStartSettle':
      chainsaw.didStartSettleEvent(channelId);
      break;
    default:
      break;
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
  const contractHook = req.body.hook;

  // Adding the data to hook .
  addHook(contractEvent, contractHook);
  // Find the event and watch them.
  findEventAndWatch(contractEvent, contractHook, "");

  res.end(`{'Ok' : 200 }`);
});

app.delete("/register/event", (req, res) => {
  const contractEvent = req.body.event;
  const contractHook = req.body.hook;

  // Delete the hook .
  deleteHook(contractEvent, contractHook);

  res.end(`{'Ok' : 200 }`);
});

app.post("/register/channel", (req, res) => {
  const channelId = req.body.channelId;
  const contractEvent = req.body.event;
  const contractHook = req.body.hook;

  // Adding hook for the event
  addHook(contractEvent, contractHook);

  //Find and watch events
  findEventAndWatch(contractEvent, contractHook, channelId);

  res.end(`{'Ok' : 200 }`);
});

app.delete("/register/channel", (req, res) => {
  const channelId = req.body.channelId;
  const contractHook = req.body.hook;
  const contractEvent = req.body.event;

  // Delete the hook for the channel.
  deleteHook(contractEvent, contractHook);

});

http.createServer(app).listen(PORT, (err) => {
  if (err) throw err;
  console.log(`Hub listening on the ${PORT}.`);
});