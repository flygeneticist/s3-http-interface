// set the app's port, host, and other basic settings
var host = '127.0.0.1';
var port = 8888;

var http = require('http');
var express = require('express');
var app = express();
app.use(express.static(__dirname + '/views'));
app.set('view engine', 'jade');

// view routes
app.get('/', function(req, res) {
  res.render('index.html');
});

// start up the node server
app.listen(port, host, function (){
  console.log('Server running at http://'+host+':'+port+'/');
});
