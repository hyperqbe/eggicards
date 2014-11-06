dict = [
  ['hello', 'goodbye'],
  ['abc', '123'],
  ['ham', 'cheese'],
]
dictionaries = [
  ['Chapter 1', [
    [['hello',], ['goodbye',]],
    [['abc',], ['123',]],
    [['ham',], ['cheese',]],
  ]],
  ['Chapter 2', [
    [['hi', ['hello',]],     ['salaam', ['salam']]],
    [['to work', ['work',]], ['kaar kardan',]],
    [['to eat', ['eat',]],   ['khordan',]],
  ]],
]

yamldicts = YAML.load('decks.yaml')
