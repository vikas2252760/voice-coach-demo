// Voice recording and playback service for Voice Coach

class VoiceService {
  constructor(websocketService = null) {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.callbacks = new Map();
    this.websocketService = websocketService;
    
    // Speech Recognition
    this.speechRecognition = null;
    this.isRecognizing = false;
    this.transcribedText = '';
    this.interimText = '';
  }

  // Initialize audio context and get microphone permission
  async initialize() {
    try {
      // Get user media
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      // Setup audio context for real-time analysis
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      
      this.analyser.fftSize = 256;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
      source.connect(this.analyser);

      // Setup MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType()
      });

      this.setupRecorderEvents();
      
      // Initialize speech recognition
      this.initializeSpeechRecognition();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize voice service:', error);
      throw new Error('Microphone access denied or not available');
    }
  }

  // Initialize speech recognition
  initializeSpeechRecognition() {
    try {
      // Check for browser support
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.warn('Speech recognition not supported in this browser');
        return false;
      }

      this.speechRecognition = new SpeechRecognition();
      
      // Configure speech recognition
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = 'en-US';
      this.speechRecognition.maxAlternatives = 1;

      // Setup event listeners
      this.speechRecognition.onstart = () => {
        console.log('Speech recognition started');
        this.isRecognizing = true;
        this.transcribedText = '';
        this.interimText = '';
        this.emit('speechRecognitionStarted');
      };

      this.speechRecognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Update stored text
        if (finalTranscript) {
          this.transcribedText += finalTranscript;
        }
        this.interimText = interimTranscript;

        // Emit events for real-time updates
        this.emit('speechRecognitionResult', {
          final: this.transcribedText,
          interim: this.interimText,
          combined: this.transcribedText + this.interimText
        });
      };

      this.speechRecognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.emit('speechRecognitionError', event.error);
      };

      this.speechRecognition.onend = () => {
        console.log('Speech recognition ended');
        this.isRecognizing = false;
        
        this.emit('speechRecognitionEnded', {
          finalText: this.transcribedText,
          success: this.transcribedText.length > 0,
          transcript: this.transcribedText.trim() || "User provided voice input for coaching analysis"
        });
      };

      return true;
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      return false;
    }
  }

  // Get supported MIME type for recording
  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/wav',
      'audio/mp4',
      'audio/webm'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return '';
  }

  // Setup MediaRecorder event listeners
  setupRecorderEvents() {
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const audioBlob = new Blob(this.audioChunks, { 
        type: this.mediaRecorder.mimeType 
      });
      this.audioChunks = [];
      this.emit('recordingComplete', audioBlob);
    };

    this.mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error);
      this.emit('error', error);
    };
  }

  // Start recording
  async startRecording() {
    if (!this.mediaRecorder) {
      await this.initialize();
    }

    if (this.mediaRecorder.state === 'inactive') {
      this.audioChunks = [];
      // Reset transcription for new recording
      this.transcribedText = '';
      this.interimText = '';
      
      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      this.startVolumeAnalysis();
      
      // Start speech recognition
      if (this.speechRecognition && !this.isRecognizing) {
        try {
          this.speechRecognition.start();
        } catch (error) {
          console.warn('Could not start speech recognition:', error);
        }
      }
      
      this.emit('recordingStarted');
    }
  }

  // Stop recording
  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.stopVolumeAnalysis();
      
      // Stop speech recognition
      if (this.speechRecognition && this.isRecognizing) {
        try {
          this.speechRecognition.stop();
        } catch (error) {
          console.warn('Could not stop speech recognition:', error);
        }
      }
      
      this.emit('recordingStopped');
    }
  }

  // Start real-time volume analysis
  startVolumeAnalysis() {
    if (!this.analyser) return;

    const analyzeVolume = () => {
      if (!this.isRecording) return;

      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const averageVolume = sum / this.dataArray.length;
      const normalizedVolume = averageVolume / 255;

      this.emit('volumeLevel', normalizedVolume);
      
      requestAnimationFrame(analyzeVolume);
    };

    analyzeVolume();
  }

  // Stop volume analysis
  stopVolumeAnalysis() {
    // Analysis stops when isRecording becomes false
  }

  // Play audio from blob or URL
  async playAudio(audioSource) {
    try {
      const audio = new Audio();
      
      if (audioSource instanceof Blob) {
        audio.src = URL.createObjectURL(audioSource);
      } else if (typeof audioSource === 'string') {
        audio.src = audioSource;
      } else {
        throw new Error('Invalid audio source');
      }

      audio.onloadeddata = () => {
        this.emit('audioReady', audio.duration);
      };

      audio.onplay = () => {
        this.emit('audioStarted');
      };

      audio.onended = () => {
        this.emit('audioEnded');
        if (audioSource instanceof Blob) {
          URL.revokeObjectURL(audio.src);
        }
      };

      audio.onerror = (error) => {
        this.emit('audioError', error);
      };

      await audio.play();
      return audio;
    } catch (error) {
      console.error('Failed to play audio:', error);
      this.emit('audioError', error);
      throw error;
    }
  }

  // Convert audio blob to base64 for transmission
  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Text-to-speech for AI responses
  async speakText(text, options = {}) {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice options
    utterance.rate = options.rate || 0.9;
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 0.8;
    
    // Select voice (prefer female voices for coaching)
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
    ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => this.emit('speechStarted');
    utterance.onend = () => this.emit('speechEnded');
    utterance.onerror = (error) => this.emit('speechError', error);

    speechSynthesis.speak(utterance);
    return utterance;
  }

  // Stop current speech synthesis
  stopSpeaking() {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      this.emit('speechStopped');
    }
  }

  // Get transcribed text
  getTranscribedText() {
    return {
      final: this.transcribedText,
      interim: this.interimText,
      combined: this.transcribedText + this.interimText,
      hasText: this.transcribedText.length > 0
    };
  }

  // Get recording statistics
  getRecordingStats() {
    return {
      isRecording: this.isRecording,
      hasPermission: !!this.stream,
      isInitialized: !!this.mediaRecorder,
      supportedMimeType: this.getSupportedMimeType(),
      speechRecognitionSupported: !!this.speechRecognition,
      isRecognizing: this.isRecognizing,
      transcribedLength: this.transcribedText.length
    };
  }

  // Event listener management
  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  off(event, callback) {
    if (this.callbacks.has(event)) {
      const callbacks = this.callbacks.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }

  // Cleanup resources
  cleanup() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    if (this.speechRecognition && this.isRecognizing) {
      try {
        this.speechRecognition.stop();
      } catch (error) {
        console.warn('Error stopping speech recognition during cleanup:', error);
      }
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Reset speech recognition state
    this.speechRecognition = null;
    this.isRecognizing = false;
    this.transcribedText = '';
    this.interimText = '';

    this.callbacks.clear();
    speechSynthesis.cancel();
  }
}

// Singleton instance
const voiceService = new VoiceService();

export default voiceService;
