/* DeltaTrace launch sound: synthesised with Web Audio, no audio files.
   Soft glass tones, filtered air and a warm low "settle", in the spirit of system sounds:
   quiet, short, harmonic and never harsh. Each cue is scheduled by the animation at the
   moment its visual starts so sound and picture stay in step. */
(function () {
  function impulse(ctx, secs, decay) {
    var n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function Engine(ctx, dest) {
    var out = ctx.createGain(); out.gain.value = 1.3;
    var dry = ctx.createGain(), wet = ctx.createGain(), rev = ctx.createConvolver();
    wet.gain.value = 0.32; rev.buffer = impulse(ctx, 2.6, 2.4);
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    out.connect(dry); out.connect(rev); rev.connect(wet); dry.connect(comp); wet.connect(comp); comp.connect(dest || ctx.destination);
    var noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), nd = noise.getChannelData(0);
    for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    function env(g, t, a, peak, dur) { // fast attack, smooth exponential release
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    function tone(type, f0, f1, t, dur, peak, att) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env(g, t, att || 0.01, peak, dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
    function air(t, dur, fa, fb, q, peak, type) { // filtered noise sweep
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; s.loop = true;
      f.type = type || 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(fa, t); f.frequency.exponentialRampToValueAtTime(fb, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.62); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    }
    function bell(f, t, vol, dur) { // glass partials, long soft tail
      var ratios = [1, 2.003, 3.01, 4.17], amps = [1, 0.34, 0.16, 0.07];
      ratios.forEach(function (r, i) { tone('sine', f * r, 0, t, dur / (1 + i * 0.7), vol * amps[i], 0.004); });
    }
    function pad(freqs, t, dur, vol, lp) {
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.4; f.connect(out);
      freqs.forEach(function (fr, i) {
        var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = fr; o.detune.value = (i - 1.5) * 4;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol / freqs.length, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(f); o.start(t); o.stop(t + dur + 0.05);
      });
    }
    function tick(t, f, vol) { tone('sine', f, f * 0.9, t, 0.09, vol, 0.002); }
    var PENT = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66]; // C major pentatonic

    var cues = {
      start: function (t) { tone('sine', 62, 48, t, 0.5, 0.16, 0.01); tick(t + 0.02, 2093, 0.03); },
      scatter: function (t) {
        air(t, 1.1, 5200, 7600, 0.7, 0.028, 'highpass');
        for (var i = 0; i < 9; i++) tick(t + 0.08 + Math.random() * 0.9, 2400 + Math.random() * 3200, 0.011 + Math.random() * 0.008);
      },
      converge: function (t) { air(t, 1.45, 260, 3600, 1.6, 0.11); tone('sine', 150, 540, t, 1.45, 0.05, 0.35); tone('sine', 300, 1080, t, 1.45, 0.018, 0.4); },
      streams: function (t) { PENT.forEach(function (f, i) { bell(f, t + i * 0.046, 0.034, 0.9); }); air(t, 0.7, 1500, 4200, 1, 0.03); },
      lens: function (t) { pad([220, 329.63, 440], t, 2.4, 0.075, 1300); tone('sine', 330, 990, t + 0.05, 1.3, 0.03, 0.4); tick(t, 1760, 0.02); },
      node: function (t) {
        air(t, 0.38, 2200, 5200, 1.2, 0.045);
        bell(880, t + 0.26, 0.13, 2.6); bell(1318.5, t + 0.28, 0.05, 2.2);
        pad([220, 329.63, 440, 554.37], t + 0.24, 2.8, 0.085, 1700);
        tone('sine', 58, 44, t + 0.26, 0.6, 0.2, 0.008);
      },
      settle: function (t) { tone('sine', 880, 440, t, 0.7, 0.03, 0.12); air(t, 0.75, 3200, 700, 0.9, 0.04); },
      name: function (t) { bell(1318.5, t, 0.05, 1.4); },
      sub: function (t) { tick(t, 2637, 0.014); },
      dockStart: function (t) { air(t, 0.95, 700, 2600, 1.3, 0.085); tone('sine', 300, 620, t, 0.95, 0.035, 0.3); },
      land: function (t) { tone('sine', 190, 88, t, 0.28, 0.14, 0.004); tick(t + 0.005, 2349, 0.05); bell(1318.5, t + 0.02, 0.045, 1.6); },
      skip: function () { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08); }
    };
    return { ctx: ctx, cue: function (name, when) { var t = (when === undefined ? ctx.currentTime : when) + 0.005; if (cues[name]) cues[name](t); }, cues: Object.keys(cues) };
  }
  window.DeltaAudio = { Engine: Engine };
})();
