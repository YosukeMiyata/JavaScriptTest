
const Synthesizer = class {
  static createAudioContext = () => {
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      return new AudioContext();
    }
    catch(e) {
      alert('Web Audio API is not supported in this browser');
    }
  };
  constructor() {
    const audioContextInstance = Synthesizer.createAudioContext();
    const volumeslider = document.getElementById('volume') || {};
    volumeslider.min = 0;
    volumeslider.max = 0.3;
    volumeslider.step = 0.005;
    volumeslider.value = 0.03;
    const waveselect = document.getElementById('waveselect') || {value: 'sawtooth'};
    const noteToFreq = midiNoteNumber => 440 * Math.pow(2, (midiNoteNumber - 69)/12);
    const freqs = Array(128).fill().map((_,midiNoteNumber) => noteToFreq(midiNoteNumber));
    this.createVoice = midiNoteNumber => {
      const osc = audioContextInstance.createOscillator();
      const amp = audioContextInstance.createGain();
      //
      // for legacy browsers
      osc.start = osc.start || osc.noteOn;
      osc.stop  = osc.stop  || osc.noteOff;
      //
      osc.type = waveselect.value;
      osc.frequency.value = freqs[midiNoteNumber] || noteToFreq(midiNoteNumber);
      osc.connect(amp);
      //
      // for legacy browsers
      amp.gain.setTargetAtTime = amp.gain.setTargetAtTime || amp.gain.setTargetValueAtTime;
      //
      amp.connect(audioContextInstance.destination);
      return {
        start: () => {
          amp.gain.value = volumeslider.value;
          const now = audioContextInstance.currentTime;
          amp.gain.setTargetAtTime(0, now, 0.6);
          osc.start(now);
        },
        stop: () => {
          const now = audioContextInstance.currentTime;
          amp.gain.setTargetAtTime(0, now, 0.1);
          osc.stop(now + 0.2);
        }
      };
    };
  }
};

const PianoKeyboard = class {
  constructor() {
    const keycode2note = {
      KeyQ:0, Digit2:1,
      KeyW:2, Digit3:3,
      KeyE:4,
      KeyR:5, Digit5:6,
      KeyT:7, Digit6:8,
      KeyY:9, Digit7:10,
      KeyU:11,
      KeyI:12, Digit9:13,
      KeyO:14, Digit0:15,
      KeyP:16,
      BracketLeft:17, Equal:18,
      BracketRight:19,
    };
    const synth = new Synthesizer();
    this.keys = Array(128).fill().map(() => ({element: null, voice: null}));
    this.activeKeys = [];
    this.chordsymbol = document.getElementById('chord');
    this.default_chordsymbol = this.chordsymbol?.innerHTML;
    const clearChordSymbol = () => {
      if( this.chordsymbol ) this.chordsymbol.innerHTML = this.default_chordsymbol;
    };
    const keyboard = document.getElementById('pianokeyboard');
    if( keyboard ) {
      const getWidthOf = element => {
        const r = element.getBoundingClientRect();
        return r.right - r.left;
      };
      keyboard.innerHTML = '';
      let blackindex = 6, whiteindex = 0, whitewidth, blackoffsets, scrollleft = 0;
      this.keys.forEach((key, midiNoteNumber) => {
        keyboard.appendChild(key.element = document.createElement('div'));
        let left;
        if( blackindex >= 5 ) {
          key.element.classList.add('whitekey');
          if( ! whitewidth ) whitewidth = getWidthOf(key.element);
          left = whitewidth * whiteindex++;
          blackindex -= 5;
        } else {
          key.element.classList.add('blackkey');
          if( ! blackoffsets ) blackoffsets = Array(5).fill(getWidthOf(key.element))
            .map( (w,i) => i>1 ? w/i : w - w/(4-i) );
          left = whitewidth * whiteindex - blackoffsets[blackindex];
          blackindex += 7;
        }
        key.element.style.left = left + 'px';
        if( midiNoteNumber == 47 ) scrollleft = whitewidth * whiteindex;
        key.element.addEventListener("mousedown", e => { clearChordSymbol(); this.activate(midiNoteNumber); }, false);
        key.element.addEventListener("mouseup", e => this.deactivate(key), false);
        key.element.addEventListener("mouseover", e => { if( e.buttons & 1 ) this.activate(midiNoteNumber); }, false);
        key.element.addEventListener("mouseout", e => { if( e.buttons & 1 ) this.deactivate(key); }, false);
      });
      keyboard.scrollLeft = scrollleft;
      this.markedElements = [];
      keyboard.addEventListener("keydown", e => {
        if( e.repeat ) return;
        const midiNoteNumber = keycode2note[e.code]+60;
        if( this.keys[midiNoteNumber]?.voice ) return;
        clearChordSymbol();
        this.activate(midiNoteNumber);
      }, false);
      keyboard.addEventListener("keyup", e => {
        const midiNoteNumber = keycode2note[e.code]+60;
        const key = this.keys[midiNoteNumber];
        if( key ) this.deactivate(key);
      }, false);
    }
    this.deactivate = key => {
      const activeindex = this.activeKeys.indexOf(key);
      if( activeindex >= 0 ) this.activeKeys.splice(activeindex, 1);
      if( key.element ) key.element.classList.remove('pressed');
      if( key.voice ) { key.voice.stop(); key.voice = null; }
    };
    this.activate = midiNoteNumber => {
      while( this.markedElements.length > 0 ) {
        this.markedElements.pop().classList.remove('released');
      }
      if( midiNoteNumber || midiNoteNumber === 0 ) {
        const key = this.keys[midiNoteNumber];
        if( key ) {
          if( ! key.voice ) {
            (key.voice = synth.createVoice(midiNoteNumber)).start();
            this.activeKeys.push(key);
          }
          if( key.element ) key.element.classList.add('pressed');
        }
      }
    };
    this.deactivateChord = () => {
      while( this.activeKeys.length > 0 ) {
        const key = this.activeKeys.pop();
        this.deactivate(key);
        key.element.classList.add('released');
        this.markedElements.push(key.element);        
      }
    };
    this.activateChord = midiNoteNumbers => {
      this.deactivateChord();
      midiNoteNumbers.forEach(this.activate);
    };
  }
}

const CircleOfFifthsClock = class {
  static bounds = {min: 0.14, maj: 0.3, sus4: 0.43, max: 0.5};
  constructor(clockCanvas) {
    this.clockCanvas = clockCanvas || document.getElementById("circleOfFifthsClockCanvas");
    const [width, height] = [this.clockCanvas.width, this.clockCanvas.height];
    const center = this.center = {x : width/2, y : height/2};
    this.toDirection = angle => ({
      x:  width  * Math.sin(angle),
      y: -height * Math.cos(angle),
    });
    this.toPosition = (distance, direction) => ({
      x: center.x + distance * direction.x,
      y: center.y + distance * direction.y,
    });
    this.emptyKeySignatureLabel = 'Key';
    window.addEventListener("load", ()=>setInterval(()=>{this.drawDial();this.drawHands();}, 1000), false);
  }
  drawDial = () => {
    const canvas = this.clockCanvas;
    const [context, width, height] = [canvas.getContext("2d"), canvas.width, canvas.height];
    const boundsArray = Object.values(CircleOfFifthsClock.bounds);
    ['#FFFFFF','#99CCFF','#FB99CC','#FFFF99'].forEach(
      (color, index) => {
        context.fillStyle = color;
        context.beginPath();
        boundsArray.slice(index > 0 ? index-1 : 0, index+1).forEach((bound, index) => {
          const antiClockWise = index & 1;
          const [x,y] = [this.center.x, this.center.y];
          (width == height)?
          context.arc(    x, y, bound * width,                    0, 2*Math.PI, antiClockWise):
          context.ellipse(x, y, bound * width, bound * height, 0, 0, 2*Math.PI, antiClockWise);
        });
        context.fill();
      }
    );
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#000000";
    const keySymbols = {
      minor:['D','b','m'],
      major:['F','b'],
      fifthOf: note => String.fromCharCode(note.charCodeAt(0) + (note >= 'D' ? -3 : 4)),
      keySignatureOf: hour => {
        if( ! hour ) return this.emptyKeySignatureLabel;
        const [sfCount, sfChar] = [Math.abs(hour), hour < 0 ? 'b':'#'];
        switch(sfCount) {
          case 1: return sfChar;
          case 2: return sfChar + sfChar;
          default: return sfCount + sfChar;
        }
      }
    };
    const labelDistances = {
      minor:{outer:0.23, inner:0.17},
      major:{outer:0.38, inner:0.32},
      keySignature:0.465
    };
    const font = {
      tiny:  'normal 11px san-serif',
      small: 'normal 14px san-serif',
      large: 'normal 21px san-serif',
    };
    const RADIAN_PER_HOUR = Math.PI/6;
    for (let hour = -7; hour <= 7; hour++) {
      const direction = this.toDirection(hour * RADIAN_PER_HOUR);
      let innerOrOuter;
      if( hour < -5 || hour > 6 ) {
        innerOrOuter = 'inner';
        context.font = font.small;
      } else {
        const keySignatures = [keySymbols.keySignatureOf(hour)];
        if( hour == -5 ) {
          keySignatures.push(keySymbols.keySignatureOf(hour+12));
        } else if( hour >= 5 ) {
          keySignatures.push(keySymbols.keySignatureOf(hour-12));
        }
        context.font = font.tiny;
        const position = this.toPosition( labelDistances.keySignature, direction );
        context.fillText( keySignatures.join('/'), position.x, position.y );
        innerOrOuter = 'outer';
        context.font = (hour == 6) ? font.small : font.large;
      }
      ['minor','major'].forEach(mm => {
        const tp = keySymbols[mm];
        if( (tp[0] = keySymbols.fifthOf(tp[0])) == 'F' ) tp[1] = (tp[1] == '') ? '#' : '';
        const position = this.toPosition( labelDistances[mm][innerOrOuter], direction );
        context.fillText( tp.join(''), position.x, position.y );
      });
    }
  };
  drawHands = () => {
    const context = this.clockCanvas.getContext("2d");
    const drawHand = (width, length, direction) => {
      const destination = this.toPosition(length, direction);
      context.lineWidth = width;
      context.beginPath();
      context.moveTo( this.center.x, this.center.y );
      context.lineTo( destination.x, destination.y );
      context.stroke();
    };
    context.fillStyle = "#000000";
    context.strokeStyle = "rgba(0, 0, 0, 0.5)";
    const handsAt = time => {
      const RADIAN_PER_HOUR = Math.PI/6;
      const RADIAN_PER_MIN_OR_SEC = Math.PI/30;
      const [hh,mm,ss] = [time.getHours(), time.getMinutes(), time.getSeconds()];
      return [
        {angle: (hh + mm/60) * RADIAN_PER_HOUR,       length: 0.25, width: 7 },
        {angle: (mm + ss/60) * RADIAN_PER_MIN_OR_SEC, length: 0.4,  width: 5 },
        {angle: ss           * RADIAN_PER_MIN_OR_SEC, length: 0.4,  width: 1,
          tail:{length: 0.12, width: 3}, color: "#ff4000"},
      ];
    };
    handsAt(new Date()).forEach(hand => {
      const direction = this.toDirection(hand.angle);
      if( hand.color ) context.strokeStyle = context.fillStyle = hand.color;
      if( hand.tail ) drawHand(hand.tail.width, -hand.tail.length, direction);
      drawHand(hand.width, hand.length, direction);
    });
    context.beginPath();
    context.arc(this.center.x, this.center.y, 7, 0, 2 * Math.PI);
    context.fill();
  };
  pushed = (event, pianokeyboard) => {
    const touched = (typeof event.changedTouches !== 'undefined') ? event.changedTouches[0] : event;
    const target = touched.target;
    const rect = target.getBoundingClientRect();
    const positionFromCenter = {
      x: touched.clientX - (rect.left + rect.right)/2,
      y: touched.clientY - (rect.top + rect.bottom)/2,
    };
    const r = {
      x: positionFromCenter.x / target.width,
      y: positionFromCenter.y / target.height,
    };
    const distance = Math.sqrt( r.x ** 2 + r.y ** 2 );
    if( distance < CircleOfFifthsClock.bounds.min || distance > CircleOfFifthsClock.bounds.max ) {
      return;
    }
    if( ! pianokeyboard ) {
      event.preventDefault();
      return;
    }
    const hour = Math.round( -Math.atan2(-r.x, -r.y) * 6 / Math.PI );
    let offset3rd =
      distance < CircleOfFifthsClock.bounds.maj ? -1 :
      distance > CircleOfFifthsClock.bounds.sus4 ? 1 : 0;
    const root = hour + 6 * (hour & 1) + (offset3rd < 0 ? 9 : 12);
    let offset5th = 0;
    if( event.altKey || this.shiftButtonStatus?.button_flat5 ) {
      offset5th = (offset3rd == 1 ? 1 : -1);
      if( offset3rd == 1 ) offset3rd = 0;
    }

    let offset7th = 0;
    if( this.shiftButtonStatus ) {
      offset7th = 4;
      if( this.shiftButtonStatus.button_7th ) offset7th -= 2;
      if( this.shiftButtonStatus.button_major7th ) offset7th -= 1;
    }
    if( ! offset7th ) {
      if( event.button == 2 ) offset7th += 2;
      if( event.shiftKey ) offset7th += 1;
    }
    if( offset7th == 4 ) offset7th = 0;

    const add9th = event.ctrlKey || this.shiftButtonStatus?.button_add9;

    const offsets = [0, 4 + offset3rd, 7 + offset5th];
    if( offset7th ) offsets.push(8 + offset7th);
    if( add9th ) offsets.push(14);
    pianokeyboard.activateChord(offsets.map(o => this.octave.constraint(root + o)));

    if( pianokeyboard.chordsymbol ) {
      const roots = [
        ['C'], ['C#','Db'],
        ['D'], ['Eb','D#'],
        ['E'],
        ['F'], ['F#','Gb'],
        ['G'], ['Ab','G#'],
        ['A'], ['Bb','A#'],
        ['B']
      ];
      let suffix = '';
      if( offset3rd == -1 ) suffix += 'm';
      if( offset5th > 0 ) suffix += 'aug';
      suffix += (add9th ? ['add9','69','9','M9'] : ['','6','7','M7'])[offset7th];
      if( offset3rd == 1 ) suffix += 'sus4';
      if( offset5th < 0 ) suffix += '-5';
      if( suffix == 'm6-5' ) suffix = 'dim7'; else if( suffix == 'm69-5' ) suffix = 'dim9';
      pianokeyboard.chordsymbol.innerHTML = roots[root % 12].map(rt => rt + suffix).join('/');
    }
  };
  listen = () => {
    this.pianokeyboard = new PianoKeyboard();
    const [startTypes, endTypes, disablingTypes] = [
      ['mousedown'],
      ['mouseup'],
      ['touchmove', 'click', 'mousemove', 'contextmenu', 'selectstart']
    ];
    const buttonContainer = document.getElementById('button_container');
    if( typeof window.ontouchstart !== 'undefined' ) {
      // Mouse event will be invoked duplicatelly even touched, so disable mouseup/mousedown event
      startTypes.shift();
      endTypes.shift();
      startTypes.unshift('touchstart');
      endTypes.unshift('touchend');
      const ids = [
        "button_7th",
        "button_major7th",
        "button_flat5",
        "button_add9"
      ];
      this.shiftButtonStatus = ids.reduce((status, id) => {status[id] = false; return status;}, {});
      ids.forEach(id => {
        const button = document.getElementById(id);
        if( button ) {
          button.addEventListener('touchstart', event => {
            this.shiftButtonStatus[id] = true;
            event.changedTouches[0].target.classList.add('pressed');
          });
          button.addEventListener('touchend', event => {
            this.shiftButtonStatus[id] = false;
            event.changedTouches[0].target.classList.remove('pressed');
          });
          disablingTypes.forEach(t => button.addEventListener(t, e => e.preventDefault()));
        }
      });
      if( buttonContainer ) {
        disablingTypes.forEach(t => buttonContainer.addEventListener(t, e => e.preventDefault()));
      }
    } else {
      buttonContainer?.remove();
    }
    const canvas = this.clockCanvas;
    startTypes.forEach(t => canvas.addEventListener(t, e => this.pushed(e, this.pianokeyboard), false));
    endTypes.forEach(t => canvas.addEventListener(t, e => this.pianokeyboard.deactivateChord(), false));
    disablingTypes.forEach(t => canvas.addEventListener(t, this.pushed));
    this.emptyKeySignatureLabel = 'Key/sus4';
    this.octave = {
      slider: document.getElementById('octave') || {},
      constraint: n => {
        // Slider value's type is string, so the -0 required
        const nMin = this.octave.slider.value - 0;
        const nMax = nMin + 11;
        while( n < nMin || n > nMax ) n += (n < nMin ? 12 : -12);
        return n;
      }
    };
    this.octave.slider.min = 0;
    this.octave.slider.max = 128 - 12;
    this.octave.slider.step = 1;
    this.octave.slider.value = 58;
  };
};