pragma solidity ^0.4.11;

import {SafeMath} from './SafeMath.sol';
import {HumanStandardToken} from './HumanStandardToken.sol';
import {IERC20Token} from './IERC20Token.sol';
/*
    Two phase auction:
    1. deposit phase (begins when start function is properly called, ends when process bid phase begins)
    2. process bid phase (ends when auction ends)
    
    Auction states a minimum/maximum amount of WEI to raise and a minimum/maximum number of tokens to sell. Both conditions are set at deployment and need to be met for a successful auction. In the case of an unsuccessful auction, buyers withdraw their entire deposit and no tokens are given.

    The trade-off between flexibility and attack surface area results in an increased number of parameters to set at contract deployment. Once the auction starts, the goal is to minimize adversarial damage.
*/

contract Auction {
    using SafeMath for uint256;
    /******************************************************
    EVENTS
    ******************************************************/
    event DepositEvent(address indexed buyer, uint weiDeposited);
    event SetStrikePriceEvent(uint strikePrice);
    event ProcessBidEvent(address indexed buyer, uint numTokensPurchased, uint totalCostInWei); 
    event AuctionSuccessEvent(uint blockNumber, uint strikePrice, uint totalTokensSold, uint totalWeiRaised);
    event WithdrawEvent(address indexed buyer, uint tokensReceived, uint unspentDeposit);

    /******************************************************
    VARIABLES SET AT CONTRACT DEPLOYMENT
    ******************************************************/
    // ADDRESSES DEFINED AT DEPLOYMENT
    IERC20Token token;
    address public owner;
    address public weiWallet; 
    address public tokenWallet;
    
    // USE BLOCK NUMBER TO TRANSITION TO OTHER PHASES
    uint public processingPhaseStartBlock; // Block number at which processing phase begins
    uint public auctionEndBlock; // Block number at which auction ends
    
    // GLOBAL AUCTION CONTSTRAINTS
    uint public minWeiToRaise; // minimum number of WEI to raise 
    uint public maxWeiToRaise; // maximum number of WEI to raise
    uint public minTokensForSale; // minimum number of tokens for sale
    uint public maxTokensForSale; // minimum number of tokens for sale
    uint public maxTokenBonusPercentage; // maximum percentage allowed for token bonus percentage
    
    // DEPOSIT CONSTRAINT
    uint public minDepositInWei;

    /******************************************************
    VARIABLES SET SOMETIME AFTER AUCTION DEPLOYMENT
    ******************************************************/
    uint public strikePrice; // strike price
    bool public emergencyFlag = false; // if true, prevents certain methods from executing
    
    /******************************************************
    INTERNAL ACCOUNTING PARAMETERS
    ******************************************************/
    uint initialTokenBalance; // token balance set when contract is deployed
    struct Buyer {
        uint depositInWei;
        uint bidWeiAmount;
        uint totalTokens;
        bool hasWithdrawn;
    }
    mapping(address => Buyer) public allBuyers;// mapping of addresses to Buyer struct
    uint public totalTokensSold; // running total of tokens from processed bids
    uint public totalWeiRaised; // running total of WEI raised from processed bids
    bool public auctionSuccess; // did auction end fulfilling all constraints 
    bool public ownerHasWithdrawn; // bool to check if owner has withdrawn after auction has ended
    
    /******************************************************
    MODIFIERS
    ******************************************************/
    modifier in_deposit_phase {
        require(block.number < processingPhaseStartBlock);
        _;
    }

    modifier in_bid_processing_phase {
        require(block.number >= processingPhaseStartBlock);
        require(block.number < auctionEndBlock);
        _;
    }

    modifier auction_complete { 
        require(block.number >= auctionEndBlock);
        _;
    }

    modifier strike_price_set {
        require(strikePrice > 0);
        _;
    }

    modifier owner_only {
        require(msg.sender == owner);
        _;
    }

    modifier not_in_emergency {
        require(emergencyFlag == false);
        _;
    }
    
    /******************************************************
    @dev Auction(): constructor for Auction contact
    The constructor defines :
    * token address of token to sell

    * wallets :
        _weiWallet : wallet address to transfer WEI only if auction is successful
        _tokenWallet : wallet address to transfer tokens after auction ends
        
    * deposits :
        _minDepositInWei : minimum deposit accepted in WEI

    * auction constraints :
        a successful auction will raise at least the minimum and at most the maximum number of WEI 
        _minWeiToRaise : minimum WEI to raise for a successful auction
        _maxWeiToRaise : maximum WEI to raise for a successful auction

        a successful auction will sell at least the minimum and at most the maximum number of tokens
        _minTokensForSale : minimum tokens to sell for a successful auction
        _maxTokensForSale : maximum tokens to sell for a successful auction
    
    * token bonus precentage ceiling :
        _maxTokenBonusPercentage : maximum percentage bonus that can be applied when processing bids

    * phase windows :
        depositWindowInBlocks : the number of blocks that the deposit phase will last
        processingWindowInBlocks : the number of blocks that the processing phase will last 
    ******************************************************/
    function Auction(IERC20Token _token, address _weiWallet, address _tokenWallet, uint _minDepositInWei, uint _minWeiToRaise, uint _maxWeiToRaise, uint _minTokensForSale, uint _maxTokensForSale, uint _maxTokenBonusPercentage) {        
        minWeiToRaise = _minWeiToRaise;
        maxWeiToRaise = _maxWeiToRaise;
        minTokensForSale = _minTokensForSale;
        maxTokensForSale = _maxTokensForSale;
        maxTokenBonusPercentage = _maxTokenBonusPercentage;
        minDepositInWei = _minDepositInWei;

        token = _token;
        owner = msg.sender;
        weiWallet = _weiWallet;
        tokenWallet = _tokenWallet;
    }

    // ASSUMPTION : token transfer happens after contract deployment but before start
    // ensure that configuration parameters are within logical limits
    // can only be called once
    // starts the deposit phase at current block number
    function start(uint depositWindowInBlocks, uint processingWindowInBlocks) owner_only {
        require(processingPhaseStartBlock == 0);
        require(auctionEndBlock == 0);

        require(minWeiToRaise > 0);
        require(minWeiToRaise < maxWeiToRaise);
        require(minTokensForSale > 0);
        require(minTokensForSale < maxTokensForSale);
        require(token.balanceOf(this) > maxTokensForSale);

        processingPhaseStartBlock = block.number + depositWindowInBlocks;
        auctionEndBlock = processingPhaseStartBlock + processingWindowInBlocks;
    }

    /******************************************************
    BUYER FUNCTIONS
    ******************************************************/
    // fallback function reverts
    function() {
        revert();
    }

    // buyers can deposit only in the deposit phase
    // buyers can deposit as many times as they want to during the deposit phase
    function depositInWEI() not_in_emergency in_deposit_phase payable {
        require(msg.value >= minDepositInWei); // make sure that the buyer deposits minimum
        Buyer storage buyer = allBuyers[msg.sender];
		buyer.depositInWei += msg.value;
        DepositEvent(msg.sender, msg.value);
    }

    // buyers can succefully withdraw at most once after the auction is over
    // if the auction is over and all the constraints have been met, the auction is successful
    // if the auction is over and constraints have NOT been met, the auction is cancelled
    // upon successful auction :
    // - buyers can withdraw tokens and remaining deposit if their bid was successfully processed
    // - buyers can only withdraw their entire deposit if their bid was not processed
    // upon cancelled auction :
    // - buyers can only withdraw their entire deposit
    function withdraw() auction_complete {
        Buyer storage buyer = allBuyers[msg.sender];
        require(buyer.hasWithdrawn == false);
        buyer.hasWithdrawn = true;

        require(buyer.depositInWei >= minDepositInWei); // check to see if buyer meets minimum required desposit 
        if (auctionSuccess) {
            require(token.transfer(msg.sender, buyer.totalTokens)); // TODO : IMPORTANT!!!! make transfer tests fail
            msg.sender.transfer(SafeMath.sub(buyer.depositInWei, buyer.bidWeiAmount)); // TODO : IMPORTANT!!!! make transfer tests fail
        } else {
            msg.sender.transfer(buyer.depositInWei); // TODO : IMPORTANT!!!! make transfer tests fail
        }
        WithdrawEvent(msg.sender, buyer.totalTokens, SafeMath.sub(buyer.depositInWei, buyer.bidWeiAmount));
    }

    /******************************************************
    OWNER ONLY FUNCTIONS
    ******************************************************/
    // NOTE : a strike price must be set during the bid processing phase or the auction will be cancelled
    // make sure the strike price is greater than zero
    // the strike price can only be set once
    function setStrikPrice(uint _strikePrice) not_in_emergency in_bid_processing_phase owner_only {
        require(strikePrice == 0); // ensures that the strikePrice can only be successfully set once
        require(_strikePrice > 0);
        strikePrice = _strikePrice;
        SetStrikePriceEvent(strikePrice);
    }

    // the bid processing phase begins as soon as the deposit phase ends
    // ASSUMPTION, off-chain bidding :
    // - signed off-chain bids are submitted during the deposit phase
    // - a bid states a max token price in WEI and a total bid amount in WEI
    // a strike price must be set before any bids can be processed
    // a bid in WEI must be greater than zero
    // a bidder can only have at most one successful processed bid
    // after a strike price is set, selected bids are processed
    // signature verification validates a bid
    // a bid may include a token bonus which must not be a negative number and less than the max token bonus
    // after a bid is successfully processed, the total WEI to collect and total tokens to sell are updated 
    // failure to meet constraints during the bid processing phase will result in a cancelled auction
    function processBid(uint tokenBidPriceInWei, uint bidWeiAmount, uint tokenBonusPercentage, uint8 v, bytes32 r, bytes32 s) not_in_emergency in_bid_processing_phase strike_price_set owner_only { 
        require(bidWeiAmount > 0);
        require(tokenBidPriceInWei >= strikePrice);
        require(tokenBonusPercentage >= 0);
        require(tokenBonusPercentage <= maxTokenBonusPercentage);

        var bidHash = sha256(address(this), tokenBidPriceInWei, bidWeiAmount); // REVIEW
        var buyerAddress = ecrecover(bidHash, v, r, s); // REVIEW
        
        Buyer storage buyer = allBuyers[buyerAddress];
        require(bidWeiAmount <= buyer.depositInWei);
        require(buyer.bidWeiAmount == 0); 
        
        uint numTokensPurchased = SafeMath.div(bidWeiAmount, strikePrice);
        uint numBonusTokens = SafeMath.div( SafeMath.mul(tokenBonusPercentage, numTokensPurchased), 100 );
        buyer.totalTokens = SafeMath.add(numBonusTokens, numTokensPurchased);
        buyer.bidWeiAmount = bidWeiAmount;

        totalTokensSold += buyer.totalTokens;
        totalWeiRaised += buyer.bidWeiAmount;
        ProcessBidEvent(buyerAddress, buyer.totalTokens, buyer.bidWeiAmount);
    }

    // can only be successfully called once
    // called after bids have been successfully processed
    // checks to see if all auction constraints have been met
    // checks that the contract has enough tokens to sell
    // if all constraints are meet, end auction successfully
    function completeSuccessfulAuction() not_in_emergency strike_price_set in_bid_processing_phase owner_only {
        require(totalTokensSold <= token.balanceOf(this));
        require(totalTokensSold >= minTokensForSale);
        require(totalTokensSold <= maxTokensForSale);
        require(totalWeiRaised >= minWeiToRaise);
        require(totalWeiRaised <= maxWeiToRaise);

        auctionEndBlock = block.number;
        auctionSuccess = true; // IMPORTANT : make sure that this line comes after ALL require statements
        AuctionSuccessEvent(block.number, strikePrice, totalTokensSold, totalWeiRaised);
    }

    // can only be successfully called once
    // if the auction is over and all the constraints have been met, the auction is successful
    // if the auction is over and constraints have NOT been met, the auction is cancelled
    // upon successful auction :
    // - collected WEI is transferred to weiWallet and remaining tokens transferred to tokenWallet
    // upon cancelled auction :
    // - tokens are transferred to tokenWallet
    function ownerWithdraw()  auction_complete owner_only {
        require(ownerHasWithdrawn == false);
        require(totalTokensSold <= token.balanceOf(this));
        ownerHasWithdrawn = true;
        if (auctionSuccess) {
            weiWallet.transfer(totalWeiRaised); // TODO : IMPORTANT!!!! make transfer tests fail
            require(token.transfer(tokenWallet, SafeMath.sub( token.balanceOf(this), totalTokensSold) ));// TODO : IMPORTANT!!!! make transfer tests fail
        } else {
            require(token.transfer(tokenWallet, token.balanceOf(this))); // TODO : IMPORTANT!!!! make transfer tests fail
        }
    }

    // can only be called by owner if the auction has not yet ended
    // cancels auction 
    function cancelAuction() owner_only {
        require(block.number < auctionEndBlock);
        auctionEndBlock = block.number;
    }

    // prevents : deposits, bid processing, setting strike price and successfully completing auction
    function emergencyToggle() owner_only {
        emergencyFlag = !emergencyFlag;
    }
}