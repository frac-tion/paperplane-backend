const PORT = 3000;
var express   =   require( 'express' );
var multer    =   require( 'multer' );
var exphbs    =   require( 'express-handlebars' );
var cors      =   require('cors');
var exec      =   require('child_process').exec;
var filesize = require('file-size');
var notifications = require( 'freedesktop-notifications' ) ;
var path = require('path');
var os = require('os');
//var bodyParser = require('body-parser');

require( 'string.prototype.startswith' );


var upload = createStorage();

function createStorage(dir) {
  if (dir === "" || dir == undefined)
    dir = path.join(os.homedir(), "Downloads");

  currentDir = dir;
  var storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, dir)
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname)
    }
  })
  return multer({ storage: storage })
}

var app = express();
var avahiService = null;
var deviceName = os.hostname();

app.use(cors());
//app.use(bodyParser.json({limit: '1mb'}));
app.use(express.static(__dirname + '/paperplane-frontend'));

app.get( '/peers', function( req, res, next ){
  getPeers(function (services) {
    return res.json(services);
  });
});

app.get( '/enable', function( req, res, next ){
  publishService(function (msg) {
    return res.json(msg);
  });
});

app.get( '/disable', function( req, res, next ){
  hideService(function (msg) {
    return res.json(msg);
  });
});

// Usage: host/set?dir=/home/user/Downloads
// dir can also be ~/Downloads
// if dir is not set this query will response with the current dir
// Response: {status: "status msg", dir: "currentdir"}
app.get( '/setDir', function( req, res, next ){
  setStorageDir(req.query.dir, function (msg) {
    return res.json(msg);
  });
});


// Usage: host/changeName?name=Jeff's Laptop
// if name is not set this query will response with the current name
// Response: {status: "status msg", name: "currentName"}
app.get( '/setName', function( req, res, next ){
  setName(req.query.name, function (msg) {
    return res.json(msg);
  });
});


// Usage: host/getIp
// Response: {status: "status msg", ip: {deviceName: "0.0.0.0", secoundDevice: "1.2.3.4"}}
app.get( '/getIp', function( req, res, next ){
  getIpAdresses(function (msg) {
    return res.json(msg);
  });
});


app.post( '/upload', upload.single('file'), function( req, res, next ) {
  showNotification({origin: "Somebody", name: req.file.originalname, size: filesize(req.file.size)});
  console.log(req.file);

  return res.status( 200 ).send( req.file );
});

app.listen( PORT, function() {
  console.log( 'Express server listening on port 3000' );
});

function setStorageDir(dir, cb) {
  //get the home dir
  //os.homedir();

  if (dir === "" || dir === undefined) {
    cb({"status": "", "dir" : currentDir}); 
  }
  else if (path.isAbsolute(dir) || dir.startsWith('~')) {
    if (dir.startsWith('~')) {
      dir = path.join(os.homedir(), dir.substr(1, dir.length));
    }
    upload = createStorage(dir);
    if (cb)
      cb({"status": "changed", "dir" : dir});
  } 
  else if (cb)
    cb({"status": "The path has to be absolute."});
}

function setName(name, cb) {
  if (name === "" || name === undefined) {
    cb({"status": "", "name" : deviceName}); 
  }
  else {
    deviceName = name;
    if (cb)
      cb({"status": "changed", "name" : name});
  } 
  //else if (cb)
  //  cb({"status": "Not a valid device name."});
}

function getPeers(cb) {
  var avahiBrowse = 'avahi-browse -lrpt _http._tcp'
  var services = [];
  var child = exec(avahiBrowse, function (error, stdout, stderr) {
    var lines = stdout.split("\n");
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].includes("=") && lines[i].includes("IPv4") && lines[i].includes("paperplane")) {
        var info = lines[i].split(";");
        var obj = {};
        obj.name = info[6];
        obj.ip = info[7];
        obj.port = info[8];
        obj.msg = info[9];
        services.push(obj)
      }
    }

    if (error !== null) {
      console.log('exec error: ' + error); 
      console.log('stderr: ' + stderr);
    } 

    if (cb !== null)
      cb(services);
  }); 
}

publishService(function msg(){});
function publishService(cb) {
  //shell comand: avahi-publish -s paperplane _http._tcp 3000 "Download this files"
  if (avahiService !== null) {
    avahiService.kill('SIGTERM');
    avahiService = null;
  }
  var avahiPublish = "avahi-publish -s paperplane _http._tcp " + PORT + "  'Download this files'"
  avahiService = exec(avahiPublish, function (error, stdout, stderr) {
    console.log(stdout);
    if (error !== null) {
      console.log('exec error: ' + error); 
      console.log('stderr: ' + stderr);
    } 
  });
  cb({"status": "enabled"});
}

function hideService(cb) {
  if (avahiService !== null) {
    avahiService.kill('SIGTERM');
    avahiService = null;
  }
  cb({"status": "disabled"});
}

function showNotification(file) {
  var notif = notifications.createNotification( {
    summary: 'Incoming file' ,
    body: file.origin + ' is sending you the file ' + file.name + " (" + file.size.human('si') + ")" ,
    icon: __dirname + '/log.png' ,
    "sound-file": __dirname + '/hiss.wav' ,
    actions: {
      default: '' ,
        cancel: 'Cancel' ,
        accept: 'Accept'
    }
  } ) ;

  notif.on( 'action' , function( action ) {
    console.log("Action '%s' was clicked!" , action) ;
    switch (action) {
      case 'Cancel' : console.log("Should remove file");
                  break;
      case 'Accept' : console.log("Should do nothing");
                  break;
    }
  } ) ;

  notif.on( 'close' , function( closedBy ) {
    console.log( "Closed by: '%s'" , closedBy ) ;
  } ) ;

  notif.push() ;

}

function getIpAdresses(cb) {
  var ifaces = os.networkInterfaces();
  var addresses = {};

  Object.keys(ifaces).forEach(function (ifname) {
    var alias = 0;

    ifaces[ifname].forEach(function (iface) {
      if ('IPv4' !== iface.family || iface.internal !== false) {
        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        return;
        }

        if (alias >= 1) {
          // this single interface has multiple ipv4 addresses
          addresses[ifname + ':' + alias] = iface.address;
        } else {
          // this interface has only one ipv4 adress
          addresses[ifname] = iface.address;
        }
        alias++;
    });
  });
  cb({"status": "", 'ip' : addresses});
}
