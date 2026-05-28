// 汕头升级核心游戏逻辑（潮汕80分）

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

  // 克隆牌（用于比较）
  clone() {
    return new Card(this.suit, this.rank);
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
    this.phase = 'DEAL'; // DEAL, BID, DISCARD, PLAY, SCORE
    this.scores = [0, 0]; // 两队分数
    this.level = ['2', '2']; // 两队当前级别
    this.dealer = 0; // 庄家
    this.playedCards = []; // 已出牌记录（用于判断桌面K/A）
    this.roundCards = []; // 当前轮出牌
    this.firstSuit = null; // 本轮首家花色
    this.kittyRevealed = []; // 亮明的底牌K/A
    this.isKouDi = false; // 是否抠底
    this.kouDiMultiplier = 1; // 抠底倍数
    this.gameOver = false; // 游戏是否结束
  }

  // 创建牌组（2副牌108张）
  createDeck() {
    this.deck = [];
    const suits = ['spade', 'heart', 'club', 'diamond'];
    const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    
    for (let d = 0; d < 2; d++) {
      for (let suit of suits) {
        for (let rank of ranks) {
          this.deck.push(new Card(suit, rank));
        }
      }
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
    
    for (let i = 0; i < 25; i++) {
      for (let p = 0; p < 4; p++) {
        this.players[p].hand.push(this.deck.pop());
      }
    }
    
    this.kitty = this.deck.splice(0, 8);
    this.phase = 'BID';
    return this.players;
  }

  // 叫主（报主）
  bid(playerId, card) {
    if (this.phase !== 'BID') return false;
    
    const player = this.players[playerId];
    const hasCard = player.hand.some(c => c.suit === card.suit && c.rank === card.rank);
    
    if (!hasCard) return false;
    if (card.rank !== this.trumpRank) return false;
    
    this.trumpSuit = card.suit;
    this.dealer = playerId;
    
    player.hand = player.hand.concat(this.kitty);
    this.phase = 'DISCARD';
    return true;
  }

  // 翻底（无人报主时）
  revealKitty() {
    if (this.phase !== 'BID') return false;
    
    // 从底牌第一张开始翻，找到级牌
    for (let i = 0; i < this.kitty.length; i++) {
      const card = this.kitty[i];
      if (card.rank === this.trumpRank) {
        this.trumpSuit = card.suit;
        this.dealer = 0; // 默认庄家为0号玩家（或按规则重新确定）
        this.players[0].hand = this.players[0].hand.concat(this.kitty);
        this.phase = 'DISCARD';
        return { success: true, method: 'kitty_trump', card: card };
      }
    }
    
    // 底牌没有级牌，找最大牌（不计大小王）
    let maxCard = null;
    const rankOrder = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    
    for (let card of this.kitty) {
      if (card.suit === 'joker') continue;
      if (!maxCard || rankOrder.indexOf(card.rank) > rankOrder.indexOf(maxCard.rank)) {
        maxCard = card;
      }
    }
    
    if (maxCard) {
      this.trumpSuit = maxCard.suit;
      this.dealer = 0;
      this.players[0].hand = this.players[0].hand.concat(this.kitty);
      this.phase = 'DISCARD';
      return { success: true, method: 'kitty_max', card: maxCard };
    }
    
    return { success: false };
  }

  // 扣底
  discard(playerId, cards) {
    if (this.phase !== 'DISCARD') return false;
    if (playerId !== this.dealer) return false;
    if (cards.length !== 8) return false;
    
    const player = this.players[playerId];
    
    for (let card of cards) {
      const idx = player.hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
      if (idx === -1) return false;
      player.hand.splice(idx, 1);
    }
    
    this.kitty = cards;
    
    // 亮明副牌K/A
    this.kittyRevealed = [];
    for (let card of cards) {
      if (!this.isTrump(card) && (card.rank === 'K' || card.rank === 'A')) {
        this.kittyRevealed.push(card);
      }
    }
    
    this.phase = 'PLAY';
    this.currentPlayer = (this.dealer + 1) % 4;
    
    return true;
  }

  // 判断是否是主牌
  isTrump(card) {
    if (card.suit === 'joker') return true;
    if (card.rank === this.trumpRank) return true;
    if (this.trumpSuit && card.suit === this.trumpSuit) return true;
    return false;
  }

  // 获取牌的排序权重
  getCardSortWeight(card) {
    const rankOrder = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    const suitOrder = ['spade', 'heart', 'club', 'diamond'];
    
    if (card.rank === 'big') return 1000;
    if (card.rank === 'small') return 900;
    
    if (card.rank === this.trumpRank && card.suit === this.trumpSuit) return 800;
    if (card.rank === this.trumpRank) return 700 + suitOrder.indexOf(card.suit);
    
    if (this.trumpSuit && card.suit === this.trumpSuit) {
      return 600 + rankOrder.indexOf(card.rank);
    }
    
    if (!this.trumpSuit && card.rank === this.trumpRank) return 800;
    
    return suitOrder.indexOf(card.suit) * 20 + rankOrder.indexOf(card.rank);
  }

  // 排序手牌
  sortHand(hand) {
    return hand.sort((a, b) => this.getCardSortWeight(b) - this.getCardSortWeight(a));
  }

  // 比较两张牌大小
  compareCards(card1, card2) {
    const rankOrder = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    
    const isTrump1 = this.isTrump(card1);
    const isTrump2 = this.isTrump(card2);
    
    if (isTrump1 && !isTrump2) return 1;
    if (!isTrump1 && isTrump2) return -1;
    
    if (isTrump1 && isTrump2) {
      if (card1.rank === 'big') return 1;
      if (card2.rank === 'big') return -1;
      if (card1.rank === 'small') return 1;
      if (card2.rank === 'small') return -1;
      
      if (card1.rank === this.trumpRank && card1.suit === this.trumpSuit) return 1;
      if (card2.rank === this.trumpRank && card2.suit === this.trumpSuit) return -1;
      
      if (card1.rank === this.trumpRank && card2.rank === this.trumpRank) {
        const suitOrder = ['spade', 'heart', 'club', 'diamond'];
        return suitOrder.indexOf(card1.suit) - suitOrder.indexOf(card2.suit);
      }
      if (card1.rank === this.trumpRank) return 1;
      if (card2.rank === this.trumpRank) return -1;
      
      const idx1 = rankOrder.indexOf(card1.rank);
      const idx2 = rankOrder.indexOf(card2.rank);
      return idx1 - idx2;
    }
    
    if (card1.suit === card2.suit) {
      const idx1 = rankOrder.indexOf(card1.rank);
      const idx2 = rankOrder.indexOf(card2.rank);
      return idx1 - idx2;
    }
    
    return 0;
  }

  // 检查是否可以甩牌
  canShuai(playerId, suit) {
    const player = this.players[playerId];
    const suitCards = player.hand.filter(c => c.suit === suit && !this.isTrump(c));
    
    // 收集桌面上已出的K/A（含亮明的底牌K/A）
    const playedKA = { 'K': 0, 'A': 0 };
    
    for (let cards of this.playedCards) {
      for (let c of cards) {
        if (c.suit === suit && (c.rank === 'K' || c.rank === 'A')) {
          playedKA[c.rank]++;
        }
      }
    }
    
    for (let c of this.kittyRevealed) {
      if (c.suit === suit && (c.rank === 'K' || c.rank === 'A')) {
        playedKA[c.rank]++;
      }
    }
    
    // 级为K时只需两只A
    if (this.trumpRank === 'K') {
      const handA = suitCards.filter(c => c.rank === 'A').length;
      return handA + playedKA['A'] >= 2;
    }
    
    // 级为A时只需两只A
    if (this.trumpRank === 'A') {
      const handA = suitCards.filter(c => c.rank === 'A').length;
      return handA + playedKA['A'] >= 2;
    }
    
    // 普通级别：需要2K+2A
    const handK = suitCards.filter(c => c.rank === 'K').length;
    const handA = suitCards.filter(c => c.rank === 'A').length;
    
    return (handK + playedKA['K'] >= 2) && (handA + playedKA['A'] >= 2);
  }

  // 获取某花色可甩的牌
  getShuaiCards(playerId, suit) {
    if (!this.canShuai(playerId, suit)) return null;
    
    const player = this.players[playerId];
    return player.hand.filter(c => c.suit === suit && !this.isTrump(c));
  }

  // 判断牌型
  getCardType(cards) {
    if (cards.length === 1) return 'SINGLE';
    if (cards.length === 2) {
      if (cards[0].rank === cards[1].rank && cards[0].suit === cards[1].suit) {
        return 'PAIR';
      }
    }
    return 'MULTI';
  }

  // 检查跟牌规则
  checkFollowRule(playerId, cards) {
    if (this.roundCards.length === 0) return true; // 首家随便出
    
    const player = this.players[playerId];
    const firstSuit = this.firstSuit;
    
    // 检查是否有首家花色
    const hasFirstSuit = player.hand.some(c => 
      !this.isTrump(c) && c.suit === firstSuit
    );
    
    if (hasFirstSuit) {
      // 有首家花色必须跟
      for (let card of cards) {
        if (this.isTrump(card) || card.suit !== firstSuit) {
          return false; // 有首家花色却没跟
        }
      }
    }
    
    return true;
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
    
    // 检查跟牌规则
    if (!this.checkFollowRule(playerId, cards)) {
      return false;
    }
    
    // 移除手牌
    for (let card of cards) {
      const idx = player.hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
      player.hand.splice(idx, 1);
    }
    
    // 记录出牌
    this.roundCards.push({ playerId, cards });
    this.playedCards.push(cards);
    
    // 设置首家花色
    if (this.roundCards.length === 1) {
      this.firstSuit = cards[0].suit;
    }
    
    // 进入下一轮
    this.currentPlayer = (this.currentPlayer + 1) % 4;
    
    // 一轮结束
    if (this.roundCards.length === 4) {
      this.endRound();
    }
    
    return true;
  }

  // 结束一轮
  endRound() {
    // 判断赢家
    const winner = this.determineRoundWinner();
    const winnerTeam = winner % 2;
    
    // 计算本轮得分
    const roundScore = this.calculateRoundScore();
    this.scores[winnerTeam] += roundScore;
    
    // 检查是否是最后一轮（抠底）
    const totalCards = this.players.reduce((sum, p) => sum + p.hand.length, 0);
    if (totalCards === 0) {
      // 最后一轮
      if (winnerTeam !== this.dealer % 2) {
        // 抓分方赢，抠底
        this.isKouDi = true;
        const winningCards = this.roundCards.find(r => r.playerId === winner).cards;
        this.kouDiMultiplier = this.calculateKouDiMultiplier(winningCards);
        const kittyScore = this.calculateKittyScore();
        this.scores[winnerTeam] += kittyScore * this.kouDiMultiplier;
      }
      
      this.endGame();
    } else {
      // 下一轮由赢家先出
      this.currentPlayer = winner;
      this.roundCards = [];
      this.firstSuit = null;
    }
  }

  // 判断一轮赢家
  determineRoundWinner() {
    let winner = this.roundCards[0].playerId;
    let maxCards = this.roundCards[0].cards;
    
    for (let i = 1; i < this.roundCards.length; i++) {
      const { playerId, cards } = this.roundCards[i];
      
      // 比较最大牌
      const max1 = this.getMaxCard(maxCards);
      const max2 = this.getMaxCard(cards);
      
      if (this.compareCards(max2, max1) > 0) {
        winner = playerId;
        maxCards = cards;
      }
    }
    
    return winner;
  }

  // 获取一手牌中的最大牌
  getMaxCard(cards) {
    let max = cards[0];
    for (let i = 1; i < cards.length; i++) {
      if (this.compareCards(cards[i], max) > 0) {
        max = cards[i];
      }
    }
    return max;
  }

  // 计算一轮得分
  calculateRoundScore() {
    let score = 0;
    for (let { cards } of this.roundCards) {
      for (let card of cards) {
        if (card.rank === '5') score += 5;
        else if (card.rank === '10' || card.rank === 'K') score += 10;
      }
    }
    return score;
  }

  // 计算底牌得分
  calculateKittyScore() {
    let score = 0;
    for (let card of this.kitty) {
      if (card.rank === '5') score += 5;
      else if (card.rank === '10' || card.rank === 'K') score += 10;
    }
    return score;
  }

  // 计算抠底倍数
  calculateKouDiMultiplier(cards) {
    const cardType = this.getCardType(cards);
    
    if (cardType === 'SINGLE') return 2;
    if (cardType === 'PAIR') return 4;
    
    // 检查拖拉机（连对）
    if (this.isTractor(cards)) {
      const pairs = this.countPairs(cards);
      return Math.pow(2, pairs + 1); // 2对=8×, 3对=16×, etc
    }
    
    // 甩牌按最大牌型
    return 2;
  }

  // 检查是否是拖拉机（连对）
  isTractor(cards) {
    if (cards.length < 4 || cards.length % 2 !== 0) return false;
    
    const rankOrder = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    const suit = cards[0].suit;
    
    // 所有牌同花色且成对
    const pairs = {};
    for (let card of cards) {
      if (card.suit !== suit) return false;
      pairs[card.rank] = (pairs[card.rank] || 0) + 1;
    }
    
    const ranks = Object.keys(pairs).sort((a, b) => rankOrder.indexOf(a) - rankOrder.indexOf(b));
    
    // 检查是否连续
    for (let i = 0; i < ranks.length - 1; i++) {
      if (rankOrder.indexOf(ranks[i + 1]) - rankOrder.indexOf(ranks[i]) !== 1) {
        return false;
      }
    }
    
    // 每级都是2张
    for (let rank of ranks) {
      if (pairs[rank] !== 2) return false;
    }
    
    return true;
  }

  // 计算对子数
  countPairs(cards) {
    const counts = {};
    for (let card of cards) {
      counts[card.rank] = (counts[card.rank] || 0) + 1;
    }
    let pairs = 0;
    for (let rank in counts) {
      if (counts[rank] >= 2) pairs += Math.floor(counts[rank] / 2);
    }
    return pairs;
  }

  // 结束游戏，计算升级
  endGame() {
    this.phase = 'SCORE';
    
    const xianjiaTeam = (this.dealer + 1) % 2;
    const xianjiaScore = this.scores[xianjiaTeam];
    const zhuangjiaTeam = this.dealer % 2;
    
    let result = {
      xianjiaScore,
      zhuangjiaScore: this.scores[zhuangjiaTeam],
      isKouDi: this.isKouDi,
      kouDiMultiplier: this.kouDiMultiplier,
      upgradeLevels: 0,
      nextDealer: null,
      message: '',
      gameOver: false
    };
    
    const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    
    if (xianjiaScore >= 80) {
      // 抓分方上台
      result.upgradeLevels = 1;
      
      // 每多10分升一级
      const extra = Math.floor((xianjiaScore - 80) / 10);
      result.upgradeLevels += extra;
      
      // 满200分额外+1
      if (xianjiaScore >= 200) result.upgradeLevels += 1;
      
      // 抠底额外+1
      if (this.isKouDi) result.upgradeLevels += 1;
      
      const currentIdx = rankOrder.indexOf(this.level[xianjiaTeam]);
      const newIdx = Math.min(currentIdx + result.upgradeLevels, rankOrder.length - 1);
      this.level[xianjiaTeam] = rankOrder[newIdx];
      
      // 抓分方下家坐庄
      result.nextDealer = (this.dealer + 1) % 4;
      result.message = `抓分方得${xianjiaScore}分，升${result.upgradeLevels}级，打${rankOrder[newIdx]}`;
      
      // 检查是否过A
      if (this.level[xianjiaTeam] === 'A' && currentIdx < rankOrder.length - 1) {
        result.gameOver = true;
        result.message += '，恭喜过A获胜！';
      }
    } else {
      // 庄家胜
      const diff = 80 - xianjiaScore;
      
      if (xianjiaScore === 0) {
        result.upgradeLevels = 3;
      } else if (diff >= 25) {
        result.upgradeLevels = Math.floor(diff / 10);
      } else {
        result.upgradeLevels = 1;
      }
      
      const currentIdx = rankOrder.indexOf(this.level[zhuangjiaTeam]);
      const newIdx = Math.min(currentIdx + result.upgradeLevels, rankOrder.length - 1);
      this.level[zhuangjiaTeam] = rankOrder[newIdx];
      
      // 庄家对家接庄
      result.nextDealer = (this.dealer + 2) % 4;
      result.message = `庄家防守成功，抓分方仅得${xianjiaScore}分，庄家升${result.upgradeLevels}级，打${rankOrder[newIdx]}`;
      
      // 检查是否过A
      if (this.level[zhuangjiaTeam] === 'A' && currentIdx < rankOrder.length - 1) {
        result.gameOver = true;
        result.message += '，恭喜过A获胜！';
      }
    }
    
    this.gameOver = result.gameOver;
    return result;
  }

  // AI决策
  aiPlay(playerId) {
    const player = this.players[playerId];
    if (player.hand.length === 0) return null;
    
    player.hand.sort((a, b) => this.compareCards(a, b));
    return [player.hand[0]];
  }

  // 反主（炒地皮）
  fanzhu(playerId, cards) {
    if (this.phase !== 'BID' && this.phase !== 'DISCARD') return false;
    
    const player = this.players[playerId];
    
    if (cards.length !== 2) return false;
    
    const card1 = cards[0];
    const card2 = cards[1];
    
    if (card1.rank !== card2.rank || card1.suit !== card2.suit) return false;
    
    const isTrumpPair = card1.rank === this.trumpRank && card1.suit !== 'joker';
    const isJokerPair = card1.suit === 'joker' && card2.suit === 'joker';
    
    if (!isTrumpPair && !isJokerPair) return false;
    
    if (this.phase === 'DISCARD' && this.dealer !== playerId) {
      const oldDealer = this.players[this.dealer];
      oldDealer.hand = oldDealer.hand.concat(this.kitty);
    }
    
    if (isJokerPair) {
      this.trumpSuit = null;
    } else {
      this.trumpSuit = card1.suit;
    }
    
    this.dealer = playerId;
    
    const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const currentIdx = rankOrder.indexOf(this.trumpRank);
    if (currentIdx < rankOrder.length - 1) {
      this.trumpRank = rankOrder[currentIdx + 1];
    }
    
    player.hand = player.hand.concat(this.kitty);
    this.kitty = [];
    
    this.phase = 'DISCARD';
    return true;
  }

  // 开始新一局
  newRound() {
    if (this.gameOver) return false;
    
    // 重置状态
    this.kitty = [];
    this.trumpSuit = null;
    this.currentPlayer = 0;
    this.phase = 'DEAL';
    this.scores = [0, 0];
    this.playedCards = [];
    this.roundCards = [];
    this.firstSuit = null;
    this.kittyRevealed = [];
    this.isKouDi = false;
    this.kouDiMultiplier = 1;
    
    // 清空手牌
    for (let player of this.players) {
      player.hand = [];
    }
    
    return true;
  }
}

module.exports = {
  Game,
  Card
};
