import ss from 'socket.io-stream';

// Stream Audio
let bufferSize = 2048,
  AudioContext,
  context,
  processor,
  input,
  globalStream;

const mediaConstraints = {
  audio: true,
  video: false,
};

let AudioStreamer = {
  /**
   * @param {function} onData Callback to run on data each time it's received
   * @param {function} onError Callback to run on an error if one is emitted.
   */
  initRecording: async (socket, withResponse, onData, onError, question) => {
    socket.emit('startGoogleCloudStream', {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
      },
      interimResults: true,
    });
    AudioContext = window.AudioContext || window.webkitAudioContext;
    context = new AudioContext();
    processor = context.createScriptProcessor(bufferSize, 1, 1);
    processor.connect(context.destination);
    context.resume();

    const handleSuccess = function (stream) {
      globalStream = stream;
      input = context.createMediaStreamSource(stream);
      input.connect(processor);

      processor.onaudioprocess = function (e) {
        microphoneProcess(socket, withResponse, question, e);
      };
    };

    navigator.mediaDevices.getUserMedia(mediaConstraints).then(handleSuccess);

    if (onData) {
      socket.on('speechData', (response) => {
        onData(response.data, response.isFinal);
      });
    }

    socket.on('googleCloudStreamError', (error) => {
      if (onError) {
        onError('error');
      }
      closeAll(socket);
    });

    socket.on('endGoogleCloudStream', () => {
      closeAll(socket);
    });
  },

  stopRecording: function (socket) {
    socket.emit('endGoogleCloudStream');
    closeAll(socket);
  },
};

export default AudioStreamer;

function microphoneProcess(socket, withResponse, question, e) {
  console.log('QUESTION', question);
  const left = e.inputBuffer.getChannelData(0);
  const left16 = convertFloat32ToInt16(left);
  socket.emit('audio', { withResponse, data: left16, question });
}

function convertFloat32ToInt16(buffer) {
  let l = buffer.length;
  let buf = new Int16Array(l / 3);

  while (l--) {
    if (l % 3 === 0) {
      buf[l / 3] = buffer[l] * 0xffff;
    }
  }
  return buf.buffer;
}

/**
 * Stops recording and closes everything down. Runs on error or on stop.
 */
function closeAll(socket) {
  // Clear the listeners (prevents issue if opening and closing repeatedly)
  socket.off('speechData');
  socket.off('googleCloudStreamError');
  let tracks = globalStream ? globalStream.getTracks() : null;
  let track = tracks ? tracks[0] : null;
  if (track) {
    track.stop();
  }

  if (processor) {
    if (input) {
      try {
        input.disconnect(processor);
      } catch (error) {
        console.warn('Attempt to disconnect input failed.');
      }
    }
    processor.disconnect(context.destination);
  }
  if (context) {
    context.close().then(function () {
      input = null;
      processor = null;
      context = null;
      AudioContext = null;
    });
  }
}
