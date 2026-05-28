// 潮汕升级核心游戏逻辑

class Card {
  constructor(suit, rank) {
    this.suit = suit; // 'spade', 'heart', 'club', 'diamond', 'joker'
    this.rank = rank; // 3-10, J, Q, K, A, 2, 'small', 'big'
  }

  toString() {
    const suitMap = { 'spade': '♠', 'heart': '♥', 'club': '♣', 'diamond': '♦', 'joker': '' };
    const rankMap = { 'small': '小王', 'big': '大王' };
    return suitMap[this.suit] + (rankMap[this.rank] || this.rank);
  }
}

class Game {
  constructor() {
    this.players = [
      { id: 0, name: '玩家', hand: [], team: 0, isAI: false },
      { id: 1, name: 'AI-1', hand: [], team: 1, isAI: true },
      { id: 2, name: '队友', hand: [], team: 0, isAI: true },
      { id: 3, name: 'AI-2', hand: [], team: 1, isAI: true }
    ];
    this.deck = [];
    this.kitty = []; // 底牌
    this.trumpSuit = null; // 主花色
    this.trumpRank = '2'; // 当前级牌
    this.currentPlayer = 0;
    this.phase = 'DEAL'; // DEAL, BID, PLAY, SCORE
    this.scores = [0, 0]; // 两队分数
    this.level = ['2', '2']; // 两队当前级别
    this.dealer = 0; // 庄家
  }

  // 创建牌组（2副牌）
  createDeck() {
    this.deck = [];
    const suits = ['spade', 'heart', 'club', 'diamond'];
    const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    
    // 2副牌
    for (let d = 0; d < 2; d++) {
      for (let suit of suits) {
        for (let rank of ranks) {
          this.deck.push(new Card(suit, rank));
        }
      }
      // 大小王
      this.deck.push(new Card('joker', 'small'));
      this.deck.push(new Card('joker', 'big'));
    }
    
    return this.shuffle();
  }

  // 洗牌
  shuffle() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    return this.deck;
  }

  // 发牌
  deal() {
    this.createDeck();
    
    // 每人25张
    for (let i = 0; i < 25; i++) {
      for (let p = 0; p < 4; p++) {
        this.players[p].hand.push(this.deck.pop());
      }
    }
    
    // 底牌8张
    this.kitty = this.deck.splice(0, 8);
    
    this.phase = 'BID';
    return this.players;
  }

  // 叫主
  bid(playerId, card) {
    if (this.phase !== 'BID') return false;
    
    // 检查玩家是否有这张牌
    const player = this.players[playerId];
    const hasCard = player.hand.some(c => c.suit === card.suit && c.rank === card.rank);
    
    if (!hasCard) return false;
    
    // 设置主牌
    this.trumpSuit = card.suit;
    this.dealer = playerId;
    
    // 庄家拿底牌
    player.hand = player.hand.concat(this.kitty);
    
    this.phase = 'DISCARD';
    return true;
  }

  // 扣底（庄家扣8张回去）
  discard(playerId, cards) {
    if (this.phase !== 'DISCARD') return false;
    if (playerId !== this.dealer) return false;
    if (cards.length !== 8) return false;
    
    const player = this.players[playerId];
    
    // 检查玩家有这些牌
    for (let card of cards) {
      const idx = player.hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
      if (idx === -1) return false;
      player.hand.splice(idx, 1);
    }
    
    this.kitty = cards;
    this.phase = 'PLAY';
    this.currentPlayer = (this.dealer + 1) % 4; // 庄家下家先出
    
    return true;
  }

  // 判断是否是主牌
  isTrump(card) {
    if (card.suit === 'joker') return true;
    if (card.rank === this.trumpRank) return true;
    if (card.suit === this.trumpSuit) return true;
    return false;
  }

  // 比较两张牌大小（假设同花色或都是主牌）
  compareCards(card1, card2) {
    const rankOrder = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    
    // 大小王最大
    if (card1.rank === 'big') return 1;
    if (card2.rank === 'big') return -1;
    if (card1.rank === 'small') return 1;
    if (card2.rank === 'small') return -1;
    
    // 级牌
    if (card1.rank === this.trumpRank && card1.suit === this.trumpSuit) return 1;
    if (card2.rank === this.trumpRank && card2.suit === this.trumpSuit) return -1;
    
    // 主花色
    if (card1.suit === this.trumpSuit && card2.suit !== this.trumpSuit) return 1;
    if (card2.suit === this.trumpSuit && card1.suit !== this.trumpSuit) return -1;
    
    // 比较点数
    const idx1 = rankOrder.indexOf(card1.rank);
    const idx2 = rankOrder.indexOf(card2.rank);
    return idx1 - idx2;
  }

  // 判断牌型
  getCardType(cards) {
    if (cards.length === 1) return 'SINGLE';
    if (cards.length === 2) {
      if (cards[0].rank === cards[1].rank && cards[0].suit === cards[1].suit) {
        return 'PAIR';
      }
    }
    if (cards.length === 4) {
      // AAKK甩牌
      const ranks = cards.map(c => c.rank).sort();
      if (ranks[0] === 'A' && ranks[1] === 'A' && ranks[2] === 'K' && ranks[3] === 'K') {
        return 'SHUAI';
      }
    }
    return 'INVALID';
  }

  // 出牌
  playCards(playerId, cards) {
    if (this.phase !== 'PLAY') return false;
    if (playerId !== this.currentPlayer) return false;
    
    const player = this.players[playerId];
    
    // 检查玩家有这些牌
    for (let card of cards) {
      const idx = player.hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
      if (idx === -1) return false;
    }
    
    // 检查牌型
    const cardType = this.getCardType(cards);
    if (cardType === 'INVALID') return false;
    
    // TODO: 检查跟牌规则
    
    // 移除手牌
    for (let card of cards) {
      const idx = player.hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
      player.hand.splice(idx, 1);
    }
    
    // 进入下一轮
    this.currentPlayer = (this.currentPlayer + 1) % 4;
    
    return true;
  }

  // AI决策
  aiPlay(playerId) {
    const player = this.players[playerId];
    if (player.hand.length === 0) return null;
    
    // 简单AI：出最小的单张
    player.hand.sort((a, b) => this.compareCards(a, b));
    return [player.hand[0]];
  }

  // 反主（炒地皮）
  fanzhu(playerId, cards) {
    if (this.phase !== 'BID' && this.phase !== 'DISCARD') return false;
    
    const player = this.players[playerId];
    
    // 检查是否是一对级牌或一对王
    if (cards.length !== 2) return false;
    
    const card1 = cards[0];
    const card2 = cards[1];
    
    // 必须是对子
    if (card1.rank !== card2.rank) return false;
    
    // 检查是否是级牌对子或王对子
    const isTrumpPair = card1.rank === this.trumpRank && card1.suit === card2.suit;
    const isJokerPair = card1.suit === 'joker' && card2.suit === 'joker';
    
    if (!isTrumpPair && !isJokerPair) return false;
    
    // 改变主牌
    if (isJokerPair) {
      this.trumpSuit = null; // 无主
    } else {
      this.trumpSuit = card1.suit;
    }
    
    // 改变庄家
    this.dealer = playerId;
    
    // 升级（反一次升一级）
    const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const currentIdx = rankOrder.indexOf(this.trumpRank);
    if (currentIdx < rankOrder.length - 1) {
      this.trumpRank = rankOrder[currentIdx + 1];
    }
    
    // 如果已经扣底，需要重新扣
    if (this.phase === 'DISCARD') {
      // 把底牌还给原庄家
      const oldDealer = this.players[this.dealer];
      oldDealer.hand = oldDealer.hand.concat(this.kitty);
      this.kitty = [];
    }
    
    // 新庄家拿底牌
    player.hand = player.hand.concat(this.kitty);
    this.kitty = [];
    
    this.phase = 'DISCARD';
    return true;
  }

  // 检查是否是甩牌（AAKK）
  isShuai(cards) {
    if (cards.length !== 4) return false;
    const ranks = cards.map(c => c.rank).sort();
    return ranks[0] === 'A' && ranks[1] === 'A' && ranks[2] === 'K' && ranks[3] === 'K';
  }

  // 检查甩牌是否被压（有人有更大的A或K）
  checkShuaiBeaten(cards, otherHands) {
    if (!this.isShuai(cards)) return false;
    
    // 检查其他玩家是否有主牌A或更大的牌
    for (let hand of otherHands) {
      for (let card of hand) {
        if (this.isTrump(card) && this.compareCards(card, cards[0]) > 0) {
          return true; // 有人能压
        }
      }
    }
    return false;
  }

  // 计算一轮得分
  calculateRoundScore(playedCards) {
    let score = 0;
    for (let cards of playedCards) {
      for (let card of cards) {
        if (card.rank === '5') score += 5;
        else if (card.rank === '10' || card.rank === 'K') score += 10;
      }
    }
    return score;
  }

  // 判断赢家
  determineWinner(playedCards, firstSuit) {
    let winner = 0;
    let maxCard = playedCards[0][0];
    
    for (let i = 1; i < playedCards.length; i++) {
      const card = playedCards[i][0];
      // 如果是主牌且当前最大不是主牌，或者都是主牌但更大
      if (this.isTrump(card) && !this.isTrump(maxCard)) {
        maxCard = card;
        winner = i;
      } else if (this.isTrump(card) === this.isTrump(maxCard)) {
        if (this.compareCards(card, maxCard) > 0) {
          maxCard = card;
          winner = i;
        }
      }
    }
    
    return winner;
  }

  // 升级规则
  checkUpgrade(xianjiaScore) {
    const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const currentIdx = rankOrder.indexOf(this.trumpRank);
    
    if (xianjiaScore < 80) {
      // 庄家升级
      if (xianjiaScore < 40) {
        // 升2级
        const newIdx = Math.min(currentIdx + 2, rankOrder.length - 1);
        this.level[this.dealer % 2] = rankOrder[newIdx];
        return `庄家升2级，打${rankOrder[newIdx]}`;
      } else if (xianjiaScore === 0) {
        // 升3级
        const newIdx = Math.min(currentIdx + 3, rankOrder.length - 1);
        this.level[this.dealer % 2] = rankOrder[newIdx];
        return `庄家升3级，打${rankOrder[newIdx]}`;
      } else {
        // 升1级
        const newIdx = Math.min(currentIdx + 1, rankOrder.length - 1);
        this.level[this.dealer % 2] = rankOrder[newIdx];
        return `庄家升1级，打${rankOrder[newIdx]}`;
      }
    } else {
      // 闲家上台
      if (xianjiaScore >= 140) {
        // 闲家升2级
        const newIdx = Math.min(currentIdx + 2, rankOrder.length - 1);
        this.level[(this.dealer + 1) % 2] = rankOrder[newIdx];
        this.dealer = (this.dealer + 1) % 4;
        return `闲家升2级，打${rankOrder[newIdx]}`;
      } else if (xianjiaScore >= 100) {
        // 闲家升1级
        const newIdx = Math.min(currentIdx + 1, rankOrder.length - 1);
        this.level[(this.dealer + 1) % 2] = rankOrder[newIdx];
        this.dealer = (this.dealer + 1) % 4;
        return `闲家升1级，打${rankOrder[newIdx]}`;
      } else {
        // 平过，换庄不升级
        this.dealer = (this.dealer + 1) % 4;
        return '平过，换庄';
      }
    }
  }
}

module.exports = {
  Game,
  Card
};