/**
 * Using a couple of nice libraries:
 * - http://github.com/technoweenie/twitter-node
 * - http://github.com/miksago/node-websocket-server
 *
 * With some guidance from: http://jeffkreeftmeijer.com/2010/experimenting-with-node-js/
 */
 
// Get twitter ready.
var TwitterNode = require('./lib/twitter-node/lib/twitter-node').TwitterNode,
    ws          = require('./lib/node-websocket-server/lib/ws'),
    server      = ws.createServer(),
    sys         = require('sys');
    
// Get MongoDB ready.
var Db = require('./lib/node-mongodb-native/lib/mongodb').Db,
    Connection = require('./lib/node-mongodb-native/lib/mongodb').Connection,
    Server = require('./lib/node-mongodb-native/lib/mongodb').Server,
    BSON = require('./lib/node-mongodb-native/lib/mongodb').BSONNative;

var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : Connection.DEFAULT_PORT;

sys.puts("Connecting to " + host + ":" + port);
var db = new Db('node-mongo-acme', new Server(host, port, {}), {native_parser:true});
db.open(function(err, db) {
    var twit = new TwitterNode({
      user: 'username', // Yes, use your Twitter account.
      password: 'password',
      track: ['acme_cafe pie'], // acme_cafe && pie.
      // locations: [-122.75, 36.8, -121.75, 37.8] // tweets in SF
    });
    
    db.collection('tweets', function(err, collection) {
      // Listen for errors.
      twit.addListener('error', function(error) {
        console.log(error.message);
      });

      twit
        .addListener('tweet', function(tweet) {
          collection.insert(tweet, function(docs) {
            sys.puts("@" + tweet.user.screen_name + ": " + tweet.text);
            server.broadcast(JSON.stringify({
              'screen_name': tweet.user.screen_name,
              'profile_image_url': tweet.user.profile_image_url,
              'text': tweet.text,
              'id': tweet.id,
              'created_at': tweet.created_at,
              'tweet': tweet,
            }));
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
        .stream();

      // Start websocket server.
      server.listen(8000, "127.0.0.1");
      
      
      
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
