class GifPlayer {
  #canvas = document.createElement('canvas');
  #ctx = this.#canvas.getContext('2d');
  control = document.createElement('gif-player');
  #controlBar = document.createElement('gif-player-control-bar');
  #playPauseButton = document.createElement('button');
  #repeatButton = document.createElement('button');
  #currentTimeDuration = document.createElement('div');
  #progressBar = document.createElement('input');
  #icons = {
    play: 'M8,5.14V19.14L19,12.14L8,5.14Z',
    pause: 'M14,19H18V5H14M6,19H10V5H6V19Z',
    fullscreen: 'M5,5H10V7H7V10H5V5M14,5H19V10H17V7H14V5M17,14H19V19H14V17H17V14M10,17V19H5V14H7V17H10Z',
    fullscreenExit: 'M14,14H19V16H16V19H14V14M5,14H10V19H8V16H5V14M8,5H10V10H5V8H8V5M19,8V10H14V5H16V8H19Z',
    repeat: 'M17,17H7V14L3,18L7,22V19H19V13H17M7,7H17V10L21,6L17,2V5H5V11H7V7Z',
    repeatOff: 'M2,5.27L3.28,4L20,20.72L18.73,22L15.73,19H7V22L3,18L7,14V17H13.73L7,10.27V11H5V8.27L2,5.27M17,13H19V17.18L17,15.18V13M17,5V2L21,6L17,10V7H8.82L6.82,5H17Z',
  };
  duration = 0;

  #_playing = true;
  set #playing(value) {
    this.#_playing = value;
    if (!this.#_playing) {
      this.control.classList.add('playing');
      this.#playPauseButton.innerHTML = this.#getIcon('play');
    } else {
      this.control.classList.remove('playing');
      this.#playPauseButton.innerHTML = this.#getIcon('pause');
    }
  }
  get playing() {
    return this.#_playing;
  }

  frames = [];

  #_frameIndex = 0;
  set #frameIndex(value) {
    this.#_frameIndex = value;
    // console.error('frameIndex', value);
  }
  get frameIndex() {
    return this.#_frameIndex;
  }

  width = 0;
  height = 0;

  #loop = false;
  set loop(value) {
    this.#loop = value;
    if (!this.#loop) {
      this.#repeatButton.innerHTML = this.#getIcon('repeatOff');
    } else {
      this.#repeatButton.innerHTML = this.#getIcon('repeat');
    }
  }
  get loop() {
    return this.#loop;
  }

  #timeout;

  constructor(arrayBuffer) {
    if (arrayBuffer) {
      this.load(this.#getFramesByArrayBuffer(arrayBuffer));
    }
  }

  load(frames) {
    this.frames = frames;

    if (this.frames.length === 0) {
      throw new Error('can\'t play image with no frames');
    }

    let currentTime = 0;
    for (const frame of this.frames) {
      frame.currentTime = currentTime;
      currentTime += frame.delay;
    }

    this.duration = currentTime;

    this.width = this.frames[0].canvas.width;
    this.height = this.frames[0].canvas.height;

    this.#renderControl();

    this.renderFrame();
  }

  #getFramesByArrayBuffer(arrayBuffer) {
    const gifuct = new GIF(arrayBuffer);
    const gifuctRaw = gifuct.decompressFrames(true);

    const maxWidth = Math.max(...gifuctRaw.map(r => r.dims.left + r.dims.width));
    const maxHeight = Math.max(...gifuctRaw.map(r => r.dims.top + r.dims.height));

    const tempCanvas = new OffscreenCanvas(0, 0);
    const tempCtx = tempCanvas.getContext('2d');

    tempCanvas.width = maxWidth;
    tempCanvas.height = maxHeight;

    function createCanvas(patch, dims) {
      const imageData = new ImageData(patch, dims.width, dims.height);

      const tempPathCanvas = new OffscreenCanvas(dims.width, dims.height);
      const tempPathCtx = tempPathCanvas.getContext('2d');

      tempPathCtx.putImageData(imageData, 0, 0);
      tempCtx.drawImage(tempPathCanvas, dims.left, dims.top);

      const newCanvas = new OffscreenCanvas(tempCanvas.width, tempCanvas.height);
      const ctx = newCanvas.getContext('2d');

      ctx.drawImage(tempCanvas, 0, 0);

      return newCanvas;
    }

    return gifuctRaw.map((raw) => {
      return {
        canvas: createCanvas(raw.patch, raw.dims),
        disposalType: raw.disposalType,
        delay: raw.delay,
      };
    });
  }

  #getIcon(name) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${this.#icons[name]}" /></svg>`;
  }

  #toHHMMSS(milliseconds) {
    const seconds = milliseconds / 1000;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [
      h,
      m > 9 ? m : (h ? '0' + m : m || '0'),
      s > 9 ? s : '0' + s
    ].filter(Boolean).join(':');
  }

  #renderControl() {
    this.#canvas.width = this.width;
    this.#canvas.height = this.height;
    this.#canvas.addEventListener('click', () => this.#playPause());
    this.control.append(this.#canvas);

    const gradientBottom = document.createElement('div');
    gradientBottom.className = 'gif-player-gradient-bottom';
    gradientBottom.addEventListener('click', () => this.#playPause());
    this.control.append(gradientBottom);

    this.#renderControlBar();
  }

  #renderControlBar() {
    this.control.append(this.#controlBar);

    this.#renderProgressBar();
    if (!this.playing) {
      this.#playPauseButton.innerHTML = this.#getIcon('play');
    } else {
      this.#playPauseButton.innerHTML = this.#getIcon('pause');
    }
    this.#playPauseButton.className = 'gif-player-play-pause-button';
    this.#playPauseButton.addEventListener('click', () => this.#playPause());
    this.#controlBar.append(this.#playPauseButton);

    this.#currentTimeDuration.innerText = this.#toHHMMSS(this.frames[this.frameIndex].currentTime) + ' / ' + this.#toHHMMSS(this.duration);
    this.#controlBar.append(this.#currentTimeDuration);

    if (!this.loop) {
      this.#repeatButton.innerHTML = this.#getIcon('repeatOff');
    } else {
      this.#repeatButton.innerHTML = this.#getIcon('repeat');
    }
    this.#repeatButton.className = 'gif-player-repeat-button';
    this.#repeatButton.addEventListener('click', () => this.loop = !this.loop);
    this.#controlBar.append(this.#repeatButton);

    const fullscreenButton = document.createElement('button');
    fullscreenButton.className = 'gif-player-fullscreen-button';
    fullscreenButton.innerHTML = this.#getIcon('fullscreen');
    fullscreenButton.addEventListener('click', () => {
      if (document.fullscreenElement === this.control) {
        document.exitFullscreen();
      } else {
        this.control.requestFullscreen();
      }
    });
    this.control.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        fullscreenButton.innerHTML = this.#getIcon('fullscreen');
      } else {
        fullscreenButton.innerHTML = this.#getIcon('fullscreenExit');
      }
    });
    this.#controlBar.append(fullscreenButton);
  }

  #renderProgressBar() {
    this.#progressBar.type = 'range';
    this.#progressBar.min = 0;
    this.#progressBar.max = this.frames.length - 1;
    this.#progressBar.value = this.frameIndex;
    this.#progressBar.addEventListener('input', () => {
      if (this.playing) {
        this.pause();
      }
      this.renderFrame(this.#progressBar.valueAsNumber);
    });
    this.#controlBar.append(this.#progressBar);
  }

  #playPause() {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.frameIndex + 1 >= this.frames.length) {
      this.#frameIndex = 0;
    }
    this.#playing = true;
    clearTimeout(this.#timeout);
    this.renderFrame();
  }

  pause() {
    this.#playing = false;
    clearTimeout(this.#timeout);
  }

  #drawPatch(frame) {
    this.#ctx.drawImage(frame.canvas, 0, 0);
  }

  renderFrame(index) {
    if (typeof index === 'number') {
      this.#frameIndex = index;
    }
    const frame = this.frames[this.frameIndex];

    this.#progressBar.value = this.frameIndex;
    this.#progressBar.style.backgroundSize = this.#progressBar.valueAsNumber * 100 / this.#progressBar.max + '% 100%';
    this.#currentTimeDuration.innerText = this.#toHHMMSS(this.frames[this.frameIndex].currentTime) + ' / ' + this.#toHHMMSS(this.duration);

    const start = new Date().getTime();

    if (frame.disposalType === 2) {
      ctx.clearRect(0, 0, c.width, c.height);
    }

    this.#drawPatch(frame);

    const end = new Date().getTime();
    const diff = end - start;

    if (this.playing) {
      this.#timeout = setTimeout(
        () => requestAnimationFrame(() => {
          if (this.frameIndex + 1 >= this.frames.length) {
            if (!this.loop) {
              this.#playing = false;
              return;
            } else {
              this.#frameIndex = 0;
            }
          } else {
            this.#frameIndex = this.frameIndex + 1;
          }
          this.renderFrame();
        }),
        Math.max(0, Math.floor(frame.delay - diff))
      );
    }
  }
}