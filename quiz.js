function finglify(s) {
  mapping = {
    'q': 'gh',
    'x': 'kh',
    'A': 'aa',
    'E': 'eh',
  };
  s = s.replace(/([AEIOUaeiou])i([AEIOUaeiou])/, '$1y$2')
  var result = ''

  for (var i = 0; i < s.length; ++i) {
    if (s[i] in mapping) {
      result += mapping[s[i]];
    } else {
      result += s[i];
    }
  }
  return result;
}

function Card(elem, isFrontSelected) {
  this.hits = 0;
  this.misses = 0;
  this.hitStreak = 0;
  this.lastShownTime = -1;
  if (isFrontSelected) {
    this.question = elem.front[0];
    this.answer = elem.back[0];
    this.acceptableAnswers = elem.back;
    this.secondaryAnswer = '';
  } else {
    this.question = elem.back[0];
    this.answer = elem.front[0];
    this.acceptableAnswers = elem.front;
    var secondaryAnswer = '';
    for (var i = 1; i < this.acceptableAnswers.length; ++i) {
      if (i != 1) secondaryAnswer += ', ';
      secondaryAnswer += finglify(String(this.acceptableAnswers[i]));
    }
    this.secondaryAnswer = secondaryAnswer;
  }
  // YAML treats strings that parse as numbers as numerical.  We want to
  // compare strings, so we convert all answers to strings.
  this.answer = String(this.answer);
  this.secondaryAnswer = String(this.secondaryAnswer);
  for (var i = 0; i < this.acceptableAnswers.length; i++) {
    this.acceptableAnswers[i] = String(this.acceptableAnswers[i])
  }
}

Card.prototype.responseMatches = function(response, answer) {
  mapping = {
    'ch': ['ch'],
    'q': ['q', 'gh'],
    'x': ['x', 'kh'],
    'u': ['u', 'oo'],
    'i': ['i', 'y', 'ee'],
    'A': ['aa', 'a'],
    'E': ['eh', 'e'],
    "'": ["'", ''],
  };

  if (response === answer) return true;
  response = response.toLowerCase();
  if (response === answer) return true;

  var responseIndex = 0;
  var answerIndex = 0;
  while (answerIndex < answer.length && responseIndex < response.length) {
    var origAnswerIndex = answerIndex;
    
    var mappingFound = false;
    for (var answerChunk in mapping) {
      if (!mapping.hasOwnProperty(answerChunk)) continue;
      if (answer.substring(answerIndex, answerIndex + answerChunk.length)
          === answerChunk) {
        mappingFound = true;
        for (var i = 0; i < mapping[answerChunk].length; ++i) {
          responseChunk = mapping[answerChunk][i];
          if (response.substring(responseIndex,
                                 responseIndex + responseChunk.length)
              === responseChunk) {
            answerIndex += answerChunk.length;
            responseIndex += responseChunk.length;
            break;
          }
        }
        break;
      }
    }
    if (!mappingFound && answer[answerIndex] == response[responseIndex]) {
      answerIndex++;
      responseIndex++;
    }
    if (answerIndex == origAnswerIndex) break;
  }

  return responseIndex == response.length && answerIndex == answer.length
}

Card.prototype.guess = function(response) {
  var success = false;
  for (var i = 0; i < this.acceptableAnswers.length; i++) {
    if (this.responseMatches(response, this.acceptableAnswers[i])) {
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
  // Show the card as soon as possible.
  NOW: 'NOW',
  // Show the card whenever, but before filler cards.
  WHENEVER: 'WHENEVER',
  // Card never needs to be shown again, but may be used as filler.
  FILLER: 'FILLER',
  // Card should not be shown now because it was shown too recently.
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
  if (this.cardIsDone(card)) {
    if (this.cardsShown < card.lastShownTime + 3) return CardState.NOT_NOW;
    return CardState.FILLER;
  }

  // If we're not done and not in the memory training phase for this card...
  if (card.misses === 0 || card.hitStreak >= 3) {
    if (this.cardsShown < card.lastShownTime + 3) return CardState.NOT_NOW;
    else return CardState.WHENEVER;
  }
  
  var waitPeriod = 1 << (card.hitStreak + 1)
  var readyTime = card.lastShownTime + waitPeriod;

  if (this.cardsShown < readyTime) return CardState.NOT_NOW;
  return CardState.NOW;
}

GameSession.prototype.cardIsDone = function (card) {
  var progress = this.cardProgress(card);
  return progress[0] >= progress[1];
}

GameSession.prototype.cardProgress = function (card) {
  var threshold = (card.misses == 0) ? 3 : 6;
  var hits = card.hitStreak;
  if (hits > threshold) {
    hits = threshold;
  }
  return [hits, threshold];
}

GameSession.prototype.cardScore = function (card) {
  return [card.hits, card.hits + card.misses];
}

GameSession.prototype.pickNextCard = function() {
  var cardsByState = {}
  var statesInOrder = [
      CardState.NOW, CardState.WHENEVER, CardState.FILLER, CardState.NOT_NOW]
  for (var i = 0; i < statesInOrder.length; i++) {
    cardsByState[statesInOrder[i]] = [];
  }
  
  for (var i = 0; i < this.cards.length; i++) {
    var card = this.cards[i];
    var state = this.classifyCard(card);

    cardsByState[state].push(card);
  }

  for (var i = 0; i < statesInOrder.length; i++) {
    var cards = cardsByState[statesInOrder[i]];
    if (cards.length > 0)
      return cards[Math.floor(Math.random() * cards.length)];
  }
}

GameSession.prototype.showCard = function (card) {
  this.cardsShown++;
  this.currentCard = card;
  this.currentCard.lastShownTime = this.cardsShown
  this.userInterface.showQuestion(this.currentCard);
  this.timer = null;
}

GameSession.prototype.updateStats = function () {
  var totalScore = [0, 0];
  var totalProgress = [0, 0];
  for (var i = 0; i < this.cards.length; i++) {
    var card = this.cards[i];
    var progress = this.cardProgress(card);
    totalProgress[0] += progress[0];
    totalProgress[1] += progress[1];
    var score = this.cardScore(card);
    totalScore[0] += score[0];
    totalScore[1] += score[1];
  }
  this.userInterface.setProgress(totalProgress[0]/totalProgress[1])
  this.userInterface.setScore(totalScore[0]/totalScore[1])
}

GameSession.prototype.guess = function (value) {
  var success = this.currentCard.guess(value);
  this.userInterface.showAnswer(this.currentCard, success);
  this.updateStats();
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
  this.deckSelectFormElem = document.getElementById('deckselectform')
  this.answerElem = document.getElementById('answer')
  this.secondaryAnswerElem = document.getElementById('secondaryanswer')
  this.cardElem = document.getElementById('card')
  this.selectElem = document.getElementById('deckselect')
  this.responseElem = document.getElementById('response');
  this.radioFrontElem = document.getElementById('radiofront');
  this.radioBackElem = document.getElementById('radioback');
  this.progressElem = document.getElementById('progress');
  this.scoreElem = document.getElementById('score');

  this.setGameSession(gameSession);
}

UserInterface.prototype.setGameSession = function(gameSession) {
  this.gameSession = gameSession;
  var responseElem = this.responseElem;
  var gameSession = this.gameSession;
  this.formElem.onsubmit = function() {
    try {
      var value = responseElem.value.replace(/^\s+|\s+$/g, '');
      gameSession.processInput(value);
      responseElem.value = '';
    } catch (err) {
      window.alert(err);
    } finally {
      return false;
    }
  }

  this.deckSelectFormElem.onsubmit = function() {
    try {
      gameSession.processDeckChange();
    } finally {
      return false;
    }
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
  // We use &nbsp; to make sure that the answer element retains its height.
  this.answerElem.innerHTML = '&nbsp;';
  this.secondaryAnswerElem.innerHTML = '&nbsp;';
  this.cardElem.style.backgroundColor = UserInterface.cardColor(card);
}

UserInterface.prototype.showAnswer = function(card, success) {
  this.questionElem.innerHTML = card.question;
  this.answerElem.innerHTML = card.answer;
  this.secondaryAnswerElem.innerHTML = card.secondaryAnswer;
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

// progress is a float between 0.0 and 1.0
UserInterface.prototype.setProgress = function(progress) {
  if (!isFinite(progress)) {
    this.progressElem.innerHTML = '&mdash;'
    return
  }
  this.progressElem.innerHTML = (progress*100).toFixed(0).toString() + '%';
}

// score is a float between 0.0 and 1.0
UserInterface.prototype.setScore = function(score) {
  if (!isFinite(score)) {
    this.scoreElem.innerHTML = '&mdash;'
    return
  }
  this.scoreElem.innerHTML = (score*100).toFixed(0).toString() + '%';
}

var gameSession = new GameSession(YAML.load('decks.yaml'))
window.onload = function() { gameSession.begin() };
