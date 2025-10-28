Table "User" {
  "balance" int [check: `balance > 0`]
  "name" TEXT [check: `LEN(name) > 0`]
  "email" TEXT

  Checks {
    `balance < 10000000` [name: 'User.not_too_much_money']
    `LEN(name) < 256` [name: 'name_not_too_long']
    `REGEXP_LIKE(email, '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')`
  }
}

Table "User2" {
  "balance" int

  Checks {
    `balance < 10000000` [name: 'User2.not_too_much_money']
  }
}

Table "User3" {
  "balance" int [check: `balance > 0`, check: `balance < 10000000`]
}
