const util = require('util');
var express = require('express');
var fs = require('fs');
var app = express();
var server = require('http').createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
var crypto = require('crypto');
var ent = require('ent');
const mysql = require('mysql');
var session = require('express-session');
const { log } = require('console');

const sessionMiddleware = session({
    secret: "secret",
    resave: true,
    saveUninitialized: true,
    cookie: {}
});

app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

app.use(express.static(__dirname + '/public'));


const database = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'harrypotter'
});

database.connect(function (error) {
    if (error) {
        throw error;
    }

    console.info("MySQL: connection succeeded.");
});

const mysqlQuery = util.promisify(database.query).bind(database);
 
app.get('/', function(req, res) {
    if(req.session.userId) {
        fs.readFile('./html/home.html', 'utf-8', function(error, content) {
            res.writeHead(200, {"Content-Type": "text/html"});
            res.end(content);
        });
    } else {
        fs.readFile('./html/login.html', 'utf-8', function(error, content) {
            res.writeHead(200,  {"Content-Type": "text/html"});
            res.end(content);
        });
    }
}) 
// route pour aller sur l'acceuil ou le login
 
.get('/login', function(req, res) {
  fs.readFile('./html/login.html', 'utf-8', function(error, content) {
    res.writeHead(200, {"Content-Type": "text/html"});
    res.end(content);
  });
})
 
.get('/subscribe', function(req, res) {
  fs.readFile('./html/subscribe.html', 'utf-8', function(error, content) {
    res.writeHead(200, {"Content-Type": "text/html"});
    res.end(content);
  });
})

.get('/card', function(req, res) {
    fs.readFile('./html/card.html', 'utf-8', function(error, content) {
      res.writeHead(200, {"Content-Type": "text/html"});
      res.end(content);
    });
})

.get('/booster', function(req, res) {
    fs.readFile('./html/booster.html', 'utf-8', function(error, content) {
      res.writeHead(200, {"Content-Type": "text/html"});
      res.end(content);
    });
})

.get('/collection', function(req, res) {
    fs.readFile('./html/collection.html', 'utf-8', function(error, content) {
      res.writeHead(200, {"Content-Type": "text/html"});
      res.end(content);
    });
})

.get('/user-collection', function(req, res) {
    if(req.session.userId)
    {
        let outCards = [];

        mysqlQuery(`SELECT * FROM collection WHERE user_id = ${req.session.userId} ORDER BY favorite DESC`).then((userCards) => {
            fetch('https://hp-api.lainocs.fr/characters').then((response) => {
                response.json().then((allCards) => {
                    userCards.forEach(function(userCard) {
                        allCards.forEach(function(allCard) {
                            if(userCard.card_id == allCard.id) {
                                allCard.favorite = userCard.favorite;
                                outCards.push(allCard);
                            }
                        });
                    });

                    res.writeHead(200, {"Content-Type": "application/json"});
                    res.end(JSON.stringify(outCards));
                });
            });
        });
    }
})

.get('/trade', function(req, res) {
    fs.readFile('./html/trade.html', 'utf-8', function(error, content) {
      res.writeHead(200, {"Content-Type": "text/html"});
      res.end(content);
    });
})


.get('/trade-card', function(req, res) {
    mysqlQuery(`SELECT * FROM users WHERE pseudo = '${req.query.recipient}' LIMIT 1`).then((data) => {
        if(data.length) {
            let date = (new Date()).toISOString().slice(0, 19).replace('T', ' ');
            mysqlQuery(`INSERT INTO collection (user_id, card_id, date) VALUES (${data[0].id}, ${req.query.card_id}, '${date}')`);

            mysqlQuery(`DELETE FROM collection WHERE user_id = ${req.session.userId} AND card_id = ${req.query.card_id} LIMIT 1`);

            res.writeHead(200, {"Content-Type": "application/json"});
            res.end(JSON.stringify({'status': 'success'}));
        } else {
            res.writeHead(200, {"Content-Type": "application/json"});
            res.end(JSON.stringify({'status': 'error', 'error': 'This user dosent exists'}));
        }
    });
})

.get('/favorite', function(req, res) {
    mysqlQuery(`UPDATE collection SET favorite = 1 WHERE user_id = ${req.session.userId} AND card_id = ${req.query.card_id}`).then((data) => {
        res.redirect('/collection');
    });
})

.get('/unfavorite', function(req, res) {
    mysqlQuery(`UPDATE collection SET favorite = 0 WHERE user_id = ${req.session.userId} AND card_id = ${req.query.card_id}`).then((data) => {
        res.redirect('/collection');
    });
})

.get('/open-booster', function(req, res) {
    mysqlQuery(`SELECT * FROM users WHERE id = ${req.session.userId} LIMIT 1`).then((data) => {
        let lastBoosterDate = new Date(data[0].last_booster);

        var yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if(lastBoosterDate == null || lastBoosterDate < yesterday) {
            fetch('https://hp-api.lainocs.fr/characters').then((response) => {
                response.json().then((allCards) => {
                    let selectedCards = [];
                    
                    for(let i = 0; i < 5; i++)
                    {
                        selectedCards.push(allCards[Math.floor(Math.random() * allCards.length)]);
                    }
                    
                    (async () => {
                        let date = (new Date()).toISOString().slice(0, 19).replace('T', ' ');
                        mysqlQuery(`UPDATE users SET last_booster = '${date}' WHERE id = ${req.session.userId}`);

                        selectedCards.forEach(function(card) {
                            mysqlQuery(`INSERT INTO collection (user_id, card_id, date) VALUES (${req.session.userId}, ${card.id}, '${date}')`);
                        });
                    })();
                    
                    res.writeHead(200, {"Content-Type": "application/json"});
                    res.end(JSON.stringify(selectedCards));
                });
            });
        } else {
            res.writeHead(200, {"Content-Type": "application/json"});
            res.end(JSON.stringify({"result": "error", "error": "You have already opened a booster in the last 24 hours."}));
        }
    });
})
 
io.sockets.on('connection', function (socket, pseudo) {
  socket.on('subscribe', function(content) {
    var pseudo = ent.encode(content['pseudo']);
    var email = ent.encode(content['email']);
    var password = ent.encode(content['password']);
    var md5sum = crypto.createHash('md5');
    var passwordMd5 = md5sum.update(password).digest('hex');
    console.log('email: ' + email);
    console.log('pseudo : ' + pseudo);
    console.log('password : ' + password);
    console.log('hash : ' + passwordMd5);
    
    (async () => {
        const result = await mysqlQuery(`INSERT INTO users (pseudo, email, password) VALUES ('${pseudo}', '${email}', '${passwordMd5}')`);
        console.log(result.insertId);
    })();
  });
   
  socket.on('login', function(content) {
    // console.log('coucou', socket.request.session.userId);

    var email = ent.encode(content['email']);
    var password = ent.encode(content['password']);
    var md5sum = crypto.createHash('md5');
    var passwordMd5 = md5sum.update(password).digest('hex');
    console.log(email, password);

    (async () => {
        let users = await mysqlQuery(`SELECT * FROM users WHERE email = '${email}' AND password = '${passwordMd5}' LIMIT 1`);
        console.log(users);
        if(users.length > 0) {
            let user = users[0];
        
            socket.request.session.userId = user['id'];
            socket.request.session.save();
        }
    })();
  });
});
 
server.listen(8080);