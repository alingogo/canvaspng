
/**
 * Module dependencies.
 */

var express    = require('express')
  , routes     = require('./routes')
  , Canvas     = require('canvas')
  , mongoose   = require('mongoose')
  , schedule   = require('node-schedule')
  , ircc       = require('irc')
  , un         = require('underscore')
  , unstring   = require('underscore.string')
  , req        = require('request')
  , htmlparser = require("htmlparser")
  , jsdom      = require('jsdom')
  , im         = require('imagemagick')
  , fs         = require('fs')
 
require('date-utils')
//  , check  = require('./lib/check.js')



// irc_bot
var channel = '#yan_test';
var irc = new ircc.Client('ant.rgk.ricoh.co.jp', 'tl_bot', {
    channels: [channel],
});
setTimeout(function(){ irc.say(channel, 'everybody hello'); }, 3000);
irc.addListener('message', function (from, to, message) {
    console.log('%s => %s: %s', from, to, message);

    if ( to.match(/^[#&]/) ) {
        // channel message
        if ( message.match(/hello/i) ) {
            irc.say(to, 'Hello there ' + from);
        }
        if ( message.match(/dance/) ) {
            setTimeout(function () { irc.say(to, "\u0001ACTION dances: :D\\-<\u0001") }, 1000);
            setTimeout(function () { irc.say(to, "\u0001ACTION dances: :D|-<\u0001")  }, 2000);
            setTimeout(function () { irc.say(to, "\u0001ACTION dances: :D/-<\u0001")  }, 3000);
            setTimeout(function () { irc.say(to, "\u0001ACTION dances: :D|-<\u0001")  }, 4000);
        }
    }
    else {
        // private message
    }
});
// Configuration

var app = module.exports = express.createServer();

var mongoUri = 'http://127.0.0.1:27017/canvaspng';


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
Everyday = mongoose.model('Everyday', everydaySchema);

// Routes

app.get('/', routes.index);
app.get('/task/today', function(req, res){
  var date = Date.yesterday();
  var today = date.getFullYear().toString() + ('00' + (date.getMonth()+1).toString()).slice(-2) + date.getDate().toString();
  Timeline.find({date: {$all: [today]}}, function(err, d){
    if ( d.length == 0 ) {
      Timeline.find().sort('ms', -1).limit(1).run(function (err, d) {
        var timeline = d[0];
        res.redirect('/task/' + timeline._id);
      });
      return
    }
    var timeline = d[0];
    res.redirect('/task/' + timeline._id);
  });
});
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




var j = schedule.scheduleJob(rule, function(){
  console.log('Today is recognized by Rebecca Black!');

  var date = new Date();
  var today = date.getFullYear().toString() + ('00' + (date.getMonth()+1).toString()).slice(-2) + ('00' + (date.getDate()-1).toString()).slice(-2);
console.log(today);
  Timeline.find({date: {$all: [today]}}, function(err, d){
    if ( d.length == 0 ) {
      irc.say(channel, 'today is nothing!');
      return
    }
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
              var irc_report =   "total: " + (result.closed + result.other).toString()
                               + "  non-closed: " + result.other.toString()
                               + "   timeline picture today: http://133.139.82.232:3010/task/" + timeline._id;
              irc.say(channel, irc_report);  
              Everyday.update({"day":today}, {"total":result.closed+result.other, "done":result.closed}, function(err, a){
                if ( a != 0 ) {
                    write_canvas(timeline);
                    //resize(timeline);
                } else {
                  var e = new Everyday();
                  e.day = today;
                  e.taskid = timeline._id;
                  e.total = result.closed+result.other;
                  e.done  = result.closed;
                  e.save(function(){
                    write_canvas(timeline);
                    //resize(timeline);
                  });
                }
              });
      });
    });
  });
});

var write_canvas = function(tl){
    Everyday.find({taskid: tl._id}, function(err, e){
      var ary = un.sortBy(e, function(i){i.day});
      var max = Number(tl.max) + 10;
      var days = tl.date.toString().split(",").length;
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
        ctx.strokeText(tl.date.toString().split(",")[i-1].slice(-2), 45+vertical*(i-1), 465);
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
  
      var out = fs.createWriteStream(__dirname + '/public/images/' + tl.ms + 'test.png')
      var stream = canvas.createPNGStream();
  
      stream.on('data', function(chunk){
        out.write(chunk);
      });
      stream.on('end', function(){ out.end(); });
      out.on('error', function(){ console.log("error") });
      out.on('close', function(){ resize(tl); });
    });
}
/*
var resize = function(tl){
    im.convert.path = '/usr/bin/convert';
    im.identify.path = '/usr/bin/identify';
    im.resize({
               srcData: fs.readFileSync('public/images/' + tl.ms + 'test.png', 'binary'),
               srcFormat: 'png',
               format: 'png',
               width  : 128,
               filter : 'box',
               timeout: 1200
              }, function(err, stdout, stderr){
               if (err) throw err;
               fs.writeFileSync('public/images/today_small.png', stdout, 'binary');
              });
}
*/
//  there is no binary?
var resize = function(tl){
    im.convert.path = '/usr/bin/convert';
    im.identify.path = '/usr/bin/identify';
    im.resize({
                srcPath: __dirname + '/public/images/' + tl.ms + 'test.png',
                dstPath: __dirname + '/public/images/today_small.png',
                srcFormat: 'png',
                format: 'png',
                filter: 'box',
                timeout: 1200,
                width  : 128
              }, function(err, stdout, stderr){
                if (err) throw err;
                console.log('resized');
              }
    );
}

/* img.onload
var resize = function(tl){
    var Image = Canvas.Image;
    var fs = require('fs');
    
    var img = new Image;

    img.src = __dirname + '/public/images/131test.png';
    img.onerror = function(err){
      throw err;
    }

    img.onload = function(){
console.log("imageloaded");
      var width = img.width / 6
        , height = img.height / 6
        , canvas = new Canvas(width, height)
        , ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, heigth);
      canvas.toBuffer(function(err, buf){
        fs.writeFile(__dirname + '/public/images/' + tl.ms + 'small.png', buf, function(){
          console.log('Resized and saved');
        });
      });
    }
}
*/
