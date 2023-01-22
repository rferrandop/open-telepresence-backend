var localVideo;
var localStream;
var peerConnection;
var uuid;
var serverConnection;
var videos;

var peerConnectionConfig = {
  'iceServers': [
    {'urls': 'stun:stun.stunprotocol.org:3478'},
    {'urls': 'stun:stun.l.google.com:19302'},
  ]
};
const GROUP = 'testgroup';

// msg is a dict
function send(serverConnection, msg) {
  msg['headers'] = {}
  msg['headers']['stream-group'] = GROUP; // group header
  serverConnection.send(JSON.stringify(msg));
}

function pageReady() {
  uuid = createUUID();

  localVideo = document.getElementById('localVideo');
  videos = document.querySelector('.videos');
  console.log(videos);

  serverConnection = new WebSocket('ws://localhost:9999/signal');
  serverConnection.onmessage = gotMessageFromServer;

  var constraints = {
    video: true,
    audio: true,
  };

  if(navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);
  } else {
    alert('Your browser does not support getUserMedia API');
  }
}

function getUserMediaSuccess(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
}

function start(isCaller) {
  peerConnection = new RTCPeerConnection(peerConnectionConfig);
  peerConnection.onicecandidate = gotIceCandidate;
  peerConnection.ontrack = gotRemoteStream;

  peerConnection.onnegotiationneeded = async () => {
    console.log('negotiation needed');
    peerConnection.createOffer().then(createdDescription).catch(errorHandler);
  }
  peerConnection.addStream(localStream);

  // if(isCaller) {
    // peerConnection.createOffer().then(createdDescription).catch(errorHandler);
  // }
}

function gotMessageFromServer(message) {
  if(!peerConnection) start(false);

  var signal = JSON.parse(message.data);

  // Ignore messages from ourself
  if(signal.uuid == uuid) return;

  console.log("Got message from server ", signal);
  if(signal.sdp) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function() {
      // Only create answers in response to offers
      if(signal.sdp.type == 'offer') {
        peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
      }
    }).catch(errorHandler);
  } else if(signal.ice) {
    peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
  }
}

function gotIceCandidate(event) {
  if(event.candidate != null) {
    send(serverConnection, {'ice': event.candidate, 'uuid': uuid});
  }
}

function createdDescription(description) {
  console.log('got description', description);

  peerConnection.setLocalDescription(description).then(function() {
    send(serverConnection, {'sdp': peerConnection.localDescription, 'uuid': uuid});
  }).catch(errorHandler);
}

let tracks = {'n': 0};
function gotRemoteStream(event) {
  console.log('got remote stream');
  let video;  let id = event.streams[0].id;
  if(!tracks[id]) {
    video = document.createElement('video');

    video.setAttribute("id", id);
    video.setAttribute("autoplay", true);
    videos.appendChild(video);
    console.log(event);
    tracks[id] = video;
    
  } else {
    video = tracks[id];
  }
  video.srcObject = event.streams[0];
}

function errorHandler(error) {
  console.log(error);
}

// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}


