// user defined settings
var host = '127.0.0.1';
var port = 8888;

// server config and setup
var http = require('http');
var express = require('express');
var app = express();

// set up handlebars view engine
var handlebars = require('express-handlebars') .create({ defaultLayout:'main' });
    app.engine('handlebars', handlebars.engine);
    app.set('view engine', 'handlebars');
app.use(express.static(__dirname + '/public'));

// setup AWS middleware

var multiparty = require('multiparty');
var util = require('util');
var qs = require('querystring');
var AWS = require('aws-sdk');
var uuid = require('node-uuid');
var s3 = new AWS.S3();


// APP ROUTES
app.get('/', function (req, res) {
  s3.listBuckets(function (err, data) {
    if (err) {
      console.log(err);
      res.render('500');
    } else {
      res.render('index', { buckets: data });
    }
  });
});

// upload files to S3
app.post('/', function (req, res) {
  var form = new multiparty.Form();
  var keyName;
  var bucketName;
  form.on('field', function(name, value) {
    if (name === 'bucketName') {
      keyName = value;
    } else if (name === 'keyName') {
      bucketName = value;
    }
  });
  form.on('part', function(part) {
    s3.putObject({
      Bucket: bucketName,
      Key: keyName,
      ACL: 'public-read',
      Body: part,
      ContentLength: part.byteCount,
    }, function(err, data) {
      if (err) {
        console.log(err);
        res.render('500');
      } else {
        console.log("done", data);
        res.end("OK");
        console.log("https://s3.amazonaws.com/" + bucket + '/' + destPath);
      }
    });
  });
  form.parse(req);
  res.render('upload', { bucket: bucketName, key: keyName });
});

// get search results from S3
app.get('/search', function (req, res) {
  var params = {
    Bucket: req.query.bucketName, /* required */
    MaxKeys: 10,
    Prefix: req.query.prefixPath
  };
  s3.listObjectVersions(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
      res.render('500');
    } else {
      console.log(data);
      // remove invalid items based on given key name
      if (req.query.keyName != '') {
        for (i = 0; i < data.Versions.length; i++) {
          version = data.Versions[i];
          if (version.Key.indexOf(req.query.keyName) < 0) {
            data.Versions.splice(i, 1);
            i--;
          }
        }
      }
      // remove invalid items based on given dates
      var start = new Date('01/01/1900');
      var end = Date.now();
      if (req.query.startDate) {
        start = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        end = new Date(req.query.endDate);
      }
      for (i = 0; i < data.Versions.length; i++) {
        version = data.Versions[i];
        if (version.LastModified < start || version.LastModified > end) {
          data.Versions.splice(i, 1);
          i--;
        }
      }
      // attach temp signedURL for all remaining files
      for (i = 0; i < data.Versions.length; i++) {
        var signedUrl = s3.getSignedUrl('getObject', { Bucket: req.query.bucketName, Key: data.Versions[i].Key, Expires: 60 });
        data.Versions[i]['url'] = signedUrl;
      }
      res.render('search', {bucket: req.query.bucketName,
                            prefix: req.query.prefixPath,
                            file: req.query.keyName,
                            results: data});  // successful response
    }
  });
});

// custom 404 page
app.use(function (req, res) {
  res.render('404');
});

// custom 500 page
app.use(function (req, res) {
  res.render('500');
});


// Start up the node server
app.listen(port, host, function (){
  console.log('Server running at http://'+host+':'+port+'/');
});
