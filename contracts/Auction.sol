pragma solidity 0.4.16;
import {SafeMath} from './SafeMath.sol';
import {HumanStandardToken} from './HumanStandardToken.sol';

/*
    Two phase auction:
    1. deposit phase
    - begins when contract is deployed, ends when process bid phase begins
    - initial and incremental deposits must be equal or greater than the minimum deposit defined at contract deployment
    - buyers submit deposits on-chain
    - buyers submit signed bids off-chain (a total bid amount in WEI and a max price per token)
    2. process bid phase
    - ends when auction ends
    - strike price must be set before off-chain signed bids can be processed
    - when all bids have been processed, owner can call completeSuccessfulAuction to end auction
    - the auction will fail if the auction ends and does not meet success conditions

    Auction success conditions (defined at contract deployment) :
    - amount raised is between a minimum and maximum WEI amount
    - tokens sold are between a minimum and maximum number of tokens

    A successful auction ends when all four conditions are met and the owner calls completeSuccessfulAuction() in time.
    If an auction fails, buyers can withdraw their deposit and no tokens are distributed.

    Withdrawl :
    - owner calls ownerWithdraw()
        - a successful auction enables owner to transfer ETH and remaining tokens to wallet addresses defined at deployment
        - a failed auction provides no value transfer for the owner
    - buyers withdraw by calling withdraw()
        - a successful auction results in :
            - transfer of remaining deposit to buyer
            - transfer of sold tokens to buyer
        - a failed auction provides the buyer with a full deposit withdrawl

    Other contraints set at deployment :
    - minimum buyer deposit (applied to initial and incemental deposits)
    - maximum bonus token percentage that can be applied to a bid

    NOTES :
    - optimized for clarity and simplicity
    - cancelAuction() can be called by owner before an auction ends causing auction to fail
    - emergencyToggle() can be called by owner to prevent some functions from executing successfully
    - inspired by Nick Johnson's auction contract : https://gist.github.com/Arachnid/b9886ef91d5b47c31d2e3c8022eeea27
    - meant to be instructive yet practical. Please improve on this!
*/

contract Auction {
    using SafeMath for uint256;

    /*****
    EVENTS
    ******/
    event DepositEvent(uint blockNumber, address indexed buyerAddress, uint depositInWei, uint totalDepositInWei);
    event SetStrikePriceEvent(uint blockNumber, uint strikePriceInWei);
    event ProcessBidEvent(uint blockNumber, address indexed buyerAddress, uint tokensPurchased, uint purchaseAmountInWei);
    event AuctionSuccessEvent(uint blockNumber, uint strikePriceInWei, uint totalTokensSold, uint totalWeiRaised);
    event WithdrawEvent(uint blockNumber, address indexed buyerAddress, uint tokensReceived, uint unspentDepositInWei);

    /***********************************
    VARIABLES SET AT CONTRACT DEPLOYMENT
    ************************************/
    // ADDRESSES DEFINED AT DEPLOYMENT
    address public ownerAddress;
    address public weiWallet;
    address public tokenWallet;

    // TOKEN PROPERTIES
    HumanStandardToken public token;
    uint public tokenSupply;
    string public tokenName;
    uint8 public tokenDecimals;
    string tokenSymbol;

    // USE BLOCK NUMBER TO TRANSITION PHASES
    uint public processingPhaseStartBlock;
    uint public auctionEndBlock;

    // GLOBAL AUCTION CONDITIONS
    uint public minWeiToRaise;
    uint public maxWeiToRaise;
    uint public minTokensForSale;
    uint public maxTokensForSale;

    // OTHER AUCTION CONSTRAINTS
    uint public maxTokenBonusPercentage;
    uint public minDepositInWei;

    /*************************************
    VARIABLES SET AFTER AUCTION DEPLOYMENT
    **************************************/
    uint public strikePriceInWei;
    bool public emergencyFlag;

    /******************
    INTERNAL ACCOUNTING
    *******************/
    struct Buyer {
        uint depositInWei;  // running total of buyer's deposit
        uint bidWeiAmount;  // bid amount in WEI from off-chain signed bid
        uint totalTokens;   // total amount of tokens to distribute to buyer
        bool hasWithdrawn;  // bool to check if buyer has withdrawn
    }
    mapping(address => Buyer) public allBuyers; // mapping of address to buyer (Buyer struct)
    uint public totalTokensSold; // running total of tokens from processed bids
    uint public totalWeiRaised; // running total of WEI raised from processed bids
    bool public auctionSuccess; // bool indicating if auction ended meeting all conditions
    bool public ownerHasWithdrawn; // bool to check if owner has withdrawn

    /********
    MODIFIERS
    *********/
    modifier in_deposit_phase {
        require(block.number < processingPhaseStartBlock);
        _;
    }

    modifier in_bid_processing_phase {
        require(processingPhaseStartBlock <= block.number);
        require(block.number < auctionEndBlock);
        _;
    }

    modifier auction_complete {
        require(auctionEndBlock <= block.number);
        _;
    }

    modifier strike_price_set {
        require(0 < strikePriceInWei);
        _;
    }

    modifier owner_only {
        require(msg.sender == ownerAddress);
        _;
    }

    modifier not_in_emergency {
        require(emergencyFlag == false);
        _;
    }

    /*************************************************************************************************
    * token parameters :
        _tokenSupply : total supply of tokens
        _tokenName : token human readable name
        _tokenDecimals : decimal precision for display purposes
        _tokenSymbol : the token symbol for display purposes

    * wallets :
        _weiWallet : wallet address to transfer WEI after a successful auction
        _tokenWallet : wallet address to transfer remaining tokens after a successful auction

    * deposit constraint :
        _minDepositInWei : minimum deposit accepted in WEI (for an initial or incremental deposit)

    * auction constraints :
        a successful auction will raise at least the minimum and at most the maximum number of WEI
        _minWeiToRaise : minimum WEI to raise for a successful auction
        _maxWeiToRaise : maximum WEI to raise for a successful auction

        a successful auction will sell at least the minimum and at most the maximum number of tokens
        _minTokensForSale : minimum tokens to sell for a successful auction
        _maxTokensForSale : maximum tokens to sell for a successful auction

    * bonus precentage cap :
        _maxTokenBonusPercentage : maximum token percentage bonus that can be applied when processing bids
    ************************************************************************************************/
    function Auction(
        uint _tokenSupply,
        string _tokenName,
        uint8 _tokenDecimals,
        string _tokenSymbol,
        address _weiWallet,
        address _tokenWallet,
        uint _minDepositInWei,
        uint _minWeiToRaise,
        uint _maxWeiToRaise,
        uint _minTokensForSale,
        uint _maxTokensForSale,
        uint _maxTokenBonusPercentage,
        uint _depositWindowInBlocks,
        uint _processingWindowInBlocks) {

        require(0 < _depositWindowInBlocks);
        require(0 < _processingWindowInBlocks);
        require(0 < _minDepositInWei);
        require(_minDepositInWei <= _minWeiToRaise);
        require(_minWeiToRaise < _maxWeiToRaise);
        require(0 < _minTokensForSale);
        require(_minTokensForSale < _maxTokensForSale);

        ownerAddress = msg.sender;

        tokenSupply = _tokenSupply;
        tokenName = _tokenName;
        tokenDecimals = _tokenDecimals;
        tokenSymbol = _tokenSymbol;

        weiWallet = _weiWallet;
        tokenWallet = _tokenWallet;

        minDepositInWei = _minDepositInWei;
        minWeiToRaise = _minWeiToRaise;
        maxWeiToRaise = _maxWeiToRaise;
        minTokensForSale = _minTokensForSale;
        maxTokensForSale = _maxTokensForSale;
        maxTokenBonusPercentage = _maxTokenBonusPercentage;

        processingPhaseStartBlock = block.number + _depositWindowInBlocks;
        auctionEndBlock = processingPhaseStartBlock + _processingWindowInBlocks;

        token = new HumanStandardToken(tokenSupply, tokenName, tokenDecimals, tokenSymbol);
        require(token.transfer(this, token.totalSupply()));
        require(token.balanceOf(this) == token.totalSupply());
        require(maxTokensForSale <= token.balanceOf(this));
    }

    /**************
    BUYER FUNCTIONS
    ***************/

    // fallback function reverts
    function() {
        revert();
    }

    // buyers can deposit as many time as they want during the deposit phase
    function deposit() not_in_emergency in_deposit_phase payable {
        require(minDepositInWei <= msg.value);
        Buyer storage buyer = allBuyers[msg.sender];
		    buyer.depositInWei = SafeMath.add(buyer.depositInWei, msg.value);

        DepositEvent(block.number, msg.sender, msg.value, buyer.depositInWei);
    }

    // buyers can succefully withdraw once after the auction is over
    // - if the auction ends and all conditions have been met, the auction was successful
    // - if the auction ends and any condition has not been met, the auction has failed
    // successful auction : buyers can withdraw tokens and remaining deposit
    // failed auction : buyers can only withdraw their deposit
    function withdraw() auction_complete {
        Buyer storage buyer = allBuyers[msg.sender];
        require(buyer.hasWithdrawn == false);
        buyer.hasWithdrawn = true;
        require(minDepositInWei <= buyer.depositInWei);

        if (auctionSuccess) {
            require(token.transfer(msg.sender, buyer.totalTokens));
            msg.sender.transfer(SafeMath.sub(buyer.depositInWei, buyer.bidWeiAmount));
        } else {
            msg.sender.transfer(buyer.depositInWei);
        }

        WithdrawEvent(block.number, msg.sender, buyer.totalTokens, SafeMath.sub(buyer.depositInWei, buyer.bidWeiAmount));
    }

    /*******************
    OWNER ONLY FUNCTIONS
    ********************/

    // the strike price can only be set during the bid processing phase
    // the strike price must be greater than zero
    // the strike price can only be set once
    function setStrikePrice(uint _strikePriceInWei) not_in_emergency in_bid_processing_phase owner_only {
        require(strikePriceInWei == 0);
        require(minDepositInWei <= _strikePriceInWei);
        require(0 < _strikePriceInWei);
        strikePriceInWei = _strikePriceInWei;

        SetStrikePriceEvent(block.number, strikePriceInWei);
    }

    // off-chain bidding :
    // - signed off-chain bids are submitted during the deposit phase
    // - a bid states a token price in WEI and a total bid amount in WEI
    // - owner processes signed off-chain bids
    // the bid processing phase begins as soon as the deposit phase ends
    // a strike price must be set before bids can be processed
    // a bid must be greater than minimum deposit requirement
    // a bid must be equal or greater than the strike price
    // the total bid amount must be equal or greater than the bid's token price
    // a buyer address can only be associated with the first successful processed bid
    // signature verification is used to determine the buyer address
    // after a bid is successfully processed, the total WEI to collect and total tokens to sell are updated
    // check the total funds raised and number of tokens sold are equal or below the maximum auction success conditions
    function processBid(uint tokenBidPriceInWei, uint bidWeiAmount, uint tokenBonusPercentage, uint8 v, bytes32 r, bytes32 s)
    strike_price_set
    not_in_emergency
    in_bid_processing_phase
    owner_only
    {
        require(minDepositInWei < bidWeiAmount);
        require(strikePriceInWei <= tokenBidPriceInWei);
        require(tokenBidPriceInWei <= bidWeiAmount);

        require(0 <= tokenBonusPercentage);
        require(tokenBonusPercentage <= maxTokenBonusPercentage);

        var bidHash = sha3(address(this), tokenBidPriceInWei, bidWeiAmount);
        var buyerAddress = ecrecover(bidHash, v, r, s);

        uint numTokensPurchased = SafeMath.div(bidWeiAmount, strikePriceInWei);
        uint numBonusTokens = SafeMath.div( SafeMath.mul(tokenBonusPercentage, numTokensPurchased), 100 );

        Buyer storage buyer = allBuyers[buyerAddress];
        //require(bidWeiAmount <= buyer.depositInWei);
        require(buyer.bidWeiAmount == 0);

        buyer.totalTokens = SafeMath.add(numBonusTokens, numTokensPurchased);
        buyer.bidWeiAmount = bidWeiAmount;

        totalTokensSold = SafeMath.add(buyer.totalTokens, totalTokensSold);
        totalWeiRaised = SafeMath.add(buyer.bidWeiAmount, totalWeiRaised);

        require(totalTokensSold <= maxTokensForSale);
        require(totalWeiRaised <= maxWeiToRaise);

        ProcessBidEvent(block.number, buyerAddress, buyer.totalTokens, buyer.bidWeiAmount);
    }

    // called after bids have been processed to end auction
    // must be called in order for an auction to be successful
    // checks to see that all auction conditions have been met
    // checks to see that the contract has enough tokens to sell
    // if all conditions are meet, ends auction successfully
    function completeSuccessfulAuction() strike_price_set not_in_emergency in_bid_processing_phase owner_only {
        require(totalTokensSold <= token.balanceOf(this));
        require(minTokensForSale <= totalTokensSold); // maxTokensForSale check done in processBid
        require(minWeiToRaise <= totalWeiRaised); // maxWeiToRaise check done in processBid

        auctionEndBlock = block.number;
        auctionSuccess = true;

        AuctionSuccessEvent(block.number, strikePriceInWei, totalTokensSold, totalWeiRaised);
    }

    // called by owner after auction is over
    // can only be successfully called once
    // - successful auction : WEI is transferred to weiWallet and remaining tokens are transferred to tokenWallet
    // - failed auction : value tranfer does not occur
    function ownerWithdraw()  auction_complete owner_only {
        require(ownerHasWithdrawn == false);
        ownerHasWithdrawn = true;
        if (auctionSuccess) {
            weiWallet.transfer(totalWeiRaised);
            require(token.transfer(tokenWallet, SafeMath.sub( token.balanceOf(this), totalTokensSold) ));
        }
    }

    // can only be successfully called by owner if the auction has not yet ended
    // causes auction to fail
    function cancelAuction() owner_only {
        require(block.number < auctionEndBlock);
        auctionEndBlock = 0;
    }

    // prevents some functions from successfully executing
    function emergencyToggle() owner_only {
        emergencyFlag = !emergencyFlag;
    }
}
