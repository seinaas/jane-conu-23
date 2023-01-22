import { Server } from 'socket.io';
import speech from '@google-cloud/speech';
import textToSpeech from '@google-cloud/text-to-speech';
import { ChatGPTAPIBrowser } from 'chatgpt';
import questions from '../../utils/questions.json';
import { randomInt } from 'crypto';

const api = new ChatGPTAPIBrowser({
  email: process.env.OPEN_AI_EMAIL,
  password: process.env.OPEN_AI_PW,
  minimize: true,
});

const ttsClient = new textToSpeech.TextToSpeechClient();
const ttsConfig = {
  voice: {
    languageCode: 'en-GB',
    name: 'en-GB-Neural2-A',
    ssmlGender: 'FEMALE',
  },
  audioConfig: {
    audioEncoding: 'MP3',
  },
};

let client = null;
let recognizeStream = null;
let config;
let speechTimeout;
const speechTimeoutDuration = 2000;
let currentSpeech = '';
let followUp = {};

const welcome = (socket) => {
  api
    .sendMessage(
      'From this point forward, I want you to act as a mentor offering advice, guidance, and constructive criticism while I am looking for employment in the tech industry based on the answers I provide to various interviewing questions. Given a question and my answer, I want you to highlight my strengths and comment on areas that need improvement. Keep in mind important concepts such as SMART. I want you to speak to me as if we were running a mock interview and you were the interviewer. Be genuine and conversational in your responses. Your responses must be at most 4 sentences long. Do you understand?',
      followUp
    )
    .then((res) => {
      followUp.conversationId = res.conversationId;
      followUp.parentMessageId = res.messageId;
    });
  const welcomeMsg =
    "Hi! I'm Jane. I'll be your new interview helper! What's your name?";
  const ttsRequest = {
    input: {
      text: welcomeMsg,
    },
    ...ttsConfig,
  };

  ttsClient.synthesizeSpeech(ttsRequest, (err, response) => {
    if (err) {
      console.error('ERROR:', err);
      return;
    }

    socket.emit('ttsResponse', {
      audio: response.audioContent,
      transcript: welcomeMsg,
    });
  });
};

const started = async (socket, name) => {
  const startedMsg = `Great! Hi, ${name}! Let's get started with some behavioral questions.`;
  const ttsRequest = {
    input: {
      text: startedMsg,
    },
    ...ttsConfig,
  };
  ttsClient.synthesizeSpeech(ttsRequest, (err, response) => {
    if (err) {
      console.error('ERROR:', err);
      return;
    }

    socket.emit('ttsResponse', {
      audio: response.audioContent,
      transcript: startedMsg,
    });
  });
};

const bhvrQstStart = (socket) => {
  const firstQstMsg = "Here's the first one:";
  const ttsRequest = {
    input: {
      text: firstQstMsg,
    },
    ...ttsConfig,
  };
  ttsClient.synthesizeSpeech(ttsRequest, (err, response) => {
    if (err) {
      console.error('ERROR:', err);
      return;
    }

    socket.emit('ttsResponse', {
      audio: response.audioContent,
      transcript: firstQstMsg,
    });
  });
};

const bhvrQst = (socket) => {
  const qstMsg =
    questions.behavioral[randomInt(questions.behavioral.length - 1)];
  const ttsRequest = {
    input: {
      text: qstMsg,
    },
    ...ttsConfig,
  };
  ttsClient.synthesizeSpeech(ttsRequest, (err, response) => {
    if (err) {
      console.error('ERROR:', err);
      return;
    }

    socket.emit('ttsResponse', {
      audio: response.audioContent,
      transcript: qstMsg,
    });
  });
};

const techQstStart = (socket) => {
  const techQstMsg = 'Now, let me ask you some technical questions:';
  const ttsRequest = {
    input: {
      text: techQstMsg,
    },
    ...ttsConfig,
  };

  ttsClient.synthesizeSpeech(ttsRequest, (err, response) => {
    if (err) {
      console.error('ERROR:', err);
      return;
    }

    socket.emit('ttsResponse', {
      audio: response.audioContent,
      transcript: techQstMsg,
    });
  });
};

const techQst = (socket) => {
  const qstMsg = questions.technical[0];
  const ttsRequest = {
    input: {
      text: qstMsg,
    },
    ...ttsConfig,
  };
  ttsClient.synthesizeSpeech(ttsRequest, (err, response) => {
    if (err) {
      console.error('ERROR:', err);
      return;
    }

    socket.emit('ttsResponse', {
      audio: response.audioContent,
      transcript: qstMsg,
    });
  });
};

const analyzeCode = (socket, question, code) => {
  socket.emit('loading');

  api
    .sendMessage(`Question: ${question}\nAnswer:\n${code}`, followUp)
    .then((res) => {
      followUp.conversationId = res.conversationId;
      followUp.parentMessageId = res.messageId;

      const ttsRequest = {
        input: { text: res.response },
        ...ttsConfig,
      };

      ttsClient.synthesizeSpeech(ttsRequest, (err, response) => {
        if (err) {
          console.error('ERROR:', err);
          return;
        }

        socket.emit('ttsResponse', {
          audio: response.audioContent,
          transcript: res.response,
        });
      });
    });
};

const SocketHandler = (req, res) => {
  if (res.socket.server.io) {
    console.log('Socket is already running');
  } else {
    console.log('Socket is initializing');
    (async () => {
      await api.initSession();
    })();
    const io = new Server(res.socket.server);
    res.socket.server.io = io;

    io.on('connection', (socket) => {
      socket.on('welcome', () => welcome(socket));
      socket.on('startGoogleCloudStream', (conf) => {
        if (!client) {
          client = new speech.SpeechClient();
        }

        config = conf;
      });
      socket.on('endGoogleCloudStream', () => {
        if (recognizeStream) {
          recognizeStream.end();
        }
      });
      socket.on('started', (name) => started(socket, name));
      socket.on('bhvrStart', () => bhvrQstStart(socket));
      socket.on('bhvrQst', () => bhvrQst(socket));
      socket.on('techStart', () => techQstStart(socket));
      socket.on('techQst', () => techQst(socket));
      socket.on('analyzeCode', (question, code) =>
        analyzeCode(socket, question, code)
      );
      socket.on('audio', async ({ withResponse, data, question }) => {
        if (!recognizeStream) {
          recognizeStream = client
            .streamingRecognize(config)
            .on('error', (error) => {
              console.log(error);
            })
            .on('data', (data) => {
              currentSpeech = data.results[0].alternatives[0].transcript;
              clearTimeout(speechTimeout);
              speechTimeout = setTimeout(() => {
                if (recognizeStream) {
                  recognizeStream.end();
                  recognizeStream = null;
                }
                socket.emit('finalizeSpeech');

                if (question) {
                  let temp = currentSpeech;
                  currentSpeech = `Question: ${question}\nAnswer: ${temp}`;
                }

                if (withResponse) {
                  socket.emit('loading');
                  api.sendMessage(currentSpeech, followUp).then((res) => {
                    followUp.conversationId = res.conversationId;
                    followUp.parentMessageId = res.messageId;

                    const ttsRequest = {
                      input: { text: res.response },
                      ...ttsConfig,
                    };

                    ttsClient.synthesizeSpeech(ttsRequest, (err, response) => {
                      if (err) {
                        console.error('ERROR:', err);
                        return;
                      }

                      socket.emit('ttsResponse', {
                        audio: response.audioContent,
                        transcript: res.response,
                      });
                    });
                  });
                }

                currentSpeech = '';
              }, speechTimeoutDuration);
              socket.emit('speechData', {
                data: data.results[0].alternatives[0].transcript,
                isFinal: data.results[0].isFinal,
              });
            });
        }
        recognizeStream.write(data);
      });
    });
  }
  res.end();
};

export default SocketHandler;
