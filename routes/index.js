
/*
 * GET home page.
 */

exports.index = function(req, res){
  Timeline.find({}, function(err, tasks){
    res.render('index', { title: 'TimeLine', tasks: tasks })
  });
};

exports.task = function(req, res){
  Timeline.find({ _id: req.params.id }, function(err, task){
    everyday.find({ taskid: req.params.id }, function(err, e){
      res.render('task', { title: 'Task', task: task, every: e });
    });
  });
};

exports.createtask = function(req, res){
  res.render('createtask', { title: 'NewTask' })
};
