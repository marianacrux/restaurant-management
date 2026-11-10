import { useCallback, useEffect, useRef, useState } from 'react';
import { storage } from '../utils/storage.js';

/**
 * Anuncios por voz con la API SpeechSynthesis del navegador.
 *
 * - Cola de reproducción: los anuncios NUNCA se superponen; se dicen uno tras otro.
 * - Los navegadores bloquean el audio hasta que el usuario interactúa con la
 *   página, por eso el audio se activa con `enable()` desde un clic.
 * - Antes de cada anuncio suena un "ding" (Web Audio) para llamar la atención.
 * - Silencio persistente (localStorage) y "repetir último anuncio".
 * - Vigilante (watchdog): si el navegador no dispara `onend` (fallo conocido de
 *   Chrome), la cola no se queda bloqueada.
 */
const MUTE_KEY = 'rm_kitchen_muted';
const MAX_QUEUE = 10;
const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

function pickSpanishVoice() {
  const voices = window.speechSynthesis.getVoices();
  const normalized = (v) => v.lang?.replace('_', '-').toLowerCase();
  for (const lang of ['es-co', 'es-mx', 'es-us', 'es-419', 'es-es']) {
    const voice = voices.find((v) => normalized(v) === lang);
    if (voice) return voice;
  }
  return voices.find((v) => normalized(v)?.startsWith('es')) ?? null;
}

export function useSpeechAnnouncer() {
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(() => storage.get(MUTE_KEY) === '1');
  const [speaking, setSpeaking] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [lastMessage, setLastMessage] = useState(null);

  const queue = useRef([]);
  const busy = useRef(false);
  const audioCtx = useRef(null);
  const voice = useRef(null);
  const watchdog = useRef(null);
  const flags = useRef({ enabled: false, muted });
  const playNextRef = useRef(() => {});

  useEffect(() => {
    if (!supported) return undefined;
    const loadVoice = () => {
      voice.current = pickSpanishVoice();
    };
    loadVoice();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoice);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoice);
      window.speechSynthesis.cancel();
      clearTimeout(watchdog.current);
    };
  }, []);

  /** Dos tonos cortos. Devuelve una promesa que termina al acabar el sonido. */
  const chime = useCallback(() => {
    const ctx = audioCtx.current;
    if (!ctx) return Promise.resolve();
    const now = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const start = now + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    });
    return new Promise((resolve) => setTimeout(resolve, 450));
  }, []);

  const playNext = useCallback(async () => {
    if (busy.current) return;
    const text = queue.current.shift();
    setQueueLength(queue.current.length);
    if (!text) return;
    if (!flags.current.enabled || flags.current.muted) return;

    busy.current = true;
    setSpeaking(true);
    await chime();

    const finish = () => {
      if (!busy.current) return;
      clearTimeout(watchdog.current);
      busy.current = false;
      setSpeaking(false);
      setTimeout(() => playNextRef.current(), 600); // pausa breve entre anuncios
    };

    if (!supported) return finish();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice.current?.lang ?? 'es-CO';
    if (voice.current) utterance.voice = voice.current;
    utterance.rate = 0.95;
    utterance.onend = finish;
    utterance.onerror = finish;
    watchdog.current = setTimeout(() => {
      window.speechSynthesis.cancel();
      finish();
    }, 5000 + text.length * 120);
    window.speechSynthesis.speak(utterance);
  }, [chime]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  /** Encola un anuncio. Si el audio está apagado, solo se guarda como "último". */
  const announce = useCallback((text) => {
    setLastMessage(text);
    if (!flags.current.enabled || flags.current.muted) return;
    if (queue.current.length >= MAX_QUEUE) queue.current.shift();
    queue.current.push(text);
    setQueueLength(queue.current.length);
    playNextRef.current();
  }, []);

  /** Debe llamarse desde un clic: desbloquea el audio del navegador. */
  const enable = useCallback(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx && !audioCtx.current) audioCtx.current = new Ctx();
    audioCtx.current?.resume();
    flags.current.enabled = true;
    setEnabled(true);
    if (supported) {
      window.speechSynthesis.cancel();
      queue.current = ['Audio de cocina activado'];
      playNextRef.current();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const next = !flags.current.muted;
    flags.current.muted = next;
    setMuted(next);
    storage.set(MUTE_KEY, next ? '1' : '0');
    if (next) {
      queue.current = [];
      setQueueLength(0);
      if (supported) window.speechSynthesis.cancel();
    }
  }, []);

  /**
   * Repite el último anuncio. Si aún no hubo ninguno (p. ej. la página se acaba
   * de abrir), usa `fallbackText` para que el botón nunca quede sin efecto.
   */
  const repeatLast = useCallback(
    (fallbackText) => {
      const text = lastMessage ?? (typeof fallbackText === 'string' ? fallbackText : null);
      if (text) announce(text);
    },
    [lastMessage, announce],
  );

  return { supported, enabled, muted, speaking, queueLength, lastMessage, enable, toggleMute, repeatLast, announce };
}
