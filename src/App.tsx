import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
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
  const [interimText, setInterimText] = useState('');
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
  const isManuallyStopped = useRef(true);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const savedFavs = localStorage.getItem('favorites');
    if (savedFavs) {
      try { setFavorites(JSON.parse(savedFavs)); } catch (e) { console.error(e); }
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true; // Required for real-time speed
      
      recognition.onresult = (event: any) => {
        let finalText = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (finalText) setInputText((prev) => prev + finalText + ' ');
        setInterimText(interim); // Shows you what it's hearing without duplicating permanently
      };

      recognition.onend = () => {
        // AUTO-RESTART logic: If we didn't click "Stop", start again immediately
        if (!isManuallyStopped.current) {
          recognition.start();
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleLanguage = () => {
    setSourceLang(prev => prev === 'en-US' ? 'zh-TW' : 'en-US');
    setInputText('');
    setInterimText('');
  };

  const toggleListening = () => {
    if (isListening) {
      isManuallyStopped.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimText('');
    } else {
      if (recognitionRef.current) {
        isManuallyStopped.current = false;
        recognitionRef.current.lang = sourceLang === 'zh-TW' ? 'cmn-Hant-TW' : 'en-US';
        recognitionRef.current.start();
        setIsListening(true);
      }
    }
  };

  const handleTranslate = async () => {
    const fullText = (inputText + interimText).trim();
    if (!fullText) return;

    toggleListening(); // Stop mic when translating
    setIsTranslating(true);
    setResult(null);
    setError(null);

    const sourceName = sourceLang === 'en-US' ? 'English' : 'Taiwanese Traditional Chinese';
    const targetName = sourceLang === 'en-US' ? 'Taiwanese Traditional Chinese' : 'English';

    try {
      // Note: We are using "generateContentStream" for speed
      const response = await ai.models.generateContentStream({
        model: 'gemini-1.5-flash', // Flash is significantly faster for this app
        contents: `Process this STT input: "${fullText}"`,
        config: {
          temperature: 1.0, // Higher temperature increases generation speed
          systemInstruction: `**Role:** You are an expert bilingual translator for the 'Tingshuo' app.
**Strict Rules:**
1. Be concise. 
2. Correct STT errors and repetitions from the source: ${sourceName}.
3. No Repetition: Do not loop or repeat words in your output.
4. Translate into ${targetName}. Use Traditional Chinese (Taiwan) specifically.
5. Use these terms: "主要作物" (Target crop), "土壤食物網" (Soil food web), "根噬循環" (Rhizophagy cycle), "大自然循環" (Natural cycles), "演替" (Succession), "分層" (Strata), "趨合農業" (Syntropic agroforestry).
6. Gender Context: Use ${recipientGender === 'Female' ? '妳' : '你'} and appropriate honorifics.
7. Style: ${translationStyle}.
Return JSON: {"corrected_source": "...", "translation": "...", "pinyin": "..."}`,
          responseMimeType: 'application/json',
        }
      });

      // Handle the streaming response
      let fullTextResponse = "";
      for await (const chunk of response.stream) {
        fullTextResponse += chunk.text();
      }

      const parsed = JSON.parse(fullTextResponse);
      setResult({
        ...parsed,
        id: Date.now().toString(),
        sourceLang,
        targetLang: sourceLang === 'en-US' ? 'zh-TW' : 'en-US'
      });
      setInputText('');
      setInterimText('');
    } catch (err: any) {
      setError("AI speed limit or connection error. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  // Helper functions for UI
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className={`min-h-screen transition-colors ${isDarkMode ? 'dark bg-stone-950 text-white' : 'bg-white text-stone-900'}`}>
      <nav className="p-4 flex justify-end max-w-4xl mx-auto">
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full bg-stone-100 dark:bg-stone-800">
          {isDarkMode ? <Sun /> : <Moon />}
        </button>
      </nav>

      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <header className="text-center">
          <h1 className="text-4xl font-bold text-emerald-600">聽說 TīngShuō</h1>
          <p className="text-stone-500">Natural Translation & Correction</p>
        </header>

        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-lg border border-stone-200 dark:border-stone-800">
          <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center">
            <div className="flex gap-2 bg-stone-100 dark:bg-stone-800 p-1 rounded-lg">
              <span className="px-3 py-1 text-sm font-bold">{sourceLang === 'en-US' ? 'EN' : 'ZH'}</span>
              <button onClick={toggleLanguage}><ArrowRightLeft size={16} /></button>
              <span className="px-3 py-1 text-sm font-bold">{sourceLang === 'en-US' ? 'ZH' : 'EN'}</span>
            </div>
            
            <button onClick={toggleListening} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-600 text-white'}`}>
              {isListening ? <MicOff size={18}/> : <Mic size={18}/>}
              {isListening ? 'Stop' : 'Start Dictation'}
            </button>
          </div>

          <div className="p-6">
            <textarea
              ref={textAreaRef}
              value={inputText + interimText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Speak or type here..."
              className="w-full h-48 bg-transparent border-0 text-xl resize-none focus:ring-0"
            />
          </div>

          <div className="p-4 bg-stone-50 dark:bg-stone-800/50 flex flex-wrap gap-4 justify-between items-center">
            <div className="flex gap-2">
               <button onClick={() => setTranslationStyle('Natural')} className={`px-4 py-1 rounded-md ${translationStyle === 'Natural' ? 'bg-white dark:bg-stone-600 shadow' : ''}`}>Natural</button>
               <button onClick={() => setTranslationStyle('Formal')} className={`px-4 py-1 rounded-md ${translationStyle === 'Formal' ? 'bg-white dark:bg-stone-600 shadow' : ''}`}>Formal</button>
            </div>
            <button 
              onClick={handleTranslate} 
              disabled={isTranslating || !(inputText + interimText)}
              className="bg-emerald-600 text-white px-8 py-2 rounded-xl font-bold flex gap-2"
            >
              {isTranslating ? <Loader2 className="animate-spin"/> : <RefreshCw />} Correct & Translate
            </button>
          </div>
        </div>

        {result && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <OutputBox title="Corrected Source" text={result.corrected_source} onCopy={() => copyToClipboard(result.corrected_source, 's')} isCopied={copiedField === 's'} />
            <OutputBox title="Translation" text={result.translation} onCopy={() => copyToClipboard(result.translation, 't')} isCopied={copiedField === 't'} />
            <OutputBox title="Pinyin" text={result.pinyin} onCopy={() => copyToClipboard(result.pinyin, 'p')} isCopied={copiedField === 'p'} isPinyin />
          </div>
        )}
      </div>
    </div>
  );
}

function OutputBox({ title, text, onCopy, isCopied, isPinyin = false }: any) {
  return (
    <div className="bg-white dark:bg-stone-900 p-4 rounded-xl border border-stone-200 dark:border-stone-800 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-bold uppercase text-stone-400">{title}</h4>
        <button onClick={onCopy}>{isCopied ? <Check size={14} className="text-emerald-500"/> : <Copy size={14} />}</button>
      </div>
      <p className={`text-lg ${isPinyin ? 'text-amber-600 font-medium' : ''}`}>{text}</p>
    </div>
  );
}