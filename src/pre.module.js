/*jshint onevar: false, indent:4, strict: false */
/*global setImmediate: false, setTimeout: false, console: false, module: true, process: true, define: true, onmessage: true */

var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function';
var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

/**
 * Tiny event emitter for Node.js and the browser
 * from https://github.com/joaquimserafim/tiny-eventemitter
 */
function EventEmitter () {
  if (!(this instanceof EventEmitter)) return new EventEmitter();
  EventEmitter.init.call(this);
}

EventEmitter.init = function () {
  this._listeners = {};
};

EventEmitter.prototype._addListenner = function (type, listener, once) {
  if (typeof listener !== 'function')
    throw TypeError('listener must be a function');

  if (!this._listeners[type])
    this._listeners[type] = {
      once: once,
      fn: function () {
        return listener.apply(this, arguments);
      }
    };

  return this;
};

EventEmitter.prototype.listeners = function () {
  return Object.keys(this._listeners);
};

EventEmitter.prototype.on = function (type, listener) {
  return this._addListenner(type, listener, 0);
};

EventEmitter.prototype.once = function (type, listener) {
  return this._addListenner(type, listener, 1);
};

EventEmitter.prototype.remove = function (type) {
  if (type) {
    delete this._listeners[type];
    return this;
  }

  for (var e in this._listeners) delete this._listeners[e];

  return this;
};

EventEmitter.prototype.emit = function (type) {
  if (!this._listeners[type])
    return;

  var args = Array.prototype.slice.call(arguments, 1);

  // exec event
  this._listeners[type].fn.apply(this, args);

  // remove events that run only once
  if (this._listeners[type].once) this.remove(type);
  
  return this;
};

EventEmitter.prototype.deferEmit = function (type) {
  var self = this;

  if (!self._listeners[type])
    return;

  var args = Array.prototype.slice.call(arguments, 1);

  process.nextTick(function () {
    // exec event
    self._listeners[type].fn.apply(self, args);

    // remove events that run only once
    if (self._listeners[type].once) self.remove(type);
  });

  return self;
};



/*!
 * recast.js
 * https://github.com/vincent/recast.js
 *
 * Copyright 2014 Vincent Lark
 * Released under the MIT license
 */
var Module = {
    canvas: {},
    noInitialRun: true,
    noFSInit: true
};
var recast = Module;


// global on the server, window in the browser
var root, previous_recast;

root = this;
if (root !== null) {
  previous_recast = root.recast;
}

recast.__RECAST_CALLBACKS = {};
recast.__RECAST_CALLBACKS.size = 0;

recast.__RECAST_OBJECTS = {};

recast.vent = new EventEmitter();
recast.on = recast.vent.on;
recast.emit = recast.vent.emit;
recast.deferEmit = recast.vent.deferEmit;

var _ajax = function(url, data, callback, type) {
  var data_array, data_string, idx, req, value;
  if (data == null) {
    data = {};
  }
  if (callback == null) {
    callback = function() {};
  }
  if (type == null) {
    //default to a GET request
    type = 'GET';
  }
  data_array = [];
  for (idx in data) {
    value = data[idx];
    data_array.push('' + idx + '=' + value);
  }
  data_string = data_array.join('&');
  req = new XMLHttpRequest();
  req.open(type, url, false);
  req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
  req.onreadystatechange = function() {
    if (req.readyState == 4 && req.status == 200) {
      return callback(req.responseText);
    }
  };
  // debug('ajax request', data_string);
  req.send(data_string);
  return req;
};

var _OBJDataLoader = function (contents, callback) {
  recast.initWithFileContent(contents.toString());
  recast.build();
  recast.initCrowd(1000, 1.0);
  callback(recast);
};

//// nextTick implementation with browser-compatible fallback ////
if (typeof process === 'undefined' || !(process.nextTick)) {
    if (typeof setImmediate === 'function') {
        recast.nextTick = function (fn) {
            // not a direct alias for IE10 compatibility
            setImmediate(fn);
        };
        recast.setImmediate = recast.nextTick;
    }
    else {
        recast.nextTick = function (fn) {
            setTimeout(fn, 0);
        };
        recast.setImmediate = recast.nextTick;
    }
}
else {
    recast.nextTick = process.nextTick;
    if (typeof setImmediate !== 'undefined') {
        recast.setImmediate = function (fn) {
          // not a direct alias for IE10 compatibility
          setImmediate(fn);
        };
    }
    else {
        recast.setImmediate = recast.nextTick;
    }
}

//// link worker recast module functions ////

var workerMain = function(event) {
  if (! event.data) {
    return;
  }

  var message = event.data;

  switch(message.type) {

    case 'set_cellSize':
    case 'set_cellHeight':
    case 'set_agentHeight':
    case 'set_agentRadius':
    case 'set_agentMaxClimb':
    case 'set_agentMaxSlope':
      recast[message.type](message.data);
      break;

    case 'config':
    case 'settings':
      recast.set_cellSize(message.data.cellSize);
      recast.set_cellHeight(message.data.cellHeight);
      recast.set_agentHeight(message.data.agentHeight);
      recast.set_agentRadius(message.data.agentRadius);
      recast.set_agentMaxClimb(message.data.agentMaxClimb);
      recast.set_agentMaxSlope(message.data.agentMaxSlope);
      postMessage({
        vent: true,
        type: message.type,
        callback: message.callback
      });
      break;

    case 'OBJLoader':
      recast.OBJLoader(message.data, function() {
        postMessage({
          type: message.type,
          callback: message.callback
        });
      });
      break;

    case 'OBJDataLoader':
      _OBJDataLoader(message.data, function() {
        postMessage({
          type: message.type,
          callback: message.callback
        });
      });
      break;

    case 'findNearestPoint':
      recast.findNearestPoint(
        message.data.position.x,
        message.data.position.y,
        message.data.position.z,
        message.data.extend.x,
        message.data.extend.y,
        message.data.extend.z,
        recast.cb(function(px, py, pz){
          postMessage({
            type: message.type,
            data: [ px, py, pz ],
            callback: message.callback
          });
        })
      );
      break;

    case 'findNearestPoly':
      recast.findNearestPoly(
        message.data.position.x,
        message.data.position.y,
        message.data.position.z,
        message.data.extend.x,
        message.data.extend.y,
        message.data.extend.z,
        recast.cb(function(points){
          postMessage({
            type: message.type,
            data: Array.prototype.slice.call(arguments),
            callback: message.callback
          });
        })
      );
      break;

    case 'findPath':
      recast.findPath(message.data.sx, message.data.sy, message.data.sz, message.data.dx, message.data.dy, message.data.dz, message.data.max, recast.cb(function(path){
        postMessage({
          type: message.type,
          data: [ path ],
          callback: message.callback
        });
      }));
      break;

    case 'getRandomPoint':
      recast.getRandomPoint(recast.cb(function(px, py, pz){
        postMessage({
          type: message.type,
          data: [ px, py, pz ],
          callback: message.callback
        });
      }));
      break;

    case 'setPolyUnwalkable':
      recast.setPolyUnwalkable(message.data.sx, message.data.sy, message.data.sz, message.data.dx, message.data.dy, message.data.dz, message.data.flags);
      break;

    case 'addCrowdAgent':
      var idx = recast.addCrowdAgent(
        message.data.position.x,
        message.data.position.y,
        message.data.position.z,
        message.data.radius,
        message.data.height,
        message.data.maxAcceleration,
        message.data.maxSpeed,
        message.data.updateFlags,
        message.data.separationWeight
      );
      postMessage({
        vent: true,
        type: message.type,
        data: [ idx ],
        callback: message.callback
      });
      break;

    case 'updateCrowdAgentParameters':
      recast.updateCrowdAgentParameters(message.data.agent,
        message.data.options.position.x,
        message.data.options.position.y,
        message.data.options.position.z,
        message.data.options.radius,
        message.data.options.height,
        message.data.options.maxAcceleration,
        message.data.options.maxSpeed,
        message.data.options.updateFlags,
        message.data.options.separationWeight
      );
      break;

    case 'requestMoveVelocity':
      recast.requestMoveVelocity(message.data.agent, message.data.velocity.x, message.data.velocity.y, message.data.velocity.z);
      break;

    case 'removeCrowdAgent':
      recast.removeCrowdAgent(message.data);
      postMessage({
        vent: true,
        type: message.type,
        data: [ message.data ],
        callback: message.callback
      });
      break;

    case 'crowdRequestMoveTarget':
      recast.crowdRequestMoveTarget(message.data.agent, message.data.x, message.data.y, message.data.z);
      break;

    case 'crowdUpdate':
      recast.crowdUpdate(message.data);
      recast._crowdGetActiveAgents(recast.cb(function(){
        postMessage({
          vent: true,
          type: message.type,
          data: [ agentPoolBuffer ],
          callback: message.callback
        });
      }));
      break;

    case 'crowdGetActiveAgents':
      recast._crowdGetActiveAgents(! message.callback ? -1 : recast.cb(function(){
        postMessage({
          vent: true,
          type: message.type,
          data: [ agentPoolBuffer ],
          callback: message.callback
        });
      }));
      break;

    default:
      throw new Error(message.type + ' is not a known Recast method');

  }
};

if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  onmessage = workerMain;
  // postMessage = postMessage;

} else if (ENVIRONMENT_IS_NODE) {
  process.on('message', function(message) {
    workerMain(message);
  });

  postMessage = function (message) {
    process.send({ data: message });
  };

}

//// exported recast module functions ////

recast.setGLContext = function (gl_context) {
  recast.glContext = gl_context;
};


recast.cb = function (func) {
  recast.__RECAST_CALLBACKS.size = recast.__RECAST_CALLBACKS.size % 10;
  var last = (++recast.__RECAST_CALLBACKS.size) - 1;
  recast.__RECAST_CALLBACKS[last] = func;
  // recast.__RECAST_CALLBACKS[last].__debug = 'callback_id#' + last;
  return last;
};

recast.drawObject = function (objectName) {
  var object = recast.__RECAST_OBJECTS[objectName];

  if (! object) {
    throw new Error(objectName + ' is not a valid object, or has not ben created');
  }

  // recast.glContext.clear(recast.glContext.COLOR_BUFFER_BIT | recast.glContext.DEPTH_BUFFER_BIT);

  for (var i = 0; i < object.buffers.length; i++) {
    recast.glContext.bindBuffer(recast.glContext.ARRAY_BUFFER, object.buffers[i]);
    recast.glContext.bufferData(recast.glContext.ARRAY_BUFFER, object.datas[i], recast.glContext.STATIC_DRAW);
    recast.glContext.drawArrays(recast.glContext.TRIANGLES, 0, object.buffers[i].numItems);
  }
};

recast.settings = function (options) {
  recast.set_cellSize(options.cellSize);
  recast.set_cellHeight(options.cellHeight);
  recast.set_agentHeight(options.agentHeight);
  recast.set_agentRadius(options.agentRadius);
  recast.set_agentMaxClimb(options.agentMaxClimb);
  recast.set_agentMaxSlope(options.agentMaxSlope);
};

recast.OBJDataLoader = function (data, callback) {
  _OBJDataLoader(data, callback);
};

recast.OBJLoader = function (path, callback) {
  // with node FS api
  if (ENVIRONMENT_IS_NODE) {
    var fs = require('fs');
    fs.readFile(path, function(err, data) {
      if (err) throw new Error(err);
      _OBJDataLoader(data, callback);
    });

  // with ajax
  } else {
    _ajax(path, {}, function(data) {
      _OBJDataLoader(data, callback);
    });
  }
};

recast.addAgent = function (options) {
  return recast.addCrowdAgent(
    options.position.x,
    options.position.y,
    options.position.z,
    options.radius,
    options.height,
    options.maxAcceleration,
    options.maxSpeed,
    options.updateFlags,
    options.separationWeight
  );
};

recast.crowdGetActiveAgents = function (callback_id) {
  return recast._crowdGetActiveAgents(callback_id || -1);
};

//////////////////////////////////////////

function AgentPool (n) {
  this.__pools = [];
  var i = 0;
  while (i < n) {
    this.__pools[i] = { position:{}, velocity:{} };
    i++;
  }
  // debug('__pools is %o length', this.__pools.length);
}

// Get a new array
AgentPool.prototype.get = function(idx,position_x,position_y,position_z,velocity_x,velocity_y,velocity_z,radius,active,state,neighbors) {
  if ( this.__pools.length > 0 ) {
    var ag = this.__pools.pop();
    ag.idx = idx;
    ag.position.x = position_x;
    ag.position.y = position_y;
    ag.position.z = position_z;
    ag.velocity.x = velocity_x;
    ag.velocity.y = velocity_y;
    ag.velocity.z = velocity_z;
    ag.radius = radius;
    ag.active = active;
    ag.state = state;
    ag.neighbors = neighbors;
    return ag;
  }

  // console.log( "pool ran out!" )
  return null;
};

// Release an array back into the pool
AgentPool.prototype.add = function( v ) {
  this.__pools.push( v );
};

var agentPool = new AgentPool(1000);
var agentPoolBuffer = [];

//////////////////////////////////////////

//////////////////////////////////////////

function VectorPool (n) {
  this.__pools = [];
  var i = 0;
  while (i < n) {
    this.__pools[i] = { x:0, y:0, z:0 };
    i++;
  }
  // debug('__pools is %o length', this.__pools.length);
}

// Get a new array
VectorPool.prototype.get = function(x, y, z) {
  if ( this.__pools.length > 0 ) {
    var v = this.__pools.pop();
    v.x = x;
    v.y = y;
    v.z = z;
    return v;
  }

  // console.log( "pool ran out!" )
  return null;
};

// Release an array back into the pool
VectorPool.prototype.add = function( v ) {
  this.__pools.push( v );
};

var vectorPool = new VectorPool(10000);

//////////////////////////////////////////
