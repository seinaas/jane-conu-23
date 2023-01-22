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

class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const channelData = inputs[0][0];
    if (channelData?.length) {
      const left16 = convertFloat32ToInt16(channelData);
      outputs[0];
      console.log(outputs);
    }
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
