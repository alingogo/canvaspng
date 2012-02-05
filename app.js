
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
//  , check  = require('./lib/check.js')

var irc = new ircc.Client('irc.dollyfish.net.nz', 'myNick', {
    channels: ['#blah']
});

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
                       , date : String 
});
var everydaySchema = new Schema({
                         taskid: String
                       , total:  Number
                       , done:   Number
                       , day:    Number
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
  timeline.date = req.body.date;
  timeline.save(function(err){
    if(!err) { 
      console.log("Success!");
    } else {
      console.log(err);
    };
  });

 for(i=0;i<9;i++){
    e = new everyday();
    e.taskid = timeline._id;
    e.total  = 30 + i*2;
    e.done   = 30 - i*3;
    e.day    = 5 + i;

    e.save(function(err){
      //if(!err) console.log("OK!");
    });
  }

  everyday.find({taskid: timeline._id}, function(err, e){
    var ary = un.sortBy(e, function(i){i.day});
    
    var canvas = new Canvas(730, 500)
      , ctx = canvas.getContext('2d');

    ctx.strokeStyle = 'rgba(0,0,0,5)';
    ctx.beginPath();
    ctx.lineTo(50, 50);
    ctx.lineTo(50, 450);
    ctx.lineTo(680, 450);
    ctx.stroke();

    ctx.beginPath();
    ctx.lineTo(50,450);
    var k = 0;
    un.each(ary, function(i){
      ctx.lineTo(50 + parseInt(k/9*600), 450 - parseInt(i.total/50*400));
      k++;
    });
    ctx.stroke();

    ctx.beginPath();
    ctx.lineTo(50,450);
    k = 0;
    un.each(ary, function(i){
      ctx.lineTo(50 + parseInt(k/9*600), 450 - parseInt(i.done/50*400));
      k++;
    });
    ctx.stroke();

    var fs = require('fs')
    var out = fs.createWriteStream(__dirname + '/public/images/test.png')
    var stream = canvas.createPNGStream();

    stream.on('data', function(chunk){
      out.write(chunk);
    });
  });

  res.redirect('/');
});

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);


// schedule

var rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [0, new schedule.Range(1, 5)];
rule.hour = 9;
rule.minute = 15;

var j = schedule.scheduleJob(rule, function(){
    console.log('Today is recognized by Rebecca Black!');

  irc.say('#channel', 'timeline');
});
