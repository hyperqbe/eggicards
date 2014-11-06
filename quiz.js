function Card(elem, isFrontSelected) {
  this.hits = 0;
  this.misses = 0;
  this.hitStreak = 0;
  this.lastShownTime = -1;
  if (isFrontSelected) {
    this.question = elem.front[0];
    this.answer = elem.back[0];
    this.acceptableAnswers = elem.back;
  } else {
    this.question = elem.back[0];
    this.answer = elem.front[0];
    this.acceptableAnswers = elem.front;
  }
  // YAML treats strings that parse as numbers as numerical.  We want to
  // compare strings, so we convert all answers to strings.
  this.answer = String(this.answer);
  for (var i = 0; i < this.acceptableAnswers.length; i++) {
    this.acceptableAnswers[i] = String(this.acceptableAnswers[i])
  }
}

Card.prototype.guess = function(response) {
  var success = false;
  for (var i = 0; i < this.acceptableAnswers.length; i++) {
    if (response === this.acceptableAnswers[i]) {
      success = true;
      break;
    }
  }
  if (success) {
    this.hits++;
    this.hitStreak++;
  } else {
    this.misses++;
    this.hitStreak = 0;
  }
  return success;
};

var CardState = {
  NOW: 'NOW',
  WHENEVER: 'WHENEVER',
  DONE: 'DONE',
  NOT_NOW: 'NOT_NOW',
};

function GameSession(decks) {
  this.cardIndex = -1;
  this.currentCard = null;
  this.cardsShown = 0;
  this.cards = [];
  this.decks = {}
  this.deckNames = []
  for (var i = 0; i < decks.length; i++) {
    var deck = decks[i];
    var name = deck.name;
    var cards = deck.cards;
    this.decks[name] = cards;
    this.deckNames.push(name);
  }
  this.timer = null;
}

GameSession.prototype.classifyCard = function (card) {
  if (card.misses === 0 || card.hitStreak >= 6) {
    if (this.cardsShown < card.lastShownTime + 3) return CardState.NOT_NOW;
    if (card.hitStreak >= 3) return CardState.DONE;
    else return CardState.WHENEVER;
  }
  
  if (card.hitStreak >= 3) {
    if (this.cardsShown < card.lastShownTime + 3) return CardState.NOT_NOW;
    return CardState.WHENEVER;
  }
  
  var waitPeriod = 1 << (card.hitStreak + 1)
  var readyTime = card.lastShownTime + waitPeriod;

  if (this.cardsShown < readyTime) return CardState.NOT_NOW;
  return CardState.NOW;
}

GameSession.prototype.pickNextCard = function() {
  var cardsByState = {}
  var statesInOrder = [
      CardState.NOW, CardState.WHENEVER, CardState.DONE, CardState.NOT_NOW]
  for (var i = 0; i < statesInOrder.length; i++) {
    cardsByState[statesInOrder[i]] = [];
  }
  
  var allDone = true;
  for (var i = 0; i < this.cards.length; i++) {
    var card = this.cards[i];
    var state = this.classifyCard(card);

    if (state != CardState.DONE) allDone = false;

    cardsByState[state].push(card);
  }
  if (allDone) { alert('###you win!'); return null; }
  for (var i = 0; i < statesInOrder.length; i++) {
    var cards = cardsByState[statesInOrder[i]];
    if (cards.length > 0)
      return cards[Math.floor(Math.random() * cards.length)];
  }
}

GameSession.prototype.showCard = function (card) {
  this.cardsShown++;
  this.currentCard = this.pickNextCard()
  this.currentCard.lastShownTime = this.cardsShown
  this.userInterface.showQuestion(this.currentCard);
  this.timer = null;
}

GameSession.prototype.guess = function (value) {
  var success = this.currentCard.guess(value);
  this.userInterface.showAnswer(this.currentCard, success);
  var gameSession = this;
  this.timer = window.setTimeout(
      function () {
        gameSession.showCard(gameSession.pickNextCard());
      }, 3000);
}

GameSession.prototype.processInput = function (value) {
  if (this.timer) {
    window.clearTimeout(this.timer)
    this.showCard(this.pickNextCard());
    return;
  }
  if (value !== '') {
    this.guess(value);
  }
}

GameSession.prototype.begin = function() {
  this.userInterface = new UserInterface(this)
  this.userInterface.setOptions(this.deckNames)
  this.processDeckChange();
}

GameSession.prototype.processDeckChange = function() {
  var deck = this.decks[this.userInterface.currentOption()];
  this.cards = [];
  for (var i = 0; i < deck.length; i++) {
    this.cards[i] = new Card(deck[i], this.userInterface.isFrontSelected());
  }

  this.showCard(this.pickNextCard());
}

var Colors = {
  WRONG_ANSWER: '#ff0000',
  RIGHT_ANSWER: '#00ff00',

  REDDEST_TINT: '#ffcccc',
  REDDER_TINT: '#ffdddd',
  RED_TINT: '#ffeeee',
  NEUTRAL: '#ffffff',
  GREEN_TINT: '#eeffee',
  GREENER_TINT: '#ddffdd',
  GREENEST_TINT: '#ccffcc',
}

function UserInterface(gameSession) {
  this.questionElem = document.getElementById('question')
  this.formElem = document.getElementById('responseform')
  this.answerElem = document.getElementById('answer')
  this.cardElem = document.getElementById('card')
  this.selectElem = document.getElementById('deckselect')
  this.responseElem = document.getElementById('response');
  this.radioFrontElem = document.getElementById('radiofront');
  this.radioBackElem = document.getElementById('radioback');

  this.setGameSession(gameSession);
}

UserInterface.prototype.setGameSession = function(gameSession) {
  this.gameSession = gameSession;
  var responseElem = this.responseElem;
  var gameSession = this.gameSession;
  this.formElem.onsubmit = function() {
    var value = responseElem.value.replace(/^\s+|\s+$/g, '');
    gameSession.processInput(value);
    responseElem.value = '';
    return false;
  }
  this.selectElem.onchange = function() {
    gameSession.processDeckChange();
  }
  this.radioFrontElem.onchange = function() {
    gameSession.processDeckChange();
  }
  this.radioBackElem.onchange = function() {
    gameSession.processDeckChange();
  }
}

UserInterface.cardColor = function(card) {
  var colors = [
    Colors.REDDEST_TINT,
    Colors.REDDER_TINT,
    Colors.RED_TINT,
    Colors.NEUTRAL,
    Colors.GREEN_TINT,
    Colors.GREENER_TINT,
    Colors.GREENEST_TINT,
  ];
  var colorIndex = 3; 
  if (card.misses > 0) colorIndex = 0;

  colorIndex += card.hitStreak;
  if (colorIndex >= colors.length) colorIndex = colors.length - 1;

  return colors[colorIndex];
}

UserInterface.prototype.showQuestion = function(card) {
  this.questionElem.innerHTML = card.question;
  this.answerElem.innerHTML = '';
  this.cardElem.style.backgroundColor = UserInterface.cardColor(card);
}

UserInterface.prototype.showAnswer = function(card, success) {
  this.questionElem.innerHTML = card.question;
  this.answerElem.innerHTML = card.answer;
  this.cardElem.style.backgroundColor =
      success ? Colors.RIGHT_ANSWER : Colors.WRONG_ANSWER;
}

UserInterface.prototype.currentOption = function() {
  var optionElem = this.selectElem.childNodes[this.selectElem.selectedIndex];
  return optionElem.text;
}

UserInterface.prototype.isFrontSelected = function() {
  return this.radioFrontElem.checked;
}

UserInterface.prototype.setOptions = function(options) {
  while (this.selectElem.firstChild) {
    this.selectElem.removeChild(this.selectElem.firstChild)
  }

  for (var i = 0; i < options.length; i++) {
    var optionElem = document.createElement("option")
    optionElem.text = options[i];
    this.selectElem.add(optionElem);
  }
}

var gameSession = new GameSession(YAML.load('decks.yaml'))
window.onload = function() { gameSession.begin() };
