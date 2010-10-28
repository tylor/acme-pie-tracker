/**
 * Using a couple of nice libraries:
 * - http://github.com/visionmedia/express - http://expressjs.com/ - web framework
 * - http://github.com/visionmedia/ejs - templating for express
 * - http://github.com/technoweenie/twitter-node - connect to Twitter
 * - http://github.com/miksago/node-websocket-server - create websocket server
 * - http://github.com/christkv/node-mongodb-native - connect to MongoDB
 *
 * With guidance from: http://jeffkreeftmeijer.com/2010/experimenting-with-node-js/
 * And: http://github.com/mnutt/hummingbird
 * And: http://www.mongodb.org/display/DOCS/Home
 * And: http://github.com/visionmedia/express/tree/master/examples/
 * And: http://github.com/christkv/node-mongodb-native/tree/master/examples/
 */

// Get twitter ready.
var TwitterNode = require('./lib/twitter-node/lib/twitter-node').TwitterNode
  , ws          = require('./lib/node-websocket-server/lib/ws')
  , server      = ws.createServer()
  , sys         = require('sys')
  , app         = require('express').createServer()
  ;

// Get MongoDB ready.
var Db          = require('./lib/node-mongodb-native/lib/mongodb').Db
  , Connection  = require('./lib/node-mongodb-native/lib/mongodb').Connection
  , Server      = require('./lib/node-mongodb-native/lib/mongodb').Server
  , BSON        = require('./lib/node-mongodb-native/lib/mongodb').BSONNative
  ;

var host        = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var port        = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : Connection.DEFAULT_PORT;

var db          = new Db('node-mongo-acme', new Server(host, port, {}), {native_parser:true});

console.log("Connecting to MongoDB at " + host + ":" + port);

// Go mongo.
db.open(function(err, db) {
  // Setup Twitter. Yes, use your Twitter account.
  var twit = new TwitterNode(
    { user: 'username'
    , password: 'password'
    , track: ['acme_cafe pie'] // acme_cafe && pie.
    // , locations: [-122.75, 36.8, -121.75, 37.8] // tweets in SF
    }
  );

  // Open up our tweet collection.
  db.collection('tweets', function(err, collection) {

    // Respond to tweets from the stream.
    twit
      .addListener('tweet', function(tweet) {
        // Insert into MongoDB.
        collection.insert(tweet, function(docs) {
          sys.puts("@" + tweet.user.screen_name + ": " + tweet.text);
          // Broadcast to the websocket.
          server.broadcast(JSON.stringify(
            { 'screen_name': tweet.user.screen_name
            , 'profile_image_url': tweet.user.profile_image_url
            , 'text': tweet.text
            , 'id': tweet.id
            , 'created_at': tweet.created_at
            , 'tweet': tweet
            }
          ));
        });
      })
      .addListener('limit', function(limit) {
        sys.puts("LIMIT: " + sys.inspect(limit));
        server.close();
      })
      .addListener('delete', function(del) {
        sys.puts("DELETE: " + sys.inspect(del));
        server.close();
      })
      .addListener('end', function(resp) {
        sys.puts("wave goodbye... " + resp.statusCode);
        server.close();
      })
      .addListener('error', function(error) {
        console.log('Twit error: ' + error.message);
      })
      .stream();

    // Start websocket server.
    server.listen(8000, "127.0.0.1");
    console.log('Websocket server started on port 8000');


    // Define the website using express.

    // Homepage listing.
    app.get('/', function(req, res){
      collection.find({}, function(err, cursor) {
        // Maybe intended to be implemented as an iterator, for now...
        cursor.toArray(function(err, users) {
          res.render('index.ejs', {
            locals: {
              users: users
            }
          });
        });
      });
    });

    // /screen_name shows Twitter user pie stats.
    app.get('/:id', function(req, res){
      collection.find({ 'user.screen_name' : req.params.id }, function(err, cursor) {
        // Probably intended to be implemented as an iterator, for now...
        cursor.toArray(function(err, docs) {
          // console.log(sys.inspect(docs['0'].text));
          if (docs.length > 0) {
            var text = '';
            docs.forEach(function(doc) {
              // Need partials...
              text += '<div>' + doc.text + '</div>';
            });
            res.send(text);
          }
          else {
            res.send("This user doesn't have any pie tweets.");
          }
        });
      });
    });

    // Start web server.
    app.listen(3000);
    console.log('Express started on port 3000');

    /*collection.remove(function(err, collection) {
      collection.insert([{'a':1}, {'a':2}, {'b':3}], function(docs) {
        // Count the number of records
        collection.count(function(err, count) {
          sys.puts("There are " + count + " records.");
        });
      });
    });*/
  });
});
