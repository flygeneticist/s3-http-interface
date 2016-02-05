// user defined settings
var host = '127.0.0.1';
var port = 8888;

// server config and setup
var http = require('http');
var express = require('express');
var app = express();

// set up handlebars view engine
var handlebars = require('express-handlebars').create({
  defaultLayout:'main',
  helpers: { dateFormater: function (d) { return new Date(d).toString('MM-dd-yy'); }}
});
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
app.post('/upload', function (req, res) {
  var form = new multiparty.Form();
  var keyName;
  var bucketName;
  form.on('field', function(name, value) {
    if (name === 'bucketName') {
      bucketName = value;
    } else if (name === 'keyName') {
      keyName = value;
    }
  });
  form.on('part', function(part) {
    params = {
      Bucket: bucketName,
      Key: keyName,
      Body: part,
      ContentLength: part.byteCount,
    }
    s3.putObject(params, function(err, data) {
      if (err) {
        console.log(err, "\nParams:\n", params);
        res.end('500');
      } else {
        console.log("done - https://s3.amazonaws.com/" + bucketName + '/' + keyName, data);
        res.end("OK");
      }
    });
  });
  form.parse(req);
  res.render('upload', bucketName, keyName);
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
      // setup date parameters
      var start = new Date('01/01/1900');
      var end = Date.now();
      if (req.query.startDate) {
        start = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        end = new Date(req.query.endDate);
      }
      // remove all files that do not meet criteria
      for (i = 0; i < data.Versions.length; i++) {
        version = data.Versions[i];
        // remove invalid items based on given dates
        if (version.LastModified < start || version.LastModified > end) {
          data.Versions.splice(i, 1);
          i--;
        }
        // remove invalid items based on given key name
        else if (req.query.keyName != '' && version.Key.indexOf(req.query.keyName) < 0) {
          data.Versions.splice(i, 1);
          i--;
        }
        // remove invalid folder items based on trailing slash in key name
        else if (version.Key.slice(-1) == "/") {
          data.Versions.splice(i, 1);
          i--;
        }
        else {
          // generate a temporary signed URL for downloading
          var signedUrl = s3.getSignedUrl('getObject', { Bucket: req.query.bucketName, Key: version.Key, Expires: 60 });
          data.Versions[i]['url'] = signedUrl;
        }
      }
      res.render('search', {bucket: req.query.bucketName,
                            prefix: req.query.prefixPath,
                            file: req.query.keyName,
                            results: data});
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
