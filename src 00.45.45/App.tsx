import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Copy, Mic, MicOff, Loader2, RefreshCw, Check, Moon, Sun, ArrowRightLeft, Star, Trash2, ClipboardCopy } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface TranslationResult {
  id?: string;
  corrected_source: string;
  translation: string;
  pinyin: string;
  sourceLang?: string;
  targetLang?: string;
  timestamp?: number;
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [bulkCopiedId, setBulkCopiedId] = useState<string | null>(null);
  const [isExportCopied, setIsExportCopied] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [translationStyle, setTranslationStyle] = useState<'Natural' | 'Formal'>('Natural');
  const [recipientGender, setRecipientGender] = useState<'Male' | 'Female'>('Male');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sourceLang, setSourceLang] = useState<'en-US' | 'zh-TW'>('en-US');
  const [favorites, setFavorites] = useState<TranslationResult[]>([]);

  const recognitionRef = useRef<any>(null);
  const lockMicRef = useRef(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') { setIsDarkMode(true); document.documentElement.classList.add('dark'); }
    const savedFavs = localStorage.getItem('favorites');
    if (savedFavs) { try { setFavorites(JSON.parse(savedFavs)); } catch (e) { console.error(e); } }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = sourceLang === 'zh-TW' ? 'cmn-Hant-TW' : 'en-US';

      recognition.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
        }
        if (final) {
          setInputText((prev) => (prev.endsWith(' ') || prev === '' ? prev + final : prev + ' ' + final));
        }
      };

      recognition.onend = () => { if (!lockMicRef.current) setIsListening(false); };
      recognitionRef.current = recognition;
    }
  }, [sourceLang]);

  const toggleListening = () => {
    if (isListening) {
      lockMicRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      lockMicRef.current = false;
      setResult(null);
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    lockMicRef.current = true;
    recognitionRef.current?.stop();
    setIsListening(false);
    setIsTranslating(true);
    setError(null);

    try {
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `Input: "${inputText.trim()}"`;
      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.0, responseMimeType: 'application/json' },
        systemInstruction: `Expert translator for 'Tingshuo'. 
        Style: ${translationStyle}. Gender: ${recipientGender === 'Female' ? '妳' : '你'}. 
        Translate ${sourceLang === 'en-US' ? 'EN to TW' : 'TW to EN'}. 
        Terms: "主要作物" (target crop), "土壤食物網" (soil food web), "根噬循環" (rhizophagy cycle), "大自然循環" (natural cycles), "演替" (succession), "分層" (strata), "趨合農業" (syntropic agroforestry).
        JSON: {"corrected_source": "...", "translation": "...", "pinyin": "..."}`
      });

      const parsed = JSON.parse(await response.response.text());
      const finalResult = { ...parsed, id: Date.now().toString(), sourceLang, targetLang: sourceLang === 'en-US' ? 'zh-TW' : 'en-US' };
      setResult(finalResult);
    } catch (err) { setError("Translation Error. Please try again."); } 
    finally { setIsTranslating(false); setTimeout(() => { lockMicRef.current = false; }, 500); }
  };

  const toggleFavorite = () => {
    if (!result) return;
    const isFav = favorites.some(f => f.id === result.id);
    const newFavs = isFav ? favorites.filter(f => f.id !== result.id) : [result, ...favorites];
    setFavorites(newFavs);
    localStorage.setItem('favorites', JSON.stringify(newFavs));
  };

  return (
    <div className={`min-h-screen p-6 transition-colors ${isDarkMode ? 'dark bg-stone-950 text-white' : 'bg-stone-50 text-stone-900'}`}>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-emerald-600">聽說 TīngShuō</h1>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-stone-200 dark:bg-stone-800 rounded-full">
            {isDarkMode ? <Sun /> : <Moon />}
          </button>
        </header>

        <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
          <div className="p-4 border-b dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-900">
             <div className="flex gap-2 bg-stone-100 dark:bg-stone-800 p-1 rounded-lg">
                <button onClick={() => setSourceLang(sourceLang === 'en-US' ? 'zh-TW' : 'en-US')} className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-stone-700 rounded shadow text-sm font-bold">
                  {sourceLang === 'en-US' ? 'EN' : 'ZH'} <ArrowRightLeft size={14}/> {sourceLang === 'en-US' ? 'ZH' : 'EN'}
                </button>
             </div>
             <button onClick={toggleListening} className={`p-4 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-stone-200 dark:bg-stone-800 text-stone-600'}`}>
                {isListening ? <MicOff size={24}/> : <Mic size={24}/>}
             </button>
          </div>
          <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Speak or type..." className="w-full h-48 p-6 text-xl bg-transparent border-0 focus:ring-0 resize-none" />
          <div className="p-4 bg-stone-50 dark:bg-stone-800/50 border-t dark:border-stone-800 flex flex-wrap gap-4 justify-between">
            <div className="flex gap-2">
               <button onClick={() => setTranslationStyle(translationStyle === 'Natural' ? 'Formal' : 'Natural')} className="px-4 py-2 bg-white dark:bg-stone-700 rounded-xl text-sm font-bold shadow-sm">{translationStyle}</button>
               <button onClick={() => setRecipientGender(recipientGender === 'Male' ? 'Female' : 'Male')} className="px-4 py-2 bg-white dark:bg-stone-700 rounded-xl text-sm font-bold shadow-sm">{recipientGender}</button>
            </div>
            <button onClick={handleTranslate} disabled={isTranslating || !inputText} className="bg-emerald-600 text-white px-8 py-2 rounded-xl font-bold flex gap-2 disabled:opacity-30">
              {isTranslating ? <Loader2 className="animate-spin"/> : <RefreshCw />} Translate
            </button>
          </div>
        </div>

        {result && (
          <div className="space-y-4">
             <button onClick={toggleFavorite} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${favorites.some(f => f.id === result.id) ? 'bg-yellow-100 text-yellow-700' : 'bg-stone-200'}`}>
                <Star size={16} fill={favorites.some(f => f.id === result.id) ? "currentColor" : "none"}/> Save to Favorites
             </button>
             <div className="grid md:grid-cols-3 gap-4">
                <OutputCard title="Corrected" text={result.corrected_source} onCopy={() => {navigator.clipboard.writeText(result.corrected_source); setCopiedField('c')}} isCopied={copiedField === 'c'} />
                <OutputCard title="Translation" text={result.translation} onCopy={() => {navigator.clipboard.writeText(result.translation); setCopiedField('t')}} isCopied={copiedField === 't'} highlight />
                <OutputCard title="Pinyin" text={result.pinyin} onCopy={() => {navigator.clipboard.writeText(result.pinyin); setCopiedField('p')}} isCopied={copiedField === 'p'} pinyin />
             </div>
          </div>
        )}

        {favorites.length > 0 && (
          <div className="pt-10 border-t dark:border-stone-800">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">Favorites ({favorites.length})</h2>
              <button onClick={() => {setFavorites([]); localStorage.removeItem('favorites')}} className="text-red-500 text-sm flex items-center gap-1"><Trash2 size={14}/> Clear All</button>
            </div>
            <div className="space-y-3">
              {favorites.map(f => (
                <div key={f.id} className="p-4 bg-white dark:bg-stone-900 rounded-xl border dark:border-stone-800 flex justify-between items-center">
                  <p className="text-sm truncate mr-4"><strong>{f.corrected_source}</strong> → {f.translation}</p>
                  <button onClick={() => {navigator.clipboard.writeText(`${f.corrected_source}\n${f.translation}\n${f.pinyin}`); setBulkCopiedId(f.id!)}} className="text-stone-400">
                    {bulkCopiedId === f.id ? <Check size={16} className="text-emerald-500"/> : <ClipboardCopy size={16}/>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OutputCard({ title, text, onCopy, isCopied, highlight, pinyin }: any) {
  return (
    <div className={`p-4 rounded-2xl border dark:border-stone-800 ${highlight ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100' : 'bg-white dark:bg-stone-900'}`}>
      <div className="flex justify-between mb-2"><span className="text-xs font-black uppercase text-stone-400">{title}</span><button onClick={onCopy}>{isCopied ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}</button></div>
      <p className={`${pinyin ? 'italic text-amber-600' : 'text-lg font-medium'}`}>{text}</p>
    </div>
  );
}