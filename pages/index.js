import Head from 'next/head';
import { Inter } from '@next/font/google';
import speechToTextUtils from '../utils/transcribe.js';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { BsFillMicFill } from 'react-icons/bs';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import '@uiw/react-textarea-code-editor/dist.css';

const CodeEditor = dynamic(
  () => import('@uiw/react-textarea-code-editor').then((mod) => mod.default),
  { ssr: false }
);

const inter = Inter({ subsets: ['latin'] });

const waveVariant = {
  start: (custom) => ({
    scaleY: [0.5, 1],
    transition: {
      duration: 0.7,
      delay: 0.1 * custom,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatType: 'mirror',
    },
  }),
};

const loadingVariant = {
  start: (custom) => ({
    y: [-3, 3],
    transition: {
      duration: 0.7,
      delay: 0.2 * custom,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatType: 'mirror',
    },
  }),
};

export default function Home() {
  const [socket, setSocket] = useState(null);
  const [interimTranscribedData, setInterimTranscribedData] = useState('');
  const [responseData, setResponseData] = useState([]);
  const [conversation, setConversation] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [name, setName] = useState(null);
  const [lastQst, setLastQst] = useState('');
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState(
    '/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    \n};'
  );

  const [currState, setCurrState] = useState('start');

  const audioRef = useRef(null);

  useEffect(() => {
    const socketInitializer = async () => {
      await fetch('/api/socket');
      if (!socket) {
        setSocket(io());
      } else {
        socket.on('connect', () => {
          console.log('connected');
        });

        socket.on('finalizeSpeech', () => {
          onStop();
        });

        socket.on('loading', () => {
          setLoading(true);
        });

        socket.on('ttsResponse', (data) => {
          setLoading(false);
          setResponseData(data.transcript.split(' '));
          setConversation((oldData) => [
            { speaker: 'bot', text: data.transcript },
            ...oldData,
          ]);

          if (currState === 'bhvrQst' || currState === 'techQst') {
            setLastQst(data.transcript);
          }

          const blob = new Blob([data.audio], { type: 'audio/mpeg' });
          const url = URL.createObjectURL(blob);
          audioRef.current.src = url;
          audioRef.current.play();
        });
      }
    };

    socketInitializer();

    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('finalizeSpeech');
        socket.off('ttsResponse');
      }
    };
  }, [socket, currState]);

  useEffect(() => {
    audioRef.current.onended = () => {
      console.log(currState);
      if (currState === 'welcome3') {
        onStart(false);
      } else if (currState === 'started') {
        setCurrState('bhvrStart');
        socket.emit('bhvrStart');
      } else if (currState === 'bhvrStart') {
        setCurrState('bhvrQst');
        socket.emit('bhvrQst');
      } else if (currState === 'bhvrQst') {
        onStart();
      } else if (currState === 'techStart') {
        setCurrState('techQst');
        socket.emit('techQst');
      } else if (currState === 'techQst') {
        onStart();
      }
    };
  }, [currState, lastQst]);

  function flushInterimData() {
    if (interimTranscribedData !== '') {
      setInterimTranscribedData('');
      setConversation((oldData) => [
        { speaker: 'user', text: interimTranscribedData },
        ...oldData,
      ]);
    }
  }

  function handleDataReceived(data, isFinal) {
    if (isFinal) {
      setInterimTranscribedData('');
      setConversation((oldData) => [
        { speaker: 'user', text: data },
        ...oldData,
      ]);
      if (currState == 'welcome3') {
        setName(data);
        onStop();
      }
    } else {
      setInterimTranscribedData(data);
    }
  }

  const onStart = (withResponse = true) => {
    setIsRecording(true);

    speechToTextUtils.initRecording(
      socket,
      withResponse,
      handleDataReceived,
      (error) => {
        console.error('Error when transcribing', error);
        setIsRecording(false);
        // No further action needed, as stream already closes itself on error
      },
      lastQst
    );
  };

  function onStop() {
    setIsRecording(false);
    flushInterimData(); // A safety net if Google's Speech API doesn't work as expected, i.e. always sends the final result
    speechToTextUtils.stopRecording(socket);
  }

  const exitVariant = {
    hide: {
      opacity: 0,
      transition: {
        duration: 0.2,
        type: 'tween',
        ease: 'easeOut',
        delay: 0.2,
      },
    },
    hide2: {
      opacity: 0,
      transition: {
        duration: 0.2,
        type: 'tween',
        ease: 'easeOut',
        delay: 0.8,
      },
    },
  };

  return (
    <>
      <Head>
        <title>Interview App</title>
        <meta name='description' content='Generated by create next app' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <link rel='icon' href='/favicon.ico' />
      </Head>
      <main
        className={`px-8 pb-8 gap-8 flex justify-center items-center bg-[#E8E6E4] text-black ${inter.className}`}
      >
        {currState != 'techQst' && (
          <button
            className='opacity-0 hover:opacity-100 transition-all duration-300 absolute top-4 left-4 bg-violet-500 text-white font-bold px-4 py-2 rounded-md'
            onClick={() => {
              socket.emit('techStart');
              onStop();
              setCurrState('techStart');
            }}
          >
            Skip To Technical
          </button>
        )}
        {currState === 'start' && (
          <>
            <div className='flex-1 flex justify-end items-center'>
              <div className='max-w-[500px]'>
                <h1 className='text-7xl font-bold text-violet-500 mb-4'>
                  This is Jane
                </h1>
                <p className='text-xl'>
                  She&apos;s a virtual assistant who&apos;s purpose is to help
                  you achieve your career goals. With the power of Artificial
                  Intelligence, Jane can simulate a real-life interview
                  experience, and challenge you to think on your feet while
                  providing valuable feedback and constructive criticism, so you
                  can finally become the Silicon Valley superstar you&apos;ve
                  always dreamed of.
                </p>
                <button
                  className='font-bold text-xl p-3 px-8 rounded-lg bg-violet-500 text-white mt-16'
                  onClick={async () => {
                    await socket.emit('welcome');
                    setCurrState('welcome');
                  }}
                >
                  GET STARTED
                </button>
              </div>
            </div>
            <div className='flex-1 flex justify-start items-center'>
              <Image src='/jane.png' width={600} height={600} alt='Jane' />
            </div>
          </>
        )}
        <AnimatePresence mode='wait'>
          {currState === 'welcome' && responseData.length > 0 && (
            <motion.div
              key='welcome1'
              variants={exitVariant}
              exit='hide'
              className='text-7xl font-light flex justify-center items-center gap-4'
            >
              <motion.div
                className='flex justify-center items-center flex-1'
                layout='position'
                initial={{ opacity: 0, y: 20, x: 180 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                transition={{
                  x: {
                    delay: 1.1,
                    type: 'tween',
                    ease: 'easeOut',
                    duration: 0.2,
                  },
                  type: 'tween',
                  ease: 'easeOut',
                  duration: 0.2,
                  delay: 0.2,
                }}
              >
                {responseData[0]}
              </motion.div>
              <motion.div
                className='flex justify-center items-center flex-1'
                layout='position'
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  type: 'tween',
                  ease: 'easeOut',
                  duration: 0.2,
                  delay: 1.2,
                }}
              >
                {responseData[1]}
              </motion.div>
              <motion.div
                className='flex justify-center items-center flex-1 font-bold text-violet-500'
                layout='position'
                onAnimationComplete={() => setCurrState('welcome2')}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  type: 'tween',
                  ease: 'easeOut',
                  duration: 0.2,
                  delay: 1.4,
                }}
              >
                {responseData[2].slice(0, responseData[2].length - 1)}
                <span className='text-black font-light'>.</span>
              </motion.div>
            </motion.div>
          )}
          {currState === 'welcome2' && (
            <motion.div
              key='welcome2'
              exit='hide2'
              variants={exitVariant}
              className='text-7xl font-light flex justify-center items-center gap-4'
            >
              {responseData
                .slice(3, responseData.length - 3)
                .map((word, index) => (
                  <motion.div
                    className='text-7xl font-light flex justify-center items-center gap-4'
                    key={word}
                  >
                    <motion.div
                      className='flex justify-center items-center flex-1'
                      layout='position'
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onAnimationComplete={() =>
                        word == 'helper!' && setCurrState('welcome3')
                      }
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 20,
                        delay: 0.1 * index,
                      }}
                    >
                      {word}
                    </motion.div>
                  </motion.div>
                ))}
            </motion.div>
          )}
          {currState === 'welcome3' && (
            <motion.div
              key='welcome3'
              exit='hide'
              variants={exitVariant}
              className='text-7xl font-light flex flex-col justify-center items-center gap-10'
            >
              <div className='flex justify-center items-center flex-1 gap-4'>
                {responseData
                  .slice(responseData.length - 3)
                  .map((word, index) => (
                    <motion.div
                      key={word}
                      layout
                      className='flex justify-center items-center flex-1'
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 20,
                        delay: 0.1 * index,
                      }}
                    >
                      {word}
                    </motion.div>
                  ))}
              </div>
              {(isRecording || name != null) && (
                <motion.div
                  layout
                  className='mt-12 flex flex-col justify-center items-center flex-1 gap-8'
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: 'tween',
                    ease: 'easeOut',
                    duration: 0.2,
                    delay: 0.2,
                  }}
                >
                  <BsFillMicFill className='text-violet-500' />
                  <div className='flex flex-col justify-center items-center gap-2'>
                    <input
                      type='text'
                      className='text-3xl font-normal p-2 rounded-lg border-2 border-gray-300 bg-white outline-none text-center w-56'
                      value={name || ''}
                      onChange={(e) => {
                        setName(e.target.value);
                        console.log(conversation);
                        setConversation(
                          conversation.map((item) => {
                            if (item.speaker === 'user') {
                              return {
                                ...item,
                                text: e.target.value,
                              };
                            }
                            return item;
                          })
                        );
                      }}
                    />
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{
                        opacity: name != null ? 1 : 0,
                        y: name != null ? 0 : 20,
                      }}
                      transition={{
                        type: 'tween',
                        ease: 'easeOut',
                        duration: 0.4,
                        delay: 0.1,
                      }}
                      className='text-2xl font-bold p-3 w-full rounded-lg bg-violet-500 text-white'
                      onClick={() => {
                        socket.emit('started', name);
                        setCurrState('started');
                      }}
                    >
                      LET&apos;S GO
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
          {currState === 'techQst' && (
            <motion.div
              key='techQst'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: 'tween',
                ease: 'easeOut',
                duration: 0.2,
                delay: 0.2,
              }}
              className='h-full w-1/2 pt-8'
            >
              <CodeEditor
                value={code}
                language='js'
                placeholder='Please enter JS code.'
                onChange={(evn) => setCode(evn.target.value)}
                padding={15}
                className='h-full w-full bg-black text-white rounded-lg'
                style={{
                  fontSize: 12,
                  fontFamily:
                    'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
                }}
              />
            </motion.div>
          )}
          {!currState.includes('welcome') && currState !== 'start' && (
            <motion.div
              key='chat'
              layout
              className='h-full max-w-[50%] flex-1 flex flex-col flex-col-reverse items-end gap-4 overflow-scroll'
            >
              <motion.div
                className={`${
                  isRecording ? 'bg-violet-300' : 'bg-violet-300/20'
                } p-4 min-h-[4rem] text-white rounded-xl mt-8 w-full relative`}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className='flex justify-center gap-2 items-center p-3 pl-4 rounded-full bg-violet-500 absolute -top-5 right-4'
                  >
                    <div className='flex flex-1 h-6 justify-center items-center gap-1'>
                      {[...new Array(4)].map((_, index) => (
                        <motion.div
                          key={`wave-${index}`}
                          custom={index}
                          variants={waveVariant}
                          animate='start'
                          className='bg-white w-1 h-full rounded-full'
                        />
                      ))}
                    </div>
                    <BsFillMicFill className='text-white text-2xl' />
                  </motion.div>
                )}
                {interimTranscribedData}
              </motion.div>
              {loading && (
                <motion.div
                  key='bot-loading'
                  className='bg-gray-300 p-4 text-black rounded-xl self-start flex justify-center items-center gap-1'
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {[...new Array(3)].map((_, index) => (
                    <motion.div
                      className='w-2 h-2 bg-black rounded-full mr-1'
                      key={`loading-${index}`}
                      variants={loadingVariant}
                      animate='start'
                    />
                  ))}
                </motion.div>
              )}
              {conversation.map((msg, index) => (
                <>
                  {msg.speaker === 'bot' ? (
                    <motion.div
                      key={`bot-${index}`}
                      className='bg-gray-300 p-4 text-black rounded-xl self-start'
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {msg.text}
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`user-${index}`}
                      className='bg-violet-500 p-4 text-white rounded-xl'
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {msg.text}
                    </motion.div>
                  )}
                </>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <audio ref={audioRef} />
    </>
  );
}
