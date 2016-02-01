// user defined settings
var host = '127.0.0.1';
var port = 8888;

// server config and setup
var http = require('http');
var express = require('express');
var app = express();
var qs = require('querystring');
var AWS = require('aws-sdk');
var uuid = require('node-uuid');
var s3 = new AWS.S3();

app.use(express.static(__dirname + '/views'));
app.set('view engine', 'jade');

// APP ROUTES
app.get('/', function (req, res) {
  s3.listBuckets(function (err, data) {
    if (err)
      res.render(err);
  });
  res.render('index.html', data);
});

app.post('/upload', function (req, res) {
  var body = '';

  req.on('data', function (data) {
    body += data;
    // Too much POST data, kill the connection!
    // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
    if (body.length > 1e6)
        req.connection.destroy();
  });

  req.on('end', function () {
    var post = qs.parse(body);
    var params = {  Bucket: post['bucketPath'],
                    Key: post['fileKey.name'],
                    Body: post['fileKey.data'] //stream
                  };
    s3.putObject(params, function (err, data) {
      if (err)
        res.send(err);
      else
        res.send("Successfully uploaded data to " + params['Bucket'] + "/" + params['Key']);
    });
  });
});

app.get('/search', function (req, res) {
  res.send('You searching in the wrong place foo.')
});

// Start up the node server
app.listen(port, host, function (){
  console.log('Server running at http://'+host+':'+port+'/');
});
