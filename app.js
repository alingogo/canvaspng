
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , Canvas = require('canvas')
  , mongoose = require('mongoose')
  , schedule = require('node-schedule')
  , ircc    = require('irc')
  , un      = require('underscore')
  , unstring = require('underscore.string')
  , req     = require('request')
  , htmlparser = require("htmlparser")
  , jsdom = require('jsdom')
//  , check  = require('./lib/check.js')
/*
var irc = new ircc.Client('ant.rgk.ricoh.co.jp', 'yan_test', {
    channels: ['#test_yan']
});
*/
var app = module.exports = express.createServer();

var mongoUri = 'http://127.0.0.1:27017/canvaspng';

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  mongoose.connect(mongoUri);
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});



//db

var Schema = mongoose.Schema;
var timelineschema = new Schema({
                         name : String
                       , max  : Number
                       , date : [String]
                       , ms   : String
});
var everydaySchema = new Schema({
                         taskid: String
                       , total:  Number
                       , done:   Number
                       , day:    String
});
Timeline = mongoose.model('Timeline', timelineschema);
everyday = mongoose.model('Everyday', everydaySchema);

// Routes

app.get('/', routes.index);
app.get('/task/:id', routes.task);
app.get('/createtask', routes.createtask);
app.post('/newtask', function(req, res){
  var timeline = new Timeline();
  timeline.name = req.body.taskname;
  timeline.max  = req.body.max;
  timeline.date = req.body.date.split(",");
  timeline.ms   = req.body.ms;
  timeline.save(function(err){
    if(!err) { 
      console.log("Success!");
    } else {
      console.log(err);
    };
  });

  res.redirect('/');
});

app.listen(3010);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);


// schedule

var rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [0, new schedule.Range(1, 5)];
rule.hour = 9;
rule.minute = 25;




//var j = schedule.scheduleJob(rule, function(){
  console.log('Today is recognized by Rebecca Black!');

  var date = new Date();
  var today = date.getFullYear().toString() + ('00' + (date.getMonth()+1).toString()).slice(-2) + date.getDate().toString();
  Timeline.find({date: {$all: [today]}}, function(err, d){
    var timeline = d[0];
    var tracurl = "http://quanp.cps.ricoh.co.jp/trac/quanp-world/query?status=accepted&status=approved&status=assigned&status=closed&status=implemented&status=new&status=pending&status=reopened&status=verified&group=status&order=priority&col=id&col=summary&col=status&col=version&col=blocking&milestone=%23" + timeline.ms

    req(tracurl, function(err, res, body){
      jsdom.env(body,
            ['./jquery-1.5.min.js'],
            function(errors, window) {
              var s = window.$("h2").text();
              var ary = unstring.lines(s);
              var type = false;
              var result = {closed:0, other:0};
              for(i=0;i<ary.length;i++){
                if ( ary[i].match(/closed/) ) {
                  type = true;
                } else if ( ary[i].match(/(\d+)/) && type ) {
                  result.closed = Number(RegExp.$1);
                  type = false;
                } else if ( ary[i].match(/(\d+)/) ) {
                  result.other = result.other + Number(RegExp.$1);
                } else {
                }
              }
              console.log(result);
              everyday.update({"day":today}, {"total":result.closed+result.other, "done":result.closed}, function(err, a){
                if (err) {
                  console.log(err);
                }
              });
      });
    });

    everyday.find({taskid: timeline._id}, function(err, e){
      var ary = un.sortBy(e, function(i){i.day});
      var max = Number(timeline.max) + 10;
      var days = timeline.date.toString().split(",").length;
      var horizontal = 400/max;
      var vertical = 600/days;
      var canvas = new Canvas(730, 500)
        , ctx = canvas.getContext('2d');
 
      ctx.strokeStyle = 'rgba(0,0,0,5)';
      ctx.beginPath();
      ctx.lineTo(50, 50);
      ctx.lineTo(50, 450);
      ctx.lineTo(680, 450);
      ctx.stroke();

      for(i=1;i<(parseInt(max/5)+1);i++){
        ctx.strokeText(i*5, 35, 455-i*5*horizontal);
      }
      for(i=1;i<=days;i++){
        ctx.strokeText(timeline.date.toString().split(",")[i-1].slice(-2), 45+vertical*(i-1), 465);
      }

      ctx.beginPath();
      ctx.lineTo(50, 450 - parseInt(max - 10)*horizontal);
      ctx.lineTo(50 + parseInt(vertical*(days-1)), 450);
      ctx.stroke();

      ctx.beginPath();
      ctx.lineTo(50,450);
      var k = 0;
      un.each(ary, function(i){
        ctx.lineTo(50 + parseInt(k*vertical), 450 - parseInt(i.total*horizontal));
        k++;
      });
      ctx.stroke();

      ctx.beginPath();
      ctx.lineTo(50,450);
      k = 0;
      un.each(ary, function(i){
        ctx.lineTo(50 + parseInt(k*vertical), 450 - parseInt((i.total - i.done)*horizontal));
        k++;
      });
      ctx.stroke();
  
      var fs = require('fs')
      var out = fs.createWriteStream(__dirname + '/public/images/' + timeline.ms + 'test.png')
      var stream = canvas.createPNGStream();
  
      stream.on('data', function(chunk){
        out.write(chunk);
      });
    });
//  })
// irc.say('#channel', 'timeline');
});
