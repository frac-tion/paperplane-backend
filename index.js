const PORT = 3000;
var express   =   require( 'express' );
var multer    =   require( 'multer' );
var exphbs    =   require( 'express-handlebars' );
var cors      =   require('cors');
var exec      =   require('child_process').exec;
var filesize = require('file-size');
var notifications = require( 'freedesktop-notifications' ) ;
//var bodyParser = require('body-parser');

require( 'string.prototype.startswith' );

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

var upload = multer({ storage: storage })
var app = express();
var avahiService = null;

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

app.post( '/upload', upload.single('file'), function( req, res, next ) {
  showNotification({origin: "Somebody", name: req.file.originalname, size: filesize(req.file.size)});
  console.log(req.file);

  return res.status( 200 ).send( req.file );
});

app.listen( PORT, function() {
  console.log( 'Express server listening on port 3000' );
});


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
    console.log( "Action '%s' was clicked!" , action ) ;
  } ) ;

  notif.on( 'close' , function( closedBy ) {
    console.log( "Closed by: '%s'" , closedBy ) ;
  } ) ;

  notif.push() ;

}
